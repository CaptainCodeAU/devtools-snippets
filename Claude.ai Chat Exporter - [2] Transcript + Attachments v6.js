// =============================================================================
// Claude.ai Chat Exporter v6 — Self-contained, API-primary, no external deps
// =============================================================================
// Run on any https://claude.ai/chat/<id> page (console paste or bookmarklet).
//
// WHAT CHANGED FROM v5 (review fixes):
//   [BLOCKING] Removed the JSZip CDN dependency entirely. claude.ai's CSP /
//              service worker blocks external <script src> loads (the v5
//              ERR_INVALID_HANDLE failure). v6 ships a tiny inline ZIP writer
//              (STORE method, no compression — no dependency, works under CSP,
//              works even when the File System Access API is unavailable).
//   [I1] Auto-scroll harvest pass materializes virtualized/off-screen turns
//        so long chats are no longer truncated to the viewport.
//   [I2] The full conversation tree from the internal API is now the PRIMARY
//        content source (it was fetched and thrown away in v5). Fiber/DOM
//        scraping is the validated fallback. DOM is merged in for image src
//        + UI timestamps.
//   [I3] Artifacts are reconstructed by folding create/rewrite/update tool_use
//        blocks, so str_replace-style edits are applied (no more stale files).
//   [I4] Artifact filenames are derived once, deterministically, and the SAME
//        name is used in the transcript refs and the written file.
//   [I5] Images are downloaded BEFORE the markdown is built, so links carry the
//        real extension (.png/.gif/.jpg) instead of a hardcoded .jpg.
//   [I6] Folder picker now runs inside the Export click (preserves the user
//        gesture); clear messaging when the FS API is unavailable.
//   [I7] Model is resolved from the API conversation + per-message data.
//   [I8] Best-effort attempt to fetch the original (non-preview) image asset.
//   [I9] Image filenames are de-duplicated to avoid overwrites.
//   [I10] Removed dead buildHtml parameter.
//   [I11] API-format max_tokens corrected to 8192.
//   [I12] markdownToHtml now handles ordered lists, blockquotes, and tables.
//   [I13] Display-only "Transcript" checkbox no longer references a missing key.
// =============================================================================

