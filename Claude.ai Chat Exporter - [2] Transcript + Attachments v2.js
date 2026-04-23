// =============================================================================
// Claude.ai Chat Exporter v3 — React Fiber Extraction
// =============================================================================
// Extracts conversation data directly from React's internal state, which
// contains the full structured message content array with timestamps,
// tool use, citations, and artifact metadata.
//
// Strategy:
//   1. Try File System Access API → folder with subfolder structure
//   2. Fall back to JSZip → single .zip download
//   3. Artifact files: click native Download buttons (content is server-side)
// =============================================================================

(async () => {
	"use strict";

	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

	// ── UI ───────────────────────────────────────────────────────────────
	const overlay = document.createElement("div");
	Object.assign(overlay.style, {
		position: "fixed",
		top: "16px",
		right: "16px",
		zIndex: "999999",
		background: "#1a1a2e",
		color: "#e0e0e0",
		padding: "16px 24px",
		borderRadius: "12px",
		fontFamily: "system-ui, sans-serif",
		fontSize: "14px",
		boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
		minWidth: "360px",
		border: "1px solid #333",
		lineHeight: "1.6",
		whiteSpace: "pre-line",
	});
	const setStatus = (msg) => {
		overlay.textContent = msg;
		console.log(msg);
	};
	setStatus("📦 Exporting chat...");
	document.body.appendChild(overlay);

	// ── Storage strategy ─────────────────────────────────────────────────
	let folderHandle = null;
	let useFolder = false;
	let zip = null;

	try {
		if (window.showDirectoryPicker) {
			setStatus("📂 Pick a parent folder for the export...");
			const parentHandle = await window.showDirectoryPicker({
				mode: "readwrite",
			});
			const chatTitle =
				document.title.replace(/ - Claude$/, "").trim() ||
				"Untitled_Chat";
			const safeName = chatTitle
				.replace(/[^a-zA-Z0-9 _-]/g, "_")
				.substring(0, 80);
			folderHandle = await parentHandle.getDirectoryHandle(safeName, {
				create: true,
			});
			useFolder = true;
			setStatus(`📂 Writing to: ${safeName}/`);
		}
	} catch (e) {
		if (e.name !== "AbortError") console.warn("FS API failed:", e.message);
		useFolder = false;
	}

	if (!useFolder) {
		setStatus("📦 Loading JSZip...");
		await new Promise((resolve, reject) => {
			if (window.JSZip) return resolve();
			const s = document.createElement("script");
			s.src =
				"https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
			s.onload = resolve;
			s.onerror = () => reject(new Error("Failed to load JSZip"));
			document.head.appendChild(s);
		});
		zip = new JSZip();
	}

	// ── File write helpers ───────────────────────────────────────────────
	const writeFile = async (path, content) => {
		if (useFolder) {
			const parts = path.split("/");
			let dir = folderHandle;
			for (let i = 0; i < parts.length - 1; i++) {
				dir = await dir.getDirectoryHandle(parts[i], { create: true });
			}
			const fh = await dir.getFileHandle(parts[parts.length - 1], {
				create: true,
			});
			const w = await fh.createWritable();
			await w.write(content);
			await w.close();
		} else {
			zip.file(path, content);
		}
	};

	const finalizeZip = async (filename) => {
		if (!useFolder && zip) {
			setStatus("📦 Generating ZIP...");
			const blob = await zip.generateAsync({ type: "blob" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}
	};

	try {
		// ── React fiber helpers ────────────────────────────────────────────
		const getFiber = (el) => {
			const k = Object.keys(el).find((k) =>
				k.startsWith("__reactFiber$"),
			);
			return k ? el[k] : null;
		};

		// Walk up fiber tree and find the first ancestor with a given prop
		const findProp = (fiber, propName, maxDepth = 50) => {
			let cur = fiber,
				d = 0;
			while (cur && d < maxDepth) {
				if (cur.memoizedProps?.[propName] !== undefined)
					return cur.memoizedProps[propName];
				cur = cur.return;
				d++;
			}
			return undefined;
		};

		// Find an object property by walking fiber
		const findDeepProp = (fiber, test, maxDepth = 50) => {
			let cur = fiber,
				d = 0;
			while (cur && d < maxDepth) {
				if (cur.memoizedProps) {
					const result = test(cur.memoizedProps, d);
					if (result !== undefined) return result;
				}
				cur = cur.return;
				d++;
			}
			return undefined;
		};

		// ── Page metadata ──────────────────────────────────────────────────
		const chatTitle =
			document.title.replace(/ - Claude$/, "").trim() || "Untitled Chat";
		const chatUrl = window.location.href;
		const chatId = chatUrl.match(/\/chat\/([a-f0-9-]+)/)?.[1] || "unknown";
		const safeTitle = chatTitle
			.replace(/[^a-zA-Z0-9_-]/g, "_")
			.substring(0, 60);

		// ── Extract conversation from React fiber ──────────────────────────
		setStatus("🔍 Extracting conversation from React state...");

		const scrollContainer = document.querySelector(
			'[data-autoscroll-container="true"]',
		);
		const turnColumn = scrollContainer?.querySelector(
			".flex-1.flex.flex-col",
		);
		const turnEls = turnColumn
			? Array.from(turnColumn.children).filter((c) =>
					c.matches("div[data-test-render-count]"),
				)
			: [];

		// For each turn, extract the message object from React fiber
		const turns = [];
		for (const el of turnEls) {
			const fiber = getFiber(el);
			if (!fiber) continue;

			// Find message prop
			const message = findProp(fiber, "message", 15);
			const updatedMessage = findProp(fiber, "updatedMessage", 15);
			const msg = updatedMessage || message;
			if (!msg) continue;

			// Determine role
			const isUser = msg.sender === "human";
			const isAssistant = msg.sender === "assistant";

			// Extract file attachments for user messages
			const files = [];
			const thumbnails = el.querySelectorAll(
				'[data-testid="file-thumbnail"]',
			);
			thumbnails.forEach((ft) => {
				const btn = ft.querySelector("button[aria-label]");
				const label = btn?.getAttribute("aria-label") || "";
				const parts = label.split(",").map((s) => s.trim());
				files.push({
					filename:
						parts[0] ||
						ft.querySelector("h3")?.textContent?.trim() ||
						"unknown",
					ext: parts[1] || "",
					size: parts[2] || "",
				});
			});

			// Extract artifact metadata from fiber
			const artifacts = [];
			const artifactCells = el.querySelectorAll(".artifact-block-cell");
			artifactCells.forEach((cell) => {
				const title =
					cell.querySelector(".line-clamp-1")?.textContent?.trim() ||
					"Untitled";
				const typeEl = cell.querySelector(".text-text-400");
				const type = typeEl?.textContent?.trim() || "";
				// Get file path from fiber
				const cellFiber = getFiber(cell);
				const file = findProp(cellFiber, "file", 10);
				const properties = findProp(cellFiber, "properties", 10);
				artifacts.push({
					title,
					type,
					filename: file?.name || "",
					path: file?.path || properties?.id || "",
				});
			});

			// Extract timestamp
			const timestamp = msg.created_at || null;
			const timestampStr = timestamp
				? new Date(timestamp).toLocaleString("en-AU", {
						dateStyle: "medium",
						timeStyle: "short",
					})
				: null;

			// User message action bar timestamp (visible date like "17 Feb")
			const uiTimestamp =
				el
					.querySelector("span.text-text-500.text-xs")
					?.textContent?.trim() || null;

			turns.push({
				role: isUser ? "user" : isAssistant ? "assistant" : msg.sender,
				content: msg.content || [],
				text: msg.text || "",
				timestamp: timestampStr,
				uiTimestamp,
				files,
				artifacts,
				uuid: msg.uuid,
			});
		}

		setStatus(`📦 Extracted ${turns.length} turns. Building markdown...`);

		// ── Build markdown from structured content ─────────────────────────
		const md = [];

		md.push(`# ${chatTitle}`);
		md.push("");
		md.push(`> **Source:** ${chatUrl}`);
		md.push(`> **Exported:** ${new Date().toISOString()}`);
		md.push(`> **Turns:** ${turns.length}`);
		md.push("");
		md.push("---");
		md.push("");

		const seenArtifactTitles = new Set();
		const allArtifacts = [];

		for (let i = 0; i < turns.length; i++) {
			const t = turns[i];

			if (i % 10 === 0 && i > 0) {
				setStatus(`📦 Building markdown... ${i}/${turns.length}`);
			}

			if (t.role === "user") {
				md.push(
					`## 👤 User${t.uiTimestamp ? " — " + t.uiTimestamp : t.timestamp ? " — " + t.timestamp : ""}`,
				);
				md.push("");

				if (t.files.length > 0) {
					md.push("**Attached files:**");
					for (const f of t.files) {
						md.push(
							`- 📎 \`${f.filename}\`${f.size ? " (" + f.size + ")" : ""}`,
						);
					}
					md.push("");
				}

				// User messages: use .text (plain text) or walk .content
				if (t.text) {
					md.push(t.text.trim());
				} else if (t.content.length > 0) {
					for (const block of t.content) {
						if (block.type === "text" && block.text) {
							md.push(block.text.trim());
						}
					}
				}
				md.push("");
			} else if (t.role === "assistant") {
				md.push(
					`## 🤖 Claude${t.timestamp ? " — " + t.timestamp : ""}`,
				);
				md.push("");

				// Walk the content array — it's perfectly structured
				for (const block of t.content) {
					switch (block.type) {
						case "text":
							if (block.text?.trim()) {
								md.push(block.text.trim());
								md.push("");
							}
							break;

						case "tool_use":
							md.push(
								`<details><summary>🔧 ${block.message || block.name || "Tool use"}</summary>`,
							);
							md.push("");
							if (block.input) {
								const inputStr =
									typeof block.input === "string"
										? block.input
										: JSON.stringify(block.input, null, 2);
								// Only show input if it's short/meaningful
								if (inputStr.length < 500) {
									md.push("```json");
									md.push(inputStr);
									md.push("```");
									md.push("");
								}
							}
							md.push("</details>");
							md.push("");
							break;

						case "tool_result":
							// Tool results are usually very long (fetched web pages etc.)
							// Include a brief summary
							md.push(
								`<details><summary>📋 Result: ${block.message || block.name || "tool result"}</summary>`,
							);
							md.push("");
							if (block.content && Array.isArray(block.content)) {
								for (const item of block.content) {
									if (
										item.type === "knowledge" ||
										item.type === "text"
									) {
										const title =
											item.title || item.url || "";
										if (title) md.push(`**${title}**`);
										if (item.url)
											md.push(`URL: ${item.url}`);
										md.push("");
									}
									if (
										item.type === "tool_result" &&
										item.content
									) {
										const preview =
											typeof item.content === "string"
												? item.content.substring(0, 300)
												: JSON.stringify(
														item.content,
													).substring(0, 300);
										md.push(preview + "...");
										md.push("");
									}
								}
							}
							if (typeof block.content === "string") {
								md.push(block.content.substring(0, 500));
								md.push("");
							}
							md.push("</details>");
							md.push("");
							break;

						default:
							// Covers: 'image', 'file', 'code', etc.
							if (block.text) {
								md.push(block.text.trim());
								md.push("");
							}
							if (block.message) {
								md.push(`> *${block.message}*`);
								md.push("");
							}
							break;
					}
				}

				// Artifact references
				for (const art of t.artifacts) {
					if (!seenArtifactTitles.has(art.title)) {
						seenArtifactTitles.add(art.title);
						allArtifacts.push(art);
					}
					md.push(
						`> 📄 **Artifact:** ${art.title}${art.type ? " (" + art.type + ")" : ""}`,
					);
					if (art.filename) md.push(`> File: \`${art.filename}\``);
					md.push("");
				}
			}

			md.push("---");
			md.push("");
		}

		// ── Artifact index ─────────────────────────────────────────────────
		if (allArtifacts.length > 0) {
			md.push("## 📑 Artifacts Index");
			md.push("");
			allArtifacts.forEach((a, i) => {
				md.push(
					`${i + 1}. **${a.title}**${a.type ? " — " + a.type : ""}${a.filename ? " (`" + a.filename + "`)" : ""}`,
				);
			});
			md.push("");
		}

		// ── Clean + write transcript ───────────────────────────────────────
		const finalMd =
			md
				.join("\n")
				.replace(/\n{3,}/g, "\n\n")
				.trim() + "\n";
		setStatus("📝 Writing transcript...");
		await writeFile("transcript.md", finalMd);

		// ── Download images ────────────────────────────────────────────────
		const chatImages = document.querySelectorAll('img[src*="/files/"]');
		if (chatImages.length > 0) {
			setStatus(`🖼️ Downloading ${chatImages.length} image(s)...`);
			for (const img of chatImages) {
				try {
					const src = img.getAttribute("src");
					const alt = img.getAttribute("alt") || "image";
					const safeName = alt
						.replace(/[^a-zA-Z0-9_.-]/g, "_")
						.substring(0, 80);
					const resp = await fetch(src, { credentials: "include" });
					const blob = await resp.blob();
					const ext = blob.type.includes("png")
						? ".png"
						: blob.type.includes("gif")
							? ".gif"
							: ".jpg";
					await writeFile("images/" + safeName + ext, blob);
				} catch (e) {
					console.warn("Image download failed:", e);
				}
			}
		}

		// ── Download artifacts via native Download buttons ──────────────────
		const artifactBtns = document.querySelectorAll(
			'.artifact-block-cell button[aria-label="Download"]',
		);
		const seenBtnTitles = new Set();
		const uniqueBtns = [];
		artifactBtns.forEach((btn) => {
			const cell = btn.closest(".artifact-block-cell");
			const title =
				cell?.querySelector(".line-clamp-1")?.textContent?.trim() || "";
			if (!seenBtnTitles.has(title)) {
				seenBtnTitles.add(title);
				uniqueBtns.push({ btn, title });
			}
		});

		if (uniqueBtns.length > 0) {
			setStatus(
				`📥 Downloading ${uniqueBtns.length} artifacts...\n(These download to your Downloads folder)`,
			);
			await sleep(1000);

			for (let i = 0; i < uniqueBtns.length; i++) {
				const { btn, title } = uniqueBtns[i];
				setStatus(
					`📥 Artifact ${i + 1}/${uniqueBtns.length}: ${title}`,
				);
				btn.click();
				await sleep(500);
			}
			await sleep(500);
		}

		// ── Finalize ───────────────────────────────────────────────────────
		await finalizeZip(`${safeTitle}.zip`);

		const method = useFolder ? "📂 Folder" : "📦 ZIP";
		const summary = [
			`✅ Export complete! (${method})`,
			``,
			`📝 Transcript: ${turns.length} turns`,
			`📄 Artifacts: ${uniqueBtns.length} downloaded separately`,
			`🖼️ Images: ${chatImages.length}`,
			`📎 Referenced uploads: ${document.querySelectorAll('[data-testid="file-thumbnail"]').length}`,
			``,
			uniqueBtns.length > 0
				? `⚠️ Artifact files downloaded to your Downloads folder.\nMove them into the export folder/ZIP manually.`
				: "",
		].join("\n");
		setStatus(summary);

		await sleep(8000);
	} catch (err) {
		console.error("Export failed:", err);
		setStatus("❌ " + err.message + "\n\nCheck console for details.");
		await sleep(10000);
	} finally {
		overlay.remove();
	}
})();
