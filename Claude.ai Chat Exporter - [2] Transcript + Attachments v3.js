// =============================================================================
// Claude.ai Chat Exporter v4
// =============================================================================
// Run on any https://claude.ai/chat/<id> page.
//
// Exports:
//   1. transcript.md        — full conversation in structured Markdown
//   2. Images               — fetched and saved via ZIP or folder
//   3. Artifact files       — triggered via native Download buttons
//   4. organize.sh          — shell script to gather everything into one folder
//   5. manifest.json        — machine-readable index of all exported content
//
// Strategy: ZIP/folder for transcript + images + scripts,
//           native downloads for artifacts, organize.sh to merge.
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
		minWidth: "380px",
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

	// ── Storage ──────────────────────────────────────────────────────────
	let folderHandle = null,
		useFolder = false,
		zip = null;

	try {
		if (window.showDirectoryPicker) {
			setStatus("📂 Pick a parent folder for the export...");
			const parentHandle = await window.showDirectoryPicker({
				mode: "readwrite",
			});
			const title =
				document.title.replace(/ - Claude$/, "").trim() ||
				"Untitled_Chat";
			const safeName = title
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
	}

	if (!useFolder) {
		setStatus("📦 Loading JSZip...");
		await new Promise((res, rej) => {
			if (window.JSZip) return res();
			const s = document.createElement("script");
			s.src =
				"https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
			s.onload = res;
			s.onerror = () => rej(new Error("JSZip load failed"));
			document.head.appendChild(s);
		});
		zip = new JSZip();
	}

	const writeFile = async (path, content) => {
		if (useFolder) {
			const parts = path.split("/");
			let dir = folderHandle;
			for (let i = 0; i < parts.length - 1; i++)
				dir = await dir.getDirectoryHandle(parts[i], { create: true });
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

		const findProp = (fiber, name, maxD = 50) => {
			let c = fiber,
				d = 0;
			while (c && d < maxD) {
				if (c.memoizedProps?.[name] !== undefined)
					return c.memoizedProps[name];
				c = c.return;
				d++;
			}
		};

		// ── Page metadata ──────────────────────────────────────────────────
		const chatTitle =
			document.title.replace(/ - Claude$/, "").trim() || "Untitled Chat";
		const chatUrl = window.location.href;
		const chatId = chatUrl.match(/\/chat\/([a-f0-9-]+)/)?.[1] || "unknown";
		const safeTitle = chatTitle
			.replace(/[^a-zA-Z0-9_-]/g, "_")
			.substring(0, 60);
		const exportTime = new Date().toISOString();

		// ── Extract turns from React fiber ─────────────────────────────────
		setStatus("🔍 Extracting conversation data...");

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

		const turns = [];
		for (const el of turnEls) {
			const fiber = getFiber(el);
			if (!fiber) continue;

			const message =
				findProp(fiber, "updatedMessage", 15) ||
				findProp(fiber, "message", 15);
			if (!message) continue;

			// Files
			const files = [];
			el.querySelectorAll('[data-testid="file-thumbnail"]').forEach(
				(ft) => {
					const label =
						ft
							.querySelector("button[aria-label]")
							?.getAttribute("aria-label") || "";
					const parts = label.split(",").map((s) => s.trim());
					files.push({
						filename: parts[0] || "unknown",
						ext: parts[1] || "",
						size: parts[2] || "",
					});
				},
			);

			// Artifacts
			const artifacts = [];
			el.querySelectorAll(".artifact-block-cell").forEach((cell) => {
				const title =
					cell.querySelector(".line-clamp-1")?.textContent?.trim() ||
					"Untitled";
				const type =
					cell.querySelector(".text-text-400")?.textContent?.trim() ||
					"";
				const cellFiber = getFiber(cell);
				const file = findProp(cellFiber, "file", 10);
				const props = findProp(cellFiber, "properties", 10);
				artifacts.push({
					title,
					type,
					filename: file?.name || "",
					path: file?.path || props?.id || "",
				});
			});

			const ts = message.created_at
				? new Date(message.created_at).toLocaleString("en-AU", {
						dateStyle: "medium",
						timeStyle: "short",
					})
				: null;
			const uiTs =
				el
					.querySelector("span.text-text-500.text-xs")
					?.textContent?.trim() || null;

			turns.push({
				role:
					message.sender === "human"
						? "user"
						: message.sender === "assistant"
							? "assistant"
							: message.sender,
				content: message.content || [],
				text: message.text || "",
				timestamp: ts,
				uiTimestamp: uiTs,
				files,
				artifacts,
				uuid: message.uuid,
			});
		}

		setStatus(`📦 ${turns.length} turns extracted. Building markdown...`);

		// ── Build markdown ─────────────────────────────────────────────────
		const md = [];
		const allArtifacts = [];
		const seenArt = new Set();

		md.push(`# ${chatTitle}\n`);
		md.push(`> **Source:** ${chatUrl}`);
		md.push(`> **Exported:** ${exportTime}`);
		md.push(`> **Turns:** ${turns.length}\n`);
		md.push("---\n");

		for (let i = 0; i < turns.length; i++) {
			const t = turns[i];
			if (i > 0 && i % 10 === 0)
				setStatus(`📦 Markdown: ${i}/${turns.length}`);

			if (t.role === "user") {
				md.push(
					`## 👤 User${t.uiTimestamp ? " — " + t.uiTimestamp : t.timestamp ? " — " + t.timestamp : ""}\n`,
				);

				if (t.files.length > 0) {
					md.push("**Attached files:**");
					t.files.forEach((f) =>
						md.push(
							`- 📎 \`${f.filename}\`${f.size ? " (" + f.size + ")" : ""}`,
						),
					);
					md.push("");
				}

				// Images in this turn
				const imgs =
					turnEls[i]?.querySelectorAll('img[src*="/files/"]') || [];
				for (const img of imgs) {
					const alt = img.getAttribute("alt") || "image";
					const safe = alt
						.replace(/[^a-zA-Z0-9_.-]/g, "_")
						.substring(0, 80);
					md.push(`![${alt}](images/${safe}.jpg)\n`);
				}

				if (t.text) {
					md.push(t.text.trim() + "\n");
				} else {
					t.content
						.filter((b) => b.type === "text" && b.text)
						.forEach((b) => md.push(b.text.trim() + "\n"));
				}
			} else if (t.role === "assistant") {
				md.push(
					`## 🤖 Claude${t.timestamp ? " — " + t.timestamp : ""}\n`,
				);

				for (const block of t.content) {
					switch (block.type) {
						case "text":
							if (block.text?.trim())
								md.push(block.text.trim() + "\n");
							break;

						case "tool_use":
							md.push(
								`<details><summary>🔧 ${block.message || block.name || "Tool use"}</summary>\n`,
							);
							if (block.input) {
								const s =
									typeof block.input === "string"
										? block.input
										: JSON.stringify(block.input, null, 2);
								if (s.length < 500)
									md.push("```json\n" + s + "\n```\n");
							}
							md.push("</details>\n");
							break;

						case "tool_result":
							md.push(
								`<details><summary>📋 ${block.message || block.name || "Result"}</summary>\n`,
							);
							if (Array.isArray(block.content)) {
								block.content.forEach((item) => {
									if (item.title)
										md.push(`**${item.title}**`);
									if (item.url) md.push(`URL: ${item.url}`);
									md.push("");
								});
							}
							md.push("</details>\n");
							break;

						default:
							if (block.text?.trim())
								md.push(block.text.trim() + "\n");
							if (block.message)
								md.push(`> *${block.message}*\n`);
							break;
					}
				}

				for (const art of t.artifacts) {
					if (!seenArt.has(art.title)) {
						seenArt.add(art.title);
						allArtifacts.push(art);
					}
					md.push(
						`> 📄 **Artifact:** ${art.title}${art.type ? " (" + art.type + ")" : ""}`,
					);
					if (art.filename)
						md.push(`> File: \`artifacts/${art.filename}\``);
					md.push("");
				}
			}
			md.push("---\n");
		}

		if (allArtifacts.length > 0) {
			md.push("## 📑 Artifacts Index\n");
			allArtifacts.forEach((a, i) => {
				md.push(
					`${i + 1}. **${a.title}**${a.type ? " — " + a.type : ""}${a.filename ? " → `artifacts/" + a.filename + "`" : ""}`,
				);
			});
			md.push("");
		}

		const finalMd =
			md
				.join("\n")
				.replace(/\n{3,}/g, "\n\n")
				.trim() + "\n";

		// ── Build manifest.json ────────────────────────────────────────────
		const manifest = {
			chatTitle,
			chatUrl,
			chatId,
			exportTime,
			totalTurns: turns.length,
			artifacts: allArtifacts.map((a) => ({
				title: a.title,
				type: a.type,
				filename: a.filename,
				path: a.path,
			})),
			images: Array.from(
				document.querySelectorAll('img[src*="/files/"]'),
			).map((img) => ({
				alt: img.getAttribute("alt") || "image",
				src: img.getAttribute("src") || "",
			})),
			uploadedFiles: turns.flatMap((t) => t.files),
		};

		// ── Build organize.sh ──────────────────────────────────────────────
		const artifactFilenames = allArtifacts
			.map((a) => a.filename)
			.filter(Boolean);
		const shellScript = `#!/bin/bash
# =============================================================================
# organize.sh — Gather all exported files into one folder
# =============================================================================
# Run this from your Downloads folder (or wherever the files landed).
# It will create a folder named "${safeTitle}" and move everything into it.
# =============================================================================

set -e

FOLDER="${safeTitle}"
ZIP_FILE="${safeTitle}.zip"

echo "📦 Organizing export: $FOLDER"
echo ""

# Create target folder structure
mkdir -p "$FOLDER/artifacts"
mkdir -p "$FOLDER/images"

# Extract ZIP if it exists
if [ -f "$ZIP_FILE" ]; then
  echo "📂 Extracting $ZIP_FILE..."
  unzip -o "$ZIP_FILE" -d "$FOLDER"
  echo "  ✅ ZIP extracted"
else
  echo "⚠️  ZIP file not found: $ZIP_FILE"
  echo "   (If you used the Folder picker, files are already in place)"
fi

# Move artifact files
echo ""
echo "📄 Moving artifact files..."
MOVED=0
MISSING=0
${artifactFilenames
	.map((f) => {
		const safe = f.replace(/'/g, "'\\''");
		return `if [ -f "${safe}" ]; then
  mv "${safe}" "$FOLDER/artifacts/"
  echo "  ✅ ${safe}"
  MOVED=$((MOVED + 1))
else
  echo "  ⚠️  Not found: ${safe}"
  MISSING=$((MISSING + 1))
fi`;
	})
	.join("\n")}

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Done!"
echo "  📂 Folder: $FOLDER/"
echo "  📝 Transcript: $FOLDER/transcript.md"
echo "  📄 Artifacts moved: $MOVED"
if [ $MISSING -gt 0 ]; then
  echo "  ⚠️  Missing: $MISSING (may have different names)"
fi
echo "═══════════════════════════════════════════"
echo ""

# Optionally remove the ZIP
read -p "🗑️  Delete the original ZIP file? [y/N] " REPLY
if [[ "$REPLY" =~ ^[Yy]$ ]]; then
  rm -f "$ZIP_FILE"
  echo "  Deleted $ZIP_FILE"
fi

echo ""
echo "📂 Contents:"
find "$FOLDER" -type f | sort | sed 's/^/  /'
`;

		// ── Write files ────────────────────────────────────────────────────
		setStatus("📝 Writing transcript + manifest + organizer...");
		await writeFile("transcript.md", finalMd);
		await writeFile("manifest.json", JSON.stringify(manifest, null, 2));
		await writeFile("organize.sh", shellScript);

		// ── Download images ────────────────────────────────────────────────
		const chatImages = document.querySelectorAll('img[src*="/files/"]');
		if (chatImages.length > 0) {
			setStatus(`🖼️ Downloading ${chatImages.length} image(s)...`);
			for (const img of chatImages) {
				try {
					const alt = img.getAttribute("alt") || "image";
					const safeName = alt
						.replace(/[^a-zA-Z0-9_.-]/g, "_")
						.substring(0, 80);
					const resp = await fetch(img.getAttribute("src"), {
						credentials: "include",
					});
					const blob = await resp.blob();
					const ext = blob.type.includes("png")
						? ".png"
						: blob.type.includes("gif")
							? ".gif"
							: ".jpg";
					await writeFile("images/" + safeName + ext, blob);
				} catch (e) {
					console.warn("Image failed:", e);
				}
			}
		}

		// ── Finalize ZIP before artifact downloads ─────────────────────────
		await finalizeZip(`${safeTitle}.zip`);

		// Small pause so the ZIP download starts first
		await sleep(800);

		// ── Trigger artifact downloads ─────────────────────────────────────
		const artBtns = document.querySelectorAll(
			'.artifact-block-cell button[aria-label="Download"]',
		);
		const seenBtnTitles = new Set();
		const uniqueBtns = [];
		artBtns.forEach((btn) => {
			const title =
				btn
					.closest(".artifact-block-cell")
					?.querySelector(".line-clamp-1")
					?.textContent?.trim() || "";
			if (!seenBtnTitles.has(title)) {
				seenBtnTitles.add(title);
				uniqueBtns.push({ btn, title });
			}
		});

		if (uniqueBtns.length > 0) {
			setStatus(
				`📥 Downloading ${uniqueBtns.length} artifacts to Downloads folder...`,
			);
			await sleep(500);
			for (let i = 0; i < uniqueBtns.length; i++) {
				setStatus(
					`📥 Artifact ${i + 1}/${uniqueBtns.length}: ${uniqueBtns[i].title}`,
				);
				uniqueBtns[i].btn.click();
				await sleep(500);
			}
			await sleep(500);
		}

		// ── Done ───────────────────────────────────────────────────────────
		const method = useFolder ? "📂 Folder" : "📦 ZIP";
		setStatus(
			[
				`✅ Export complete! (${method})`,
				``,
				`📝 Transcript: ${turns.length} turns`,
				`📄 Artifacts: ${uniqueBtns.length} files`,
				`🖼️ Images: ${chatImages.length}`,
				`📎 Uploaded files referenced: ${manifest.uploadedFiles.length}`,
				``,
				`To organize everything into one folder:`,
				`  cd ~/Downloads`,
				`  chmod +x organize.sh`,
				`  # (extract organize.sh from ZIP first)`,
				`  bash organize.sh`,
			].join("\n"),
		);

		await sleep(15000);
	} catch (err) {
		console.error("Export failed:", err);
		setStatus("❌ " + err.message + "\n\nCheck console for details.");
		await sleep(10000);
	} finally {
		overlay.remove();
	}
})();