(async () => {
	"use strict";

	// ── Persistent Defaults (edit for your preferences) ──────────────────
	const CONFIG = {
		extractArtifacts: true,
		downloadImages: true,
		manifest: true,
		apiFormat: false,
		htmlOutput: true,
		stripSystemReminders: true,
		antArtifactRegex: true,
		imageConcurrency: 5,
		skipPreviouslyExported: false,
		storageMethod: "auto", // "auto" | "folder" | "zip"
	};

	// ── DOM Selectors (update here when Claude changes their UI) ──────────
	const SELECTORS = {
		scrollContainer: '[data-autoscroll-container="true"]',
		turnWrapper: "div[data-test-render-count]",
		fileThumbnail: '[data-testid="file-thumbnail"]',
		chatImage: 'img[src*="/files/"]',
		uiTimestamp: "span.text-text-500.text-xs",
	};

	const SYSTEM_REMINDER_TAGS = [
		"long_conversation_reminder",
		"userPreferences",
		"automated_reminder_from_anthropic",
		"system-reminder",
		"anthropic_reminder",
	];
	const REMINDER_REGEXES = SYSTEM_REMINDER_TAGS.map(
		(tag) => new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, "gi"),
	);

	const ROLE_MAP = { human: "user", assistant: "assistant" };
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

	// ═══════════════════════════════════════════════════════════════════════
	//  INLINE ZIP WRITER (STORE / no compression) — replaces JSZip
	// ═══════════════════════════════════════════════════════════════════════
	const CRC_TABLE = (() => {
		const t = new Uint32Array(256);
		for (let n = 0; n < 256; n++) {
			let c = n;
			for (let k = 0; k < 8; k++)
				c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
			t[n] = c >>> 0;
		}
		return t;
	})();

	function crc32(bytes) {
		let c = 0xffffffff;
		for (let i = 0; i < bytes.length; i++)
			c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
		return (c ^ 0xffffffff) >>> 0;
	}

	function dosDateTime(d) {
		const time =
			(d.getHours() << 11) |
			(d.getMinutes() << 5) |
			(d.getSeconds() >> 1);
		const date =
			((d.getFullYear() - 1980) << 9) |
			((d.getMonth() + 1) << 5) |
			d.getDate();
		return { time: time & 0xffff, date: date & 0xffff };
	}

	// files: [{ name: string, bytes: Uint8Array }]
	function buildZip(files) {
		const enc = new TextEncoder();
		const chunks = [];
		const central = [];
		let offset = 0;
		const { time, date } = dosDateTime(new Date());

		for (const f of files) {
			const nameBytes = enc.encode(f.name);
			const crc = crc32(f.bytes);
			const size = f.bytes.length;

			const lh = new Uint8Array(30 + nameBytes.length);
			const ldv = new DataView(lh.buffer);
			ldv.setUint32(0, 0x04034b50, true);
			ldv.setUint16(4, 20, true); // version needed
			ldv.setUint16(6, 0x0800, true); // flags: UTF-8 filename
			ldv.setUint16(8, 0, true); // method: STORE
			ldv.setUint16(10, time, true);
			ldv.setUint16(12, date, true);
			ldv.setUint32(14, crc, true);
			ldv.setUint32(18, size, true); // compressed size
			ldv.setUint32(22, size, true); // uncompressed size
			ldv.setUint16(26, nameBytes.length, true);
			ldv.setUint16(28, 0, true); // extra length
			lh.set(nameBytes, 30);
			chunks.push(lh, f.bytes);

			const cd = new Uint8Array(46 + nameBytes.length);
			const cdv = new DataView(cd.buffer);
			cdv.setUint32(0, 0x02014b50, true);
			cdv.setUint16(4, 20, true); // version made by
			cdv.setUint16(6, 20, true); // version needed
			cdv.setUint16(8, 0x0800, true); // flags
			cdv.setUint16(10, 0, true); // method
			cdv.setUint16(12, time, true);
			cdv.setUint16(14, date, true);
			cdv.setUint32(16, crc, true);
			cdv.setUint32(20, size, true);
			cdv.setUint32(24, size, true);
			cdv.setUint16(28, nameBytes.length, true);
			cdv.setUint16(30, 0, true); // extra
			cdv.setUint16(32, 0, true); // comment
			cdv.setUint16(34, 0, true); // disk start
			cdv.setUint16(36, 0, true); // internal attrs
			cdv.setUint32(38, 0, true); // external attrs
			cdv.setUint32(42, offset, true); // local header offset
			cd.set(nameBytes, 46);
			central.push(cd);

			offset += lh.length + size;
		}

		const cdStart = offset;
		let cdSize = 0;
		for (const c of central) {
			chunks.push(c);
			cdSize += c.length;
		}

		const eocd = new Uint8Array(22);
		const edv = new DataView(eocd.buffer);
		edv.setUint32(0, 0x06054b50, true);
		edv.setUint16(4, 0, true); // disk number
		edv.setUint16(6, 0, true); // disk with CD
		edv.setUint16(8, files.length, true);
		edv.setUint16(10, files.length, true);
		edv.setUint32(12, cdSize, true);
		edv.setUint32(16, cdStart, true);
		edv.setUint16(20, 0, true); // comment length
		chunks.push(eocd);

		let total = 0;
		for (const c of chunks) total += c.length;
		const out = new Uint8Array(total);
		let p = 0;
		for (const c of chunks) {
			out.set(c, p);
			p += c.length;
		}
		return new Blob([out], { type: "application/zip" });
	}

	async function toBytes(content) {
		if (content instanceof Blob)
			return new Uint8Array(await content.arrayBuffer());
		if (content instanceof Uint8Array) return content;
		if (content instanceof ArrayBuffer) return new Uint8Array(content);
		return new TextEncoder().encode(
			typeof content === "string" ? content : String(content),
		);
	}

	// ── Config Popup ──────────────────────────────────────────────────────
	function showConfigPopup(defaults) {
		return new Promise((resolve, reject) => {
			const cfg = structuredClone(defaults);

			const backdrop = document.createElement("div");
			Object.assign(backdrop.style, {
				position: "fixed",
				inset: "0",
				background: "rgba(0,0,0,0.5)",
				zIndex: "999998",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			});

			const modal = document.createElement("div");
			Object.assign(modal.style, {
				background: "#1a1a2e",
				color: "#e0e0e0",
				borderRadius: "12px",
				fontFamily: "system-ui, sans-serif",
				fontSize: "14px",
				width: "480px",
				maxHeight: "80vh",
				overflowY: "auto",
				padding: "24px",
				border: "1px solid #333",
				boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
				lineHeight: "1.6",
			});

			const title = document.createElement("h2");
			Object.assign(title.style, {
				margin: "0 0 16px 0",
				fontSize: "18px",
				color: "#8a8aff",
				borderBottom: "1px solid #333",
				paddingBottom: "12px",
			});
			title.textContent = "Claude Chat Exporter v6";
			modal.appendChild(title);

			function createFieldset(legendText) {
				const fs = document.createElement("fieldset");
				Object.assign(fs.style, {
					border: "1px solid #444",
					borderRadius: "8px",
					padding: "12px 16px",
					marginBottom: "16px",
				});
				const legend = document.createElement("legend");
				Object.assign(legend.style, {
					color: "#8a8aff",
					fontWeight: "bold",
					padding: "0 8px",
					fontSize: "13px",
				});
				legend.textContent = legendText;
				fs.appendChild(legend);
				return fs;
			}

			// `key === null` → display-only checkbox (always on, reads nothing)
			function addCheckbox(parent, key, label, alwaysOn = false) {
				const lbl = document.createElement("label");
				Object.assign(lbl.style, {
					display: "flex",
					alignItems: "center",
					gap: "8px",
					margin: "6px 0",
					cursor: alwaysOn ? "default" : "pointer",
					opacity: alwaysOn ? "0.5" : "1",
				});
				const inp = document.createElement("input");
				inp.type = "checkbox";
				inp.checked = alwaysOn ? true : cfg[key];
				inp.disabled = alwaysOn;
				Object.assign(inp.style, { accentColor: "#4a6cf7" });
				if (!alwaysOn && key) {
					inp.addEventListener("change", () => {
						cfg[key] = inp.checked;
					});
				}
				lbl.appendChild(inp);
				lbl.appendChild(document.createTextNode(label));
				parent.appendChild(lbl);
			}

			function addNumberInput(parent, key, label, min, max) {
				const row = document.createElement("div");
				Object.assign(row.style, {
					display: "flex",
					alignItems: "center",
					gap: "8px",
					margin: "6px 0",
				});
				const lbl = document.createElement("span");
				lbl.textContent = label;
				const inp = document.createElement("input");
				inp.type = "number";
				inp.value = cfg[key];
				inp.min = min;
				inp.max = max;
				Object.assign(inp.style, {
					width: "60px",
					background: "#111",
					color: "#e0e0e0",
					border: "1px solid #555",
					borderRadius: "4px",
					padding: "4px 8px",
					fontSize: "14px",
				});
				inp.addEventListener("change", () => {
					cfg[key] = Math.max(
						min,
						Math.min(max, parseInt(inp.value) || min),
					);
					inp.value = cfg[key];
				});
				row.appendChild(lbl);
				row.appendChild(inp);
				parent.appendChild(row);
			}

			function addRadioGroup(parent, key, options) {
				for (const [value, label] of options) {
					const lbl = document.createElement("label");
					Object.assign(lbl.style, {
						display: "flex",
						alignItems: "center",
						gap: "8px",
						margin: "6px 0",
						cursor: "pointer",
					});
					const inp = document.createElement("input");
					inp.type = "radio";
					inp.name = key;
					inp.value = value;
					inp.checked = cfg[key] === value;
					Object.assign(inp.style, { accentColor: "#4a6cf7" });
					inp.addEventListener("change", () => {
						if (inp.checked) cfg[key] = value;
					});
					lbl.appendChild(inp);
					lbl.appendChild(document.createTextNode(label));
					parent.appendChild(lbl);
				}
			}

			const fsOutput = createFieldset("Output Formats");
			addCheckbox(fsOutput, null, "Transcript (markdown)", true);
			addCheckbox(fsOutput, "extractArtifacts", "Artifacts extraction");
			addCheckbox(fsOutput, "downloadImages", "Images download");
			addCheckbox(fsOutput, "manifest", "Manifest (JSON)");
			addCheckbox(fsOutput, "apiFormat", "API-compatible format");
			addCheckbox(fsOutput, "htmlOutput", "HTML output");
			modal.appendChild(fsOutput);

			const fsProcessing = createFieldset("Processing");
			addCheckbox(
				fsProcessing,
				"stripSystemReminders",
				"Strip system reminders",
			);
			addCheckbox(
				fsProcessing,
				"antArtifactRegex",
				"antArtifact regex extraction",
			);
			addNumberInput(
				fsProcessing,
				"imageConcurrency",
				"Image concurrency:",
				1,
				20,
			);
			modal.appendChild(fsProcessing);

			const fsBehavior = createFieldset("Export Behavior");
			addCheckbox(
				fsBehavior,
				"skipPreviouslyExported",
				"Skip previously exported",
			);
			addRadioGroup(fsBehavior, "storageMethod", [
				["auto", "Auto (folder → ZIP fallback)"],
				["folder", "Force folder"],
				["zip", "Force ZIP"],
			]);
			modal.appendChild(fsBehavior);

			const note = document.createElement("div");
			Object.assign(note.style, {
				fontSize: "12px",
				color: "#888",
				marginBottom: "12px",
			});
			note.textContent =
				"ZIP is built locally (no external libraries). Folder mode needs a Chromium browser and a click on Export.";
			modal.appendChild(note);

			const status = document.createElement("div");
			Object.assign(status.style, {
				fontSize: "12px",
				color: "#ff9f43",
				minHeight: "16px",
				marginBottom: "8px",
			});
			modal.appendChild(status);

			const btnRow = document.createElement("div");
			Object.assign(btnRow.style, {
				display: "flex",
				justifyContent: "flex-end",
				gap: "12px",
				marginTop: "8px",
				borderTop: "1px solid #333",
				paddingTop: "16px",
			});

			const cancelBtn = document.createElement("button");
			cancelBtn.textContent = "Cancel";
			Object.assign(cancelBtn.style, {
				background: "transparent",
				border: "1px solid #555",
				color: "#e0e0e0",
				padding: "8px 20px",
				borderRadius: "6px",
				cursor: "pointer",
				fontSize: "14px",
			});

			const exportBtn = document.createElement("button");
			exportBtn.textContent = "Export";
			Object.assign(exportBtn.style, {
				background: "#4a6cf7",
				border: "none",
				color: "white",
				padding: "8px 24px",
				borderRadius: "6px",
				cursor: "pointer",
				fontSize: "14px",
				fontWeight: "bold",
			});

			const cleanup = () =>
				document.removeEventListener("keydown", keyHandler);

			// Folder picker MUST run inside this click handler to keep the user
			// gesture (fixes the silent v5 fallback / activation loss).
			const doExport = async () => {
				exportBtn.disabled = true;
				cfg._useFolder = false;
				cfg._parentHandle = null;

				const wantsFolder =
					cfg.storageMethod === "folder" ||
					cfg.storageMethod === "auto";
				if (wantsFolder) {
					if (window.showDirectoryPicker) {
						try {
							cfg._parentHandle =
								await window.showDirectoryPicker({
									mode: "readwrite",
								});
							cfg._useFolder = true;
						} catch (e) {
							if (cfg.storageMethod === "folder") {
								status.textContent =
									e.name === "AbortError"
										? "Folder selection cancelled — pick a folder or switch to ZIP."
										: "Folder access failed: " + e.message;
								exportBtn.disabled = false;
								return;
							}
							// auto → fall through to local ZIP
						}
					} else if (cfg.storageMethod === "folder") {
						status.textContent =
							"This browser has no File System Access API. Switch to ZIP.";
						exportBtn.disabled = false;
						return;
					}
				}

				backdrop.remove();
				cleanup();
				resolve(cfg);
			};

			const doCancel = () => {
				backdrop.remove();
				cleanup();
				reject(new Error("Cancelled"));
			};

			exportBtn.addEventListener("click", doExport);
			cancelBtn.addEventListener("click", doCancel);

			const keyHandler = (e) => {
				if (e.key === "Escape") doCancel();
			};
			document.addEventListener("keydown", keyHandler);

			btnRow.appendChild(cancelBtn);
			btnRow.appendChild(exportBtn);
			modal.appendChild(btnRow);

			backdrop.appendChild(modal);
			document.body.appendChild(backdrop);
			exportBtn.focus();
		});
	}

	// ── Text helpers ────────────────────────────────────────────────────
	function stripReminders(text) {
		if (!text) return text;
		let out = text;
		for (const re of REMINDER_REGEXES) {
			re.lastIndex = 0;
			out = out.replace(re, "");
		}
		return out.trim();
	}

	function escHtml(s) {
		return String(s || "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}

	// ── markdownToHtml (now: ordered lists, blockquotes, tables) [I12] ────
	function markdownToHtml(md) {
		if (!md) return "";
		let html = escHtml(md);

		const codeBlocks = [];
		html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
			const idx = codeBlocks.length;
			codeBlocks.push(
				`<pre><code class="${lang ? "language-" + lang : ""}">${code.trim()}</code></pre>`,
			);
			return `%%CODEBLOCK_${idx}%%`;
		});

		// Tables (GFM): header row, separator row, body rows
		html = html.replace(
			/(^\|.+\|[ \t]*\n\|[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|[ \t]*\n(?:\|.*\|[ \t]*\n?)*)/gm,
			(block) => {
				const rows = block.trim().split("\n");
				if (rows.length < 2) return block;
				const cells = (r) =>
					r
						.replace(/^\||\|$/g, "")
						.split("|")
						.map((c) => c.trim());
				const head = cells(rows[0]);
				const body = rows.slice(2).map(cells);
				let t = "<table><thead><tr>";
				head.forEach((h) => (t += `<th>${h}</th>`));
				t += "</tr></thead><tbody>";
				body.forEach((r) => {
					t += "<tr>";
					r.forEach((c) => (t += `<td>${c}</td>`));
					t += "</tr>";
				});
				t += "</tbody></table>";
				return t;
			},
		);

		html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
		html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
		html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
		html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
			if (/^(https?:\/\/|\/)/i.test(url))
				return `<a href="${url}" target="_blank">${text}</a>`;
			return `${text} (${url})`;
		});

		html = html.replace(/^#{4}\s+(.+)$/gm, "<h5>$1</h5>");
		html = html.replace(/^#{3}\s+(.+)$/gm, "<h4>$1</h4>");
		html = html.replace(/^#{2}\s+(.+)$/gm, "<h3>$1</h3>");
		html = html.replace(/^#{1}\s+(.+)$/gm, "<h2>$1</h2>");

		// Blockquotes
		html = html.replace(/(^>\s?.*(?:\n>\s?.*)*)/gm, (block) => {
			const inner = block.replace(/^>\s?/gm, "");
			return `<blockquote>${inner}</blockquote>`;
		});

		// Ordered lists
		html = html.replace(/^(\d+)\.\s+(.+)$/gm, "<oli>$2</oli>");
		html = html.replace(/(<oli>.*<\/oli>\n?)+/g, (m) => {
			return `<ol>${m.replace(/oli>/g, "li>")}</ol>`;
		});

		// Unordered lists
		html = html.replace(/^[-*]\s+(.+)$/gm, "<uli>$1</uli>");
		html = html.replace(/(<uli>.*<\/uli>\n?)+/g, (m) => {
			return `<ul>${m.replace(/uli>/g, "li>")}</ul>`;
		});

		html = html
			.split(/\n{2,}/)
			.map((p) => {
				const t = p.trim();
				if (!t) return "";
				if (
					t.startsWith("<h") ||
					t.startsWith("<pre") ||
					t.startsWith("<ul") ||
					t.startsWith("<ol") ||
					t.startsWith("<table") ||
					t.startsWith("<blockquote") ||
					t.startsWith("%%CODEBLOCK")
				)
					return t;
				return `<p>${t.replace(/\n/g, "<br>")}</p>`;
			})
			.join("\n");

		for (let i = 0; i < codeBlocks.length; i++)
			html = html.replace(`%%CODEBLOCK_${i}%%`, codeBlocks[i]);

		return html;
	}

	// ── React fiber helpers ───────────────────────────────────────────────
	let cachedFiberKey = null;
	const getFiber = (el) => {
		if (cachedFiberKey && el[cachedFiberKey]) return el[cachedFiberKey];
		const k = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
		if (k) {
			cachedFiberKey = k;
			return el[k];
		}
		return null;
	};

	const findPropDown = (fiber, name, maxD = 30) => {
		const queue = [{ f: fiber, d: 0 }];
		let qi = 0;
		while (qi < queue.length) {
			const { f, d } = queue[qi++];
			if (!f || d > maxD) continue;
			if (f.memoizedProps?.[name] !== undefined)
				return f.memoizedProps[name];
			if (f.child) queue.push({ f: f.child, d: d + 1 });
			if (f.sibling && d > 0) queue.push({ f: f.sibling, d });
		}
	};

	// ── API fetch ─────────────────────────────────────────────────────────
	async function fetchConversationData(chatId) {
		try {
			const orgId = document.cookie.match(/lastActiveOrg=([^;]+)/)?.[1];
			if (!orgId || !chatId) return null;
			const resp = await fetch(
				`/api/organizations/${decodeURIComponent(orgId)}/chat_conversations/${chatId}?tree=true&rendering_mode=messages&render_all_tools=true`,
				{
					credentials: "include",
					headers: { "Content-Type": "application/json" },
				},
			);
			if (!resp.ok) {
				console.warn(`[v6] API fetch failed: ${resp.status}`);
				return null;
			}
			return await resp.json();
		} catch (e) {
			console.warn("[v6] API fetch error:", e.message);
			return null;
		}
	}

	// Pull a linear, ordered message list out of the API response, tolerating
	// shape differences. Returns [] if nothing usable is found.
	function extractApiMessages(apiData) {
		if (!apiData) return [];
		const arr = apiData.chat_messages || apiData.messages;
		if (!Array.isArray(arr) || arr.length === 0) return [];
		const copy = arr.slice();
		// Order by `index` if present, otherwise by created_at, else as-is.
		if (copy.every((m) => typeof m.index === "number")) {
			copy.sort((a, b) => a.index - b.index);
		} else if (copy.every((m) => m.created_at)) {
			copy.sort(
				(a, b) => new Date(a.created_at) - new Date(b.created_at),
			);
		}
		return copy;
	}

	function apiModelOf(apiData, messages) {
		if (apiData?.model) return apiData.model;
		for (const m of messages || []) {
			if (m.model) return m.model;
		}
		return null;
	}

	function fmtTs(iso) {
		if (!iso) return null;
		try {
			return new Date(iso).toLocaleString("en-AU", {
				dateStyle: "medium",
				timeStyle: "short",
			});
		} catch {
			return null;
		}
	}

	// ── Main Flow ─────────────────────────────────────────────────────────
	let cfg;
	try {
		cfg = await showConfigPopup(CONFIG);
	} catch {
		console.log("[v6] Export cancelled by user");
		return;
	}
	console.log(
		"[v6] Config:",
		JSON.stringify(cfg, (k, v) => (k.startsWith("_") ? undefined : v), 2),
	);

	const chatUrl = window.location.href;
	const chatId = chatUrl.match(/\/chat\/([a-f0-9-]+)/)?.[1] || "unknown";
	const chatTitle =
		document.title.replace(/ - Claude$/, "").trim() || "Untitled Chat";
	const safeTitle = chatTitle
		.replace(/[^a-zA-Z0-9_-]/g, "_")
		.substring(0, 60);
	const exportTime = new Date().toISOString();

	// ── Resume check ────────────────────────────────────────────────────
	if (cfg.skipPreviouslyExported && chatId !== "unknown") {
		const history = JSON.parse(
			localStorage.getItem("claude_export_history") || "{}",
		);
		if (history[chatId]) {
			const prev = history[chatId].exportedAt;
			const skip = await new Promise((resolve) => {
				const banner = document.createElement("div");
				Object.assign(banner.style, {
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
				});
				banner.textContent = `This chat was exported on ${new Date(prev).toLocaleString()}. Export again?`;
				const row = document.createElement("div");
				Object.assign(row.style, {
					display: "flex",
					gap: "12px",
					marginTop: "12px",
					justifyContent: "flex-end",
				});
				const yes = document.createElement("button");
				yes.textContent = "Yes, export again";
				Object.assign(yes.style, {
					background: "#4a6cf7",
					border: "none",
					color: "white",
					padding: "6px 16px",
					borderRadius: "6px",
					cursor: "pointer",
					fontSize: "13px",
				});
				const no = document.createElement("button");
				no.textContent = "Skip";
				Object.assign(no.style, {
					background: "transparent",
					border: "1px solid #555",
					color: "#e0e0e0",
					padding: "6px 16px",
					borderRadius: "6px",
					cursor: "pointer",
					fontSize: "13px",
				});
				yes.addEventListener("click", () => {
					banner.remove();
					resolve(false);
				});
				no.addEventListener("click", () => {
					banner.remove();
					resolve(true);
				});
				row.appendChild(no);
				row.appendChild(yes);
				banner.appendChild(row);
				document.body.appendChild(banner);
			});
			if (skip) {
				console.log("[v6] Skipped — previously exported");
				return;
			}
		}
	}

	// ── Status overlay ─────────────────────────────────────────────────
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

	try {
		// ── Storage ───────────────────────────────────────────────────────
		const useFolder = !!cfg._useFolder;
		let folderHandle = null;
		const zipFiles = [];

		if (useFolder) {
			const safeName = chatTitle
				.replace(/[^a-zA-Z0-9 _-]/g, "_")
				.substring(0, 80);
			folderHandle = await cfg._parentHandle.getDirectoryHandle(
				safeName,
				{
					create: true,
				},
			);
			setStatus(`📂 Writing to folder: ${safeName}/`);
		} else {
			setStatus("📦 Using local ZIP writer (no external libraries)");
		}
		console.log(
			`[v6] Storage: ${useFolder ? "File System Access (folder)" : "inline ZIP"}`,
		);

		const writeFile = async (path, content) => {
			if (useFolder) {
				const parts = path.split("/");
				let dir = folderHandle;
				for (let i = 0; i < parts.length - 1; i++)
					dir = await dir.getDirectoryHandle(parts[i], {
						create: true,
					});
				const fh = await dir.getFileHandle(parts[parts.length - 1], {
					create: true,
				});
				const w = await fh.createWritable();
				await w.write(content);
				await w.close();
			} else {
				zipFiles.push({ name: path, bytes: await toBytes(content) });
			}
		};

		// ── Fetch API tree ────────────────────────────────────────────────
		setStatus("🔍 Fetching conversation from API...");
		const apiData = await fetchConversationData(chatId);
		const apiMessages = extractApiMessages(apiData);
		const apiModel = apiModelOf(apiData, apiMessages);
		console.log(
			`[v6] API: ${apiData ? "ok" : "unavailable"}, messages: ${apiMessages.length}, model: ${apiModel || "unknown"}`,
		);

		// ── Auto-scroll harvest (materialize virtualized turns) [I1] ────────
		const scrollContainer = document.querySelector(
			SELECTORS.scrollContainer,
		);
		const domByUuid = new Map();
		const domOrder = [];

		const recordVisible = () => {
			if (!scrollContainer) return;
			const els = scrollContainer.querySelectorAll(SELECTORS.turnWrapper);
			for (const el of els) {
				const fiber = getFiber(el);
				if (!fiber) continue;
				const message = findPropDown(fiber, "message", 30);
				if (!message || !message.uuid) continue;

				const images = [];
				el.querySelectorAll(SELECTORS.chatImage).forEach((img) => {
					const alt = img.getAttribute("alt") || "image";
					const src = img.getAttribute("src") || "";
					if (!src) return;
					images.push({ alt, src });
				});

				const files = [];
				el.querySelectorAll(SELECTORS.fileThumbnail).forEach((ft) => {
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
				});

				const uiTs =
					el
						.querySelector(SELECTORS.uiTimestamp)
						?.textContent?.trim() || null;

				const existing = domByUuid.get(message.uuid);
				if (existing) {
					// Refresh with richer data if a later pass rendered more.
					if (images.length) existing.images = images;
					if (files.length) existing.files = files;
					if (uiTs) existing.uiTs = uiTs;
					if (
						!existing.message?.content?.length &&
						message.content?.length
					)
						existing.message = message;
				} else {
					domByUuid.set(message.uuid, {
						message,
						images,
						files,
						uiTs,
					});
					domOrder.push(message.uuid);
				}
			}
		};

		if (scrollContainer) {
			setStatus("📜 Scrolling to load the full conversation...");
			const originalScroll = scrollContainer.scrollTop;
			scrollContainer.scrollTop = 0;
			await sleep(400);
			recordVisible();

			let guard = 0;
			let lastTop = -1;
			const step = Math.max(200, scrollContainer.clientHeight * 0.8);
			while (guard++ < 2000) {
				const atBottom =
					scrollContainer.scrollTop >=
					scrollContainer.scrollHeight -
						scrollContainer.clientHeight -
						4;
				recordVisible();
				if (atBottom) break;
				scrollContainer.scrollTop = Math.min(
					scrollContainer.scrollTop + step,
					scrollContainer.scrollHeight,
				);
				await sleep(220);
				if (scrollContainer.scrollTop === lastTop) {
					await sleep(300);
					if (
						scrollContainer.scrollTop >=
						scrollContainer.scrollHeight -
							scrollContainer.clientHeight -
							4
					)
						break;
				}
				lastTop = scrollContainer.scrollTop;
			}
			recordVisible();
			scrollContainer.scrollTop = originalScroll;
			console.log(
				`[v6] Harvested ${domByUuid.size} turn(s) from DOM after scroll`,
			);
		} else {
			console.warn(
				"[v6] No scroll container found — relying on API only",
			);
		}

		// ── Build unified turns: API primary, DOM fallback [I2] ─────────────
		let turns;
		let source;
		if (apiMessages.length > 0) {
			source = "api";
			turns = apiMessages.map((m) => {
				const dom = domByUuid.get(m.uuid) || {};
				const apiFiles = (
					m.files ||
					m.attachments ||
					m.files_v2 ||
					[]
				).map((f) => ({
					filename: f.file_name || f.name || f.title || "file",
					ext: "",
					size: f.file_size || f.size || "",
				}));
				return {
					role: ROLE_MAP[m.sender] || m.sender,
					content: Array.isArray(m.content) ? m.content : [],
					text: m.text || "",
					timestamp: fmtTs(m.created_at),
					uiTimestamp: dom.uiTs || null,
					files: apiFiles.length ? apiFiles : dom.files || [],
					images: dom.images || [],
					uuid: m.uuid,
				};
			});
		} else if (domOrder.length > 0) {
			source = "dom-fallback";
			turns = domOrder.map((uuid) => {
				const { message, images, files, uiTs } = domByUuid.get(uuid);
				return {
					role: ROLE_MAP[message.sender] || message.sender,
					content: Array.isArray(message.content)
						? message.content
						: [],
					text: message.text || "",
					timestamp: fmtTs(message.created_at),
					uiTimestamp: uiTs,
					files: files || [],
					images: images || [],
					uuid,
				};
			});
		} else {
			throw new Error(
				"Could not read any messages from the API or the DOM. The page layout or API shape may have changed — update SELECTORS / extractApiMessages().",
			);
		}
		console.log(`[v6] Source: ${source} | turns: ${turns.length}`);

		// ── Strip reminders ─────────────────────────────────────────────────
		if (cfg.stripSystemReminders) {
			let stripped = 0;
			for (const turn of turns) {
				if (turn.role !== "user") continue;
				const before = turn.text;
				turn.text = stripReminders(turn.text);
				for (const block of turn.content) {
					if (block.type === "text" && block.text)
						block.text = stripReminders(block.text);
				}
				if (turn.text !== before) stripped++;
			}
			console.log(
				`[v6] Stripped reminders from ${stripped} user turn(s)`,
			);
		}

		// ── Reconstruct artifacts (fold create/rewrite/update) [I3][I4] ─────
		const EXT_BY_TYPE = {
			"application/vnd.ant.code": null,
			"application/vnd.ant.react": "jsx",
			"application/vnd.ant.html": "html",
			"application/vnd.ant.mermaid": "mermaid",
			"application/vnd.ant.svg": "svg",
			"image/svg+xml": "svg",
			"text/html": "html",
			"text/markdown": "md",
			"application/vnd.ant.markdown": "md",
		};
		const LANG_EXT = {
			python: "py",
			javascript: "js",
			typescript: "ts",
			ruby: "rb",
			rust: "rs",
			golang: "go",
			go: "go",
			java: "java",
			cpp: "cpp",
			"c++": "cpp",
			csharp: "cs",
			"c#": "cs",
			swift: "swift",
			kotlin: "kt",
			php: "php",
			shell: "sh",
			bash: "sh",
			sql: "sql",
			css: "css",
			scss: "scss",
			yaml: "yaml",
			json: "json",
			xml: "xml",
			toml: "toml",
		};

		const artifactMap = new Map(); // id -> {id,title,type,language,content,versions}
		if (cfg.extractArtifacts) {
			for (const t of turns) {
				if (t.role !== "assistant") continue;
				for (const block of t.content) {
					if (block.type !== "tool_use" || !block.input) continue;
					const inp = block.input;
					// `command` alone is a weak signal — bash_tool also has `command`.
					// Treat as a claude.ai artifact only for the real artifact commands
					// or an explicit identifier.
					const ARTIFACT_CMDS = new Set([
						"create",
						"update",
						"rewrite",
					]);
					const isArtifact =
						block.name === "artifacts" ||
						(inp.command && ARTIFACT_CMDS.has(inp.command)) ||
						inp.identifier != null ||
						(inp.id != null && inp.content != null);

					if (!isArtifact) {
						// File-producing computer tools, keyed by path so create_file +
						// subsequent str_replace edits fold into one final file [I3-for-files].
						const hasFileText = inp.file_text != null;
						const oldS = inp.old_str ?? inp.oldStr;
						const newS = inp.new_str ?? inp.newStr;
						const hasEdit = oldS != null || newS != null;
						if (!hasFileText && !hasEdit) continue;

						const p =
							inp.path ||
							inp.file_path ||
							inp.file_name ||
							inp.filename ||
							null;
						const key =
							"file:" + (p || `file_${artifactMap.size + 1}`);
						const baseName = (
							p ||
							inp.title ||
							key.slice(5)
						).replace(/.*\//, "");
						let rec = artifactMap.get(key);

						if (hasFileText) {
							rec = {
								id: key,
								title: baseName,
								path: p || baseName,
								type: inp.type || "",
								language: inp.language || "",
								content: inp.file_text,
								versions: (rec?.versions || 0) + 1,
							};
							artifactMap.set(key, rec);
						} else if (
							hasEdit &&
							rec &&
							oldS != null &&
							rec.content.includes(oldS)
						) {
							rec.content = rec.content.replace(oldS, newS ?? "");
							rec.versions++;
						}
						continue;
					}

					const id =
						inp.id ||
						inp.identifier ||
						inp.title ||
						`artifact_${artifactMap.size + 1}`;
					const cmd =
						inp.command || (inp.content != null ? "create" : null);
					let rec = artifactMap.get(id);

					if (
						cmd === "create" ||
						cmd === "rewrite" ||
						(!rec && inp.content != null)
					) {
						rec = {
							id,
							title: inp.title || rec?.title || id,
							type: inp.type || rec?.type || "",
							language: inp.language || rec?.language || "",
							content:
								inp.content != null
									? inp.content
									: rec?.content || "",
							versions: (rec?.versions || 0) + 1,
						};
						artifactMap.set(id, rec);
					} else if (cmd === "update" && rec) {
						const oldS = inp.old_str ?? inp.oldStr;
						const newS = inp.new_str ?? inp.newStr ?? "";
						if (oldS != null && rec.content.includes(oldS))
							rec.content = rec.content.replace(oldS, newS);
						if (inp.title) rec.title = inp.title;
						rec.versions++;
					} else if (rec && inp.content != null) {
						rec.content = inp.content;
						rec.versions++;
					}
				}
			}

			// antArtifact regex supplement (only adds ids not already reconstructed)
			if (cfg.antArtifactRegex) {
				const ARTIFACT_RE =
					/<antArtifact\s+([^>]*?)>([\s\S]*?)<\/antArtifact>/gi;
				const ATTR_RE = /(\w+)="([^"]*)"/g;
				let added = 0;
				for (const t of turns) {
					if (t.role !== "assistant") continue;
					for (const block of t.content) {
						if (block.type !== "text" || !block.text) continue;
						ARTIFACT_RE.lastIndex = 0;
						let m;
						while ((m = ARTIFACT_RE.exec(block.text)) !== null) {
							const attrs = {};
							let am;
							ATTR_RE.lastIndex = 0;
							while ((am = ATTR_RE.exec(m[1])) !== null)
								attrs[am[1]] = am[2];
							const id =
								attrs.identifier ||
								`regex_artifact_${artifactMap.size + 1}`;
							if (artifactMap.has(id)) continue;
							artifactMap.set(id, {
								id,
								title: attrs.title || id,
								type: attrs.type || "text/plain",
								language: attrs.language || "",
								content: m[2],
								versions: 1,
							});
							added++;
						}
					}
				}
				if (added) console.log(`[v6] Regex added ${added} artifact(s)`);
			}
		}

		// Assign deterministic, unique filenames + folder [I4]
		const usedNames = { artifacts: new Set(), files: new Set() };
		for (const rec of artifactMap.values()) {
			rec.folder = rec.path ? "files" : "artifacts";
			let name;
			if (rec.path) {
				// File-tool output: the path basename already carries the right extension.
				name =
					rec.path
						.replace(/.*\//, "")
						.replace(/[^a-zA-Z0-9_.-]/g, "_")
						.substring(0, 120) || "file";
			} else {
				let ext = EXT_BY_TYPE[rec.type];
				if (ext === null || ext === undefined)
					ext =
						LANG_EXT[(rec.language || "").toLowerCase()] ||
						rec.language ||
						"txt";
				let base = (rec.title || rec.id || "artifact")
					.replace(/.*\//, "")
					.replace(/[^a-zA-Z0-9_.-]/g, "_")
					.substring(0, 100);
				if (base.toLowerCase().endsWith("." + ext.toLowerCase()))
					base = base.slice(0, -(ext.length + 1));
				name = `${base}.${ext}`;
			}
			// De-dupe within the folder while preserving the extension.
			const dot = name.lastIndexOf(".");
			const stem = dot > 0 ? name.slice(0, dot) : name;
			const xt = dot > 0 ? name.slice(dot) : "";
			const used = usedNames[rec.folder];
			let finalName = name;
			let n = 2;
			while (used.has(finalName)) finalName = `${stem}_${n++}${xt}`;
			used.add(finalName);
			rec.fileName = finalName;
			rec.exportPath = `${rec.folder}/${finalName}`;
		}
		const artifactFiles = Array.from(artifactMap.values());
		console.log(`[v6] Reconstructed ${artifactFiles.length} artifact(s)`);

		// ── Collect + de-duplicate images [I9] ──────────────────────────────
		const allImages = [];
		const usedImgNames = new Set();
		for (const t of turns) {
			for (const img of t.images) {
				let base =
					(img.alt || "image")
						.replace(/[^a-zA-Z0-9_.-]/g, "_")
						.substring(0, 80) || "image";
				let safeName = base;
				let n = 2;
				while (usedImgNames.has(safeName)) safeName = `${base}_${n++}`;
				usedImgNames.add(safeName);
				img.safeName = safeName;
				allImages.push(img);
			}
		}

		// ── Download images BEFORE building markdown [I5] ────────────────────
		if (cfg.downloadImages && allImages.length > 0) {
			setStatus(`🖼️ Downloading ${allImages.length} image(s)...`);
			const concurrency = cfg.imageConcurrency;
			for (let i = 0; i < allImages.length; i += concurrency) {
				const batch = allImages.slice(i, i + concurrency);
				await Promise.all(
					batch.map(async (img) => {
						// [I8] best-effort: strip preview/resize params for the original
						const candidates = [img.src];
						const stripped = img.src.replace(
							/(\?|&)(w|h|q|fm|dpr|fit|preview)=[^&]*/gi,
							"",
						);
						if (stripped !== img.src) candidates.unshift(stripped);
						for (const url of candidates) {
							try {
								const resp = await fetch(url, {
									credentials: "include",
								});
								if (!resp.ok) continue;
								const blob = await resp.blob();
								img.ext = blob.type.includes("png")
									? ".png"
									: blob.type.includes("gif")
										? ".gif"
										: blob.type.includes("webp")
											? ".webp"
											: blob.type.includes("svg")
												? ".svg"
												: ".jpg";
								await writeFile(
									"images/" + img.safeName + img.ext,
									blob,
								);
								img.downloaded = true;
								return;
							} catch (e) {
								console.warn(
									"[v6] Image fetch error:",
									e.message,
								);
							}
						}
						console.warn(`[v6] Image failed: ${img.safeName}`);
					}),
				);
			}
		}
		const imgLink = (img) => `images/${img.safeName}${img.ext || ".png"}`;

		// ── Build markdown ──────────────────────────────────────────────────
		setStatus(`📝 Building transcript (${turns.length} turns)...`);
		const md = [];
		md.push(`# ${chatTitle}\n`);
		md.push(`> **Source:** ${chatUrl}`);
		md.push(`> **Exported:** ${exportTime}`);
		md.push(`> **Model:** ${apiModel || "unknown"}`);
		md.push(`> **Turns:** ${turns.length} (source: ${source})\n`);
		md.push("---\n");

		const renderArtifactRefs = (turn, sink) => {
			if (!cfg.extractArtifacts) return;
			for (const block of turn.content) {
				if (block.type !== "tool_use" || !block.input) continue;
				const inp = block.input;
				const id =
					inp.id ||
					inp.identifier ||
					inp.title ||
					(inp.path || inp.file_path
						? "file:" + (inp.path || inp.file_path)
						: null);
				const rec = id ? artifactMap.get(id) : null;
				if (!rec) continue;
				const cmd =
					inp.command ||
					(inp.old_str != null || inp.new_str != null
						? "update"
						: "create");
				sink(rec, cmd);
			}
		};

		for (const t of turns) {
			if (t.role === "user") {
				const ts = t.timestamp || t.uiTimestamp;
				md.push(`## 👤 User${ts ? " — " + ts : ""}\n`);
				if (t.files.length) {
					md.push("**Attached files:**");
					t.files.forEach((f) =>
						md.push(
							`- 📎 \`${f.filename}\`${f.size ? " (" + f.size + ")" : ""}`,
						),
					);
					md.push("");
				}
				for (const img of t.images)
					md.push(`![${img.alt}](${imgLink(img)})\n`);
				const text =
					t.text?.trim() ||
					t.content
						.filter((b) => b.type === "text" && b.text)
						.map((b) => b.text.trim())
						.join("\n\n");
				if (text) md.push(text + "\n");
			} else {
				md.push(
					`## 🤖 Claude${t.timestamp ? " — " + t.timestamp : ""}\n`,
				);
				for (const block of t.content) {
					switch (block.type) {
						case "text":
							if (block.text?.trim())
								md.push(block.text.trim() + "\n");
							break;
						case "thinking":
							if (block.thinking?.trim())
								md.push(
									`<details><summary>💭 Thinking</summary>\n\n\`\`\`\n${block.thinking.trim()}\n\`\`\`\n\n</details>\n`,
								);
							break;
						case "tool_use": {
							const inp = block.input || {};
							const isFileTool =
								inp.file_text != null ||
								((inp.old_str != null || inp.new_str != null) &&
									(inp.path || inp.file_path));
							const isArt =
								block.name === "artifacts" ||
								inp.command ||
								inp.id ||
								isFileTool;
							if (isArt) break; // rendered via artifact refs below
							md.push(
								`<details><summary>🔧 ${block.name || "Tool use"}</summary>\n`,
							);
							const s =
								typeof inp === "string"
									? inp
									: JSON.stringify(inp, null, 2);
							if (s.length < 800)
								md.push("```json\n" + s + "\n```\n");
							md.push("</details>\n");
							break;
						}
						case "tool_result": {
							md.push(
								`<details><summary>📋 ${block.name || "Result"}</summary>\n`,
							);
							let has = false;
							if (block.display_content) {
								md.push(block.display_content + "\n");
								has = true;
							}
							if (Array.isArray(block.content)) {
								block.content.forEach((item) => {
									if (item.type === "text" && item.text) {
										md.push(
											"```\n" + item.text + "\n```\n",
										);
										has = true;
									} else if (typeof item === "string") {
										md.push("```\n" + item + "\n```\n");
										has = true;
									} else if (item.title || item.url) {
										if (item.title)
											md.push(`**${item.title}**`);
										if (item.url)
											md.push(`URL: ${item.url}`);
										md.push("");
										has = true;
									}
								});
							} else if (typeof block.content === "string") {
								md.push("```\n" + block.content + "\n```\n");
								has = true;
							}
							if (!has && block.text)
								md.push("```\n" + block.text + "\n```\n");
							md.push("</details>\n");
							break;
						}
						default:
							if (block.text?.trim())
								md.push(block.text.trim() + "\n");
					}
				}
				const seen = new Set();
				renderArtifactRefs(t, (rec, cmd) => {
					if (seen.has(rec.id + cmd)) return;
					seen.add(rec.id + cmd);
					const verb =
						cmd === "update"
							? " (updated)"
							: cmd === "rewrite"
								? " (rewritten)"
								: "";
					md.push(
						`> 📄 **Artifact${verb}:** ${rec.title}${rec.type ? " (" + rec.type + ")" : ""} → \`${rec.exportPath}\``,
					);
					md.push("");
				});
			}
			md.push("---\n");
		}

		if (artifactFiles.length) {
			md.push("## 📑 Artifacts Index\n");
			artifactFiles.forEach((a, i) =>
				md.push(
					`${i + 1}. **${a.title}**${a.type ? " — " + a.type : ""} → \`${a.exportPath}\`${a.versions > 1 ? ` (${a.versions} versions folded)` : ""}`,
				),
			);
			md.push("");
		}

		const finalMd =
			md
				.join("\n")
				.replace(/\n{3,}/g, "\n\n")
				.trim() + "\n";

		// ── Build HTML [I10: no unused param] ───────────────────────────────
		function buildHtml() {
			const L = [];
			L.push(`<!DOCTYPE html>`);
			L.push(`<html lang="en"><head><meta charset="utf-8">`);
			L.push(
				`<meta name="viewport" content="width=device-width, initial-scale=1">`,
			);
			L.push(`<title>${escHtml(chatTitle)}</title>`);
			L.push(
				`<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">`,
			);
			L.push(
				`<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js" onerror="window.__noHljs=1"><\/script>`,
			);
			L.push(`<style>
  body { background:#1a1a2e; color:#e0e0e0; font-family:system-ui,sans-serif; max-width:900px; margin:0 auto; padding:24px; line-height:1.7; }
  h1 { color:#8a8aff; border-bottom:1px solid #333; padding-bottom:12px; }
  .turn { margin:24px 0; padding:16px 20px; border-radius:10px; border:1px solid #333; }
  .user { background:#1e2a3a; border-left:3px solid #4a9eff; }
  .assistant { background:#1a2e1a; border-left:3px solid #4aff7f; }
  .role { font-weight:bold; font-size:0.85em; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; }
  .user .role { color:#4a9eff; } .assistant .role { color:#4aff7f; }
  .timestamp { color:#888; font-size:0.8em; margin-left:12px; font-weight:normal; text-transform:none; letter-spacing:normal; }
  details { margin:8px 0; background:#111; border-radius:6px; padding:8px 12px; }
  summary { cursor:pointer; font-weight:bold; color:#c0c0ff; }
  pre { background:#0d1117; padding:16px; border-radius:8px; overflow-x:auto; }
  code { font-family:'Fira Code',monospace; font-size:0.9em; }
  p code { background:#2d2d3d; padding:2px 6px; border-radius:3px; }
  a { color:#6ea8fe; } img { max-width:100%; border-radius:8px; margin:8px 0; }
  table { border-collapse:collapse; margin:12px 0; width:100%; }
  th,td { border:1px solid #444; padding:6px 10px; text-align:left; }
  th { background:#222; }
  blockquote { border-left:3px solid #555; margin:8px 0; padding:4px 12px; color:#bbb; }
  .meta { color:#888; font-size:0.85em; border-bottom:1px solid #333; padding-bottom:12px; margin-bottom:24px; }
  .artifact-ref { background:#2a2a4a; border:1px solid #444; border-radius:6px; padding:8px 12px; margin:8px 0; font-size:0.9em; }
  ul,ol { padding-left:24px; } li { margin:4px 0; }
</style></head><body>`);
			L.push(`<h1>${escHtml(chatTitle)}</h1>`);
			L.push(
				`<div class="meta">Source: <a href="${escHtml(chatUrl)}">${escHtml(chatUrl)}</a><br>Exported: ${escHtml(exportTime)}<br>Model: ${escHtml(apiModel || "unknown")}<br>Turns: ${turns.length}</div>`,
			);

			for (const turn of turns) {
				const cls = turn.role === "user" ? "user" : "assistant";
				const icon = turn.role === "user" ? "User" : "Claude";
				const ts = turn.timestamp || turn.uiTimestamp || "";
				L.push(`<div class="turn ${cls}">`);
				L.push(
					`<div class="role">${escHtml(icon)}<span class="timestamp">${escHtml(ts)}</span></div>`,
				);

				if (turn.role === "user") {
					if (turn.files?.length) {
						L.push(`<p><strong>Attached files:</strong></p><ul>`);
						turn.files.forEach((f) =>
							L.push(
								`<li>${escHtml(f.filename)}${f.size ? " (" + escHtml(f.size) + ")" : ""}</li>`,
							),
						);
						L.push(`</ul>`);
					}
					for (const img of turn.images || [])
						L.push(
							`<img src="${escHtml(imgLink(img))}" alt="${escHtml(img.alt)}">`,
						);
					const text =
						turn.text?.trim() ||
						turn.content
							.filter((b) => b.type === "text" && b.text)
							.map((b) => b.text)
							.join("\n\n");
					if (text?.trim())
						L.push(`<div>${markdownToHtml(text.trim())}</div>`);
				} else {
					for (const block of turn.content) {
						switch (block.type) {
							case "text":
								if (block.text?.trim())
									L.push(
										`<div>${markdownToHtml(block.text.trim())}</div>`,
									);
								break;
							case "thinking":
								L.push(
									`<details><summary>Thinking</summary><pre>${escHtml(block.thinking || "")}</pre></details>`,
								);
								break;
							case "tool_use": {
								const inp = block.input || {};
								const isFileTool =
									inp.file_text != null ||
									((inp.old_str != null ||
										inp.new_str != null) &&
										(inp.path || inp.file_path));
								if (
									block.name === "artifacts" ||
									inp.command ||
									inp.id ||
									isFileTool
								)
									break;
								L.push(
									`<details><summary>${escHtml(block.name || "Tool use")}</summary>`,
								);
								const s =
									typeof inp === "string"
										? inp
										: JSON.stringify(inp, null, 2);
								L.push(
									`<pre><code>${escHtml(s)}</code></pre></details>`,
								);
								break;
							}
							case "tool_result": {
								L.push(
									`<details><summary>${escHtml(block.name || "Result")}</summary>`,
								);
								if (block.display_content)
									L.push(
										`<div>${markdownToHtml(block.display_content)}</div>`,
									);
								if (Array.isArray(block.content))
									block.content.forEach((item) => {
										if (item.type === "text" && item.text)
											L.push(
												`<pre>${escHtml(item.text)}</pre>`,
											);
										else if (typeof item === "string")
											L.push(
												`<pre>${escHtml(item)}</pre>`,
											);
										else if (item.title || item.url) {
											if (item.title)
												L.push(
													`<p><strong>${escHtml(item.title)}</strong></p>`,
												);
											if (item.url)
												L.push(
													`<p><a href="${escHtml(item.url)}">${escHtml(item.url)}</a></p>`,
												);
										}
									});
								else if (typeof block.content === "string")
									L.push(
										`<pre>${escHtml(block.content)}</pre>`,
									);
								L.push(`</details>`);
								break;
							}
						}
					}
					const seen = new Set();
					renderArtifactRefs(turn, (rec, cmd) => {
						if (seen.has(rec.id + cmd)) return;
						seen.add(rec.id + cmd);
						const verb =
							cmd === "update"
								? " (updated)"
								: cmd === "rewrite"
									? " (rewritten)"
									: "";
						L.push(
							`<div class="artifact-ref"><strong>${escHtml(rec.title)}${verb}</strong>${rec.type ? " <em>(" + escHtml(rec.type) + ")</em>" : ""} &mdash; <code>${escHtml(rec.exportPath)}</code></div>`,
						);
					});
				}
				L.push(`</div>`);
			}
			L.push(
				`<script>if(!window.__noHljs&&window.hljs)hljs.highlightAll();<\/script>`,
			);
			L.push(`</body></html>`);
			return L.join("\n");
		}

		// ── API-compatible format [I11: max_tokens 8192] ────────────────────
		function buildApiJson() {
			const messages = turns
				.filter((t) => t.role === "user" || t.role === "assistant")
				.map((t) => ({
					role: t.role,
					content:
						t.text?.trim() ||
						t.content
							.filter((b) => b.type === "text" && b.text)
							.map((b) => b.text)
							.join("\n\n"),
				}))
				.filter((m) => m.content.trim());
			return JSON.stringify(
				{ model: apiModel || "unknown", max_tokens: 8192, messages },
				null,
				2,
			);
		}

		// ── Manifest ────────────────────────────────────────────────────────
		const outputsList = ["transcript.md"];
		if (cfg.manifest) outputsList.push("manifest.json");
		if (cfg.extractArtifacts)
			outputsList.push(...artifactFiles.map((a) => a.exportPath));
		if (cfg.downloadImages)
			outputsList.push(
				...allImages.filter((i) => i.downloaded).map((i) => imgLink(i)),
			);
		if (cfg.apiFormat) outputsList.push("conversation.api.json");
		if (cfg.htmlOutput) outputsList.push("conversation.html");

		const manifest = {
			chatTitle,
			chatUrl,
			chatId,
			exportTime,
			exporterVersion: "v6",
			contentSource: source,
			model: apiModel || "unknown",
			config: {
				extractArtifacts: cfg.extractArtifacts,
				downloadImages: cfg.downloadImages,
				apiFormat: cfg.apiFormat,
				htmlOutput: cfg.htmlOutput,
				stripSystemReminders: cfg.stripSystemReminders,
				antArtifactRegex: cfg.antArtifactRegex,
				storageMethod: useFolder ? "folder" : "zip",
			},
			totalTurns: turns.length,
			artifacts: artifactFiles.map((a) => ({
				title: a.title,
				fileName: a.fileName,
				exportPath: a.exportPath,
				type: a.type,
				versionsFolded: a.versions,
				contentLength: a.content.length,
			})),
			images: allImages.map((img) => ({
				alt: img.alt,
				src: img.src,
				downloaded: !!img.downloaded,
			})),
			uploadedFiles: turns.flatMap((t) => t.files),
			outputs: outputsList,
		};

		// ── Write everything ────────────────────────────────────────────────
		setStatus("📝 Writing transcript...");
		await writeFile("transcript.md", finalMd);

		if (cfg.manifest)
			await writeFile("manifest.json", JSON.stringify(manifest, null, 2));

		if (cfg.extractArtifacts && artifactFiles.length) {
			for (let i = 0; i < artifactFiles.length; i++) {
				const a = artifactFiles[i];
				setStatus(
					`📄 Artifact ${i + 1}/${artifactFiles.length}: ${a.title}`,
				);
				await writeFile(a.exportPath, a.content);
			}
		}

		if (cfg.apiFormat)
			await writeFile("conversation.api.json", buildApiJson());
		if (cfg.htmlOutput) await writeFile("conversation.html", buildHtml());

		// ── Update history ──────────────────────────────────────────────────
		if (cfg.skipPreviouslyExported && chatId !== "unknown") {
			const history = JSON.parse(
				localStorage.getItem("claude_export_history") || "{}",
			);
			history[chatId] = { exportedAt: exportTime, title: chatTitle };
			localStorage.setItem(
				"claude_export_history",
				JSON.stringify(history),
			);
		}

		// ── Finalize ZIP ────────────────────────────────────────────────────
		if (!useFolder) {
			setStatus("📦 Generating ZIP...");
			const blob = buildZip(zipFiles);
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${safeTitle}.zip`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}

		const dlImgs = allImages.filter((i) => i.downloaded).length;
		setStatus(
			[
				`✅ Export complete! (${useFolder ? "📂 Folder" : "📦 ZIP"})`,
				``,
				`📝 Transcript: ${turns.length} turns (source: ${source})`,
				`📄 Artifacts: ${artifactFiles.length} files`,
				`🖼️ Images: ${dlImgs}/${allImages.length}`,
				`📎 Uploaded files referenced: ${manifest.uploadedFiles.length}`,
				cfg.apiFormat ? `📋 API format: conversation.api.json` : "",
				cfg.htmlOutput ? `📄 HTML: conversation.html` : "",
			]
				.filter(Boolean)
				.join("\n"),
		);
		await sleep(8000);
	} catch (err) {
		console.error("[v6] Export failed:", err);
		setStatus("❌ " + err.message + "\n\nCheck console for details.");
		await sleep(10000);
	} finally {
		overlay.remove();
	}
})();
