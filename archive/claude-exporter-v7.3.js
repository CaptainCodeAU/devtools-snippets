// =============================================================================
// Claude.ai Chat Exporter v7.3 — Self-contained, API-primary, no external deps
// =============================================================================
// Run on any https://claude.ai/chat/<id> page (console paste or bookmarklet).
//
// v7.3:
//   - CONFIRMED (live probe): file entries' `path` is a sandbox-container
//     path (/mnt/user-data/uploads/…), not a web URL. Original uploads of
//     kind "blob" are NOT retrievable; the extracted_content .txt fallback
//     is the recoverable form. Container paths are no longer fetched at all
//     (v7.2 rejected the resulting app-shell HTML; v7.3 skips the request).
//   - Single VERSION constant drives the popup title, manifest version, and
//     every console log tag — no more version-string drift.
//
// v7.2:
//   - Upload fetches are VALIDATED before saving: the SPA catch-all serves
//     app-shell HTML with a 200 for unknown routes, which v7.1 saved as the
//     "file" (13-14 KB of HTML instead of the upload). Non-.html files whose
//     body starts with <!doctype html>/<html are rejected; an /api-prefixed
//     candidate URL is tried; size is checked against size_bytes (mismatch →
//     saved but flagged, telemetry.uploadsSuspect).
//
// v7.1 (post-live-test fixes):
//   - display_content objects render as JSON, not "[object Object]".
//   - Artifact-shaped tool blocks that FAILED to fold now render (capped,
//     with a ⚠️ marker) instead of vanishing — telemetry key renamed to
//     unconsumedArtifactBlocks.
//   - manifest contentLength is UTF-8 bytes (matches ls).
//   - [F4] VERIFIED live: current_leaf_message_uuid + parent_message_uuid
//     exist; the root's nil-UUID parent terminates the walk.
//   - [F22] REVISED after live inspection: extracted_content is absent, but
//     file entries carry a fetchable `path` — original uploads are now
//     downloaded to uploads/ (new config: downloadUploads). size_bytes is
//     also read (manifest sizes were empty before).
//
// WHAT CHANGED FROM v6 (review fixes, F# = fix number):
//   CONTENT LOSS / CORRUPTION
//   [F1]  bash_tool & other command-style tools no longer vanish: renderers
//         now use the exact block→artifact mapping from reconstruction
//         (WeakMap), instead of guessing from `inp.command || inp.id`.
//   [F2]  All String.replace calls with dynamic replacements use a function,
//         so content containing `$&`, `$1` etc. is no longer corrupted
//         (artifact folding + markdown code-block reinsertion).
//   [F3]  The \n{3,} collapse now skips fenced code blocks, so code with
//         consecutive blank lines is preserved in the transcript.
//   [F4]  Branched/edited conversations: walk parent links from
//         current_leaf_message_uuid so only the ACTIVE branch is exported
//         (falls back to the old flat sort if the fields are absent).
//         NOTE: field names unverified against the live API — degrade-safe.
//   [F5]  Oversized tool_use JSON is truncated WITH a note instead of being
//         silently dropped; HTML renderer gets the same cap.
//   CORRECTNESS
//   [F6]  Original-image URL stripping uses new URL()/searchParams — no more
//         broken `path&h=2` candidates.
//   [F7]  str_replace fold failures are logged and counted per artifact
//         (rec.foldFailures) and globally in the manifest.
//   [F8]  Transcript artifact refs come from the reconstruction-time WeakMap,
//         eliminating the key-derivation mismatch for file tools.
//   [F9]  Image links fall back to the original src when the image wasn't
//         downloaded (downloadImages off, or fetch failed) — no dead links.
//   [F10] Inline code is placeholder-protected (and BEFORE table parsing),
//         so `**x**` inside backticks and `|` in inline code render correctly.
//   [F11] A trailing unterminated ``` fence is treated as code, not markdown.
//   [F12] Thinking / tool-result dumps use a dynamically-lengthened fence so
//         embedded ``` can't break out.
//   [F13] Ordered lists keep their start number (<ol start="7">).
//         (Nested lists remain unsupported — documented limitation.)
//   [F14] Reminder-tag regexes anchor the tag name with (?=[\s>]).
//   ROBUSTNESS
//   [F15] Scroll harvest breaks after 5 consecutive no-progress iterations
//         instead of spinning up to ~7 minutes.
//   [F16] localStorage reads go through safeParse (corrupt JSON can't kill
//         the run).
//   [F17] Org id falls back to GET /api/organizations when the
//         lastActiveOrg cookie is missing.
//   [F18] MEMORY NOTE: ZIP mode buffers everything (all images + archive) in
//         RAM. For chats with hundreds of MB of images, prefer folder mode
//         (it streams). "auto" already prefers folder.
//   [F19] ZIP writer throws a clear "use folder mode" error past ZIP32
//         limits (>65535 entries or >4 GB) instead of writing a corrupt file.
//   [F20] Export history is recorded AFTER the ZIP download is triggered.
//         (Browser save-dialog cancel still can't be detected — limitation.)
//   [F21] Folder mode: if the target folder already exists, a timestamped
//         folder is created instead of silently merging/overwriting.
//   FEATURES
//   [F22] Attachment extracted text (attachment.extracted_content, when the
//         API provides it) is exported to uploads/*.txt.
//         NOTE: field name unverified against the live API — degrade-safe.
//   [F23] Config actually persists: saved to localStorage on Export, loaded
//         as popup defaults next run.
//   [F24] Scroll harvest is skipped when the API succeeded and images are
//         off (it only contributed images + redundant timestamps).
//         Tradeoff: DOM-only file thumbnails are lost in that case — logged.
//   [F25] API-format output merges adjacent same-role messages (valid
//         alternation for the Messages API).
//   [F26] Manifest telemetry: foldFailures, imagesFailed,
//         unconsumedArtifactBlocks — "did the export lose anything" is now
//         answerable from the manifest.
//   MINOR
//   [F27] Reminder-strip counter also counts block-level strips.
//   [F28] safeTitle falls back to claude_chat_<id> for all-unicode titles.
//   [F29] Folder and ZIP names use one shared sanitizer.
//   [F30] Resume banner: Escape dismisses it (continues with export).
//   [F31] ##### and deeper headings map to <h6> instead of leaking as text.
//   [F32] tool_result summaries resolve the tool name via tool_use_id.
//   [F33] Dropped the pointless Content-Type header on the GET.
// =============================================================================

(async () => {
	"use strict";

	// Single source of truth for the version — used in the popup title, the
	// manifest, and every console log. Bump ONLY here.
	const VERSION = "7.3";
	const TAG = `[v${VERSION}]`;

	// [F16] Corrupt localStorage must never kill the run.
	const safeParse = (s, fallback) => {
		try {
			const v = JSON.parse(s);
			return v == null ? fallback : v;
		} catch {
			return fallback;
		}
	};

	// ── Persistent Defaults (edit for your preferences) ──────────────────
	// [F23] Overridden by localStorage("claude_export_config") if present.
	const CONFIG = {
		extractArtifacts: true,
		downloadImages: true,
		downloadUploads: true, // [v7.1] fetch original uploaded files
		manifest: true,
		apiFormat: false,
		htmlOutput: true,
		stripSystemReminders: true,
		antArtifactRegex: true,
		imageConcurrency: 5,
		skipPreviouslyExported: false,
		storageMethod: "auto", // "auto" | "folder" | "zip"
	};
	// [F23] Load persisted config (only known keys, so stale entries can't
	// inject junk).
	{
		const saved = safeParse(
			localStorage.getItem("claude_export_config"),
			{},
		);
		for (const k of Object.keys(CONFIG))
			if (k in saved && typeof saved[k] === typeof CONFIG[k])
				CONFIG[k] = saved[k];
	}

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
	// [F14] (?=[\s>]) so <userPreferences> can't also match a hypothetical
	// <userPreferencesX> tag.
	const REMINDER_REGEXES = SYSTEM_REMINDER_TAGS.map(
		(tag) => new RegExp(`<${tag}(?=[\\s>])[\\s\\S]*?<\\/${tag}>`, "gi"),
	);

	const ROLE_MAP = { human: "user", assistant: "assistant" };
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

	// Real claude.ai artifact commands. `command` ALONE is a weak signal —
	// bash_tool also has `command` [F1].
	const ARTIFACT_CMDS = new Set(["create", "update", "rewrite"]);

	// [F12] Return a fence longer than any run of backticks in the content.
	const fenceFor = (txt) => {
		let f = "```";
		while ((txt || "").includes(f)) f += "`";
		return f;
	};

	// [F3] Collapse \n{3,} only OUTSIDE fenced code blocks. Odd split
	// segments are the fences (capture group) and pass through verbatim.
	// Caveat: fences longer than 3 backticks may misalign the split; the
	// fence content itself is still preserved either way.
	const collapseOutsideFences = (s) =>
		s
			.split(/(```[\s\S]*?```)/)
			.map((seg, i) =>
				i % 2 ? seg : seg.replace(/\n{3,}/g, "\n\n"),
			)
			.join("");

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
		// [F19] This is a ZIP32 (no ZIP64) writer. Past these limits the
		// archive would be silently corrupt — fail loudly instead.
		const LIMIT_MSG = " — switch to folder mode (Export Behavior).";
		if (files.length > 0xffff)
			throw new Error(
				`ZIP entry limit exceeded (${files.length} > 65535)` +
					LIMIT_MSG,
			);
		const enc = new TextEncoder();
		const chunks = [];
		const central = [];
		let offset = 0;
		const { time, date } = dosDateTime(new Date());

		for (const f of files) {
			const nameBytes = enc.encode(f.name);
			const crc = crc32(f.bytes);
			const size = f.bytes.length;
			if (size > 0xffffffff || offset > 0xffffffff)
				throw new Error("ZIP 4 GB limit exceeded" + LIMIT_MSG);

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
		if (cdStart > 0xffffffff)
			throw new Error(
				"ZIP 4 GB limit exceeded — switch to folder mode (Export Behavior).",
			);
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
			title.textContent = "Claude Chat Exporter v" + VERSION;
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
			addCheckbox(
				fsOutput,
				"downloadUploads",
				"Uploaded files download (originals)",
			);
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

				// [F23] Persist choices (public keys only) for next run.
				try {
					const pub = {};
					for (const k of Object.keys(cfg))
						if (!k.startsWith("_")) pub[k] = cfg[k];
					localStorage.setItem(
						"claude_export_config",
						JSON.stringify(pub),
					);
				} catch (e) {
					console.warn(TAG + " Could not persist config:", e.message);
				}

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
		const stashBlock = (lang, code) => {
			const idx = codeBlocks.length;
			codeBlocks.push(
				`<pre><code class="${lang ? "language-" + lang : ""}">${code.trim()}</code></pre>`,
			);
			return `%%CODEBLOCK_${idx}%%`;
		};
		html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
			stashBlock(lang, code),
		);
		// [F11] A trailing unterminated fence is code, not markdown to mangle.
		html = html.replace(/```(\w*)\n([\s\S]*)$/, (_, lang, code) =>
			stashBlock(lang, code),
		);

		// [F10] Protect inline code BEFORE tables and inline transforms, so
		// `|` inside backticks can't split table cells and `**x**` inside
		// backticks isn't bolded.
		const inlineCode = [];
		html = html.replace(/`([^`\n]+)`/g, (_, code) => {
			const idx = inlineCode.length;
			inlineCode.push(`<code>${code}</code>`);
			return `%%INLINECODE_${idx}%%`;
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

		html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
		html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
		html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
			if (/^(https?:\/\/|\/)/i.test(url))
				return `<a href="${url}" target="_blank">${text}</a>`;
			return `${text} (${url})`;
		});

		// [F31] Levels shift down one because the export's own title is <h1>.
		html = html.replace(/^#{5,}\s+(.+)$/gm, "<h6>$1</h6>");
		html = html.replace(/^#{4}\s+(.+)$/gm, "<h5>$1</h5>");
		html = html.replace(/^#{3}\s+(.+)$/gm, "<h4>$1</h4>");
		html = html.replace(/^#{2}\s+(.+)$/gm, "<h3>$1</h3>");
		html = html.replace(/^#{1}\s+(.+)$/gm, "<h2>$1</h2>");

		// Blockquotes
		html = html.replace(/(^>\s?.*(?:\n>\s?.*)*)/gm, (block) => {
			const inner = block.replace(/^>\s?/gm, "");
			return `<blockquote>${inner}</blockquote>`;
		});

		// Ordered lists [F13: keep the start number].
		// Known limitation: nested lists are NOT supported (flattened).
		html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<oli data-n="$1">$2</oli>');
		html = html.replace(/(<oli[^>]*>.*<\/oli>\n?)+/g, (m) => {
			const start = m.match(/data-n="(\d+)"/)?.[1] || "1";
			const items = m
				.replace(/<oli[^>]*>/g, "<li>")
				.replace(/<\/oli>/g, "</li>");
			return `<ol${start !== "1" ? ` start="${start}"` : ""}>${items}</ol>`;
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

		// [F2] Function replacements: stored code containing $&, $1 etc.
		// must not be interpreted as replacement patterns.
		for (let i = 0; i < inlineCode.length; i++)
			html = html.replace(`%%INLINECODE_${i}%%`, () => inlineCode[i]);
		for (let i = 0; i < codeBlocks.length; i++)
			html = html.replace(`%%CODEBLOCK_${i}%%`, () => codeBlocks[i]);

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
	// [F17] Cookie first, /api/organizations as fallback.
	async function getOrgId() {
		const c = document.cookie.match(/lastActiveOrg=([^;]+)/)?.[1];
		if (c) return decodeURIComponent(c);
		try {
			const r = await fetch("/api/organizations", {
				credentials: "include",
			});
			if (r.ok) {
				const orgs = await r.json();
				if (Array.isArray(orgs) && orgs[0]?.uuid) {
					console.log(TAG + " Org id resolved via /api/organizations");
					return orgs[0].uuid;
				}
			}
		} catch (e) {
			console.warn(TAG + " Org fallback failed:", e.message);
		}
		return null;
	}

	async function fetchConversationData(chatId) {
		try {
			const orgId = await getOrgId();
			if (!orgId || !chatId) return null;
			// [F33] No Content-Type on a GET.
			const resp = await fetch(
				`/api/organizations/${orgId}/chat_conversations/${chatId}?tree=true&rendering_mode=messages&render_all_tools=true`,
				{ credentials: "include" },
			);
			if (!resp.ok) {
				console.warn(`${TAG} API fetch failed: ${resp.status}`);
				return null;
			}
			return await resp.json();
		} catch (e) {
			console.warn(TAG + " API fetch error:", e.message);
			return null;
		}
	}

	// Pull a linear, ordered message list out of the API response, tolerating
	// shape differences. Returns [] if nothing usable is found.
	function extractApiMessages(apiData) {
		if (!apiData) return [];
		const arr = apiData.chat_messages || apiData.messages;
		if (!Array.isArray(arr) || arr.length === 0) return [];

		// [F4] tree=true returns ALL branches. Flat-sorting interleaves
		// abandoned edits/regenerations into the transcript AND lets stale
		// branches corrupt artifact folding. Walk parent links from the
		// current leaf to get only the active path.
		// UNVERIFIED field names (current_leaf_message_uuid,
		// parent_message_uuid) — if absent, this block is a no-op and we
		// fall back to the old flat sort.
		const leafId =
			apiData.current_leaf_message_uuid ||
			apiData.current_leaf_message_id ||
			null;
		if (leafId && arr.some((m) => m.parent_message_uuid)) {
			const byUuid = new Map(arr.map((m) => [m.uuid, m]));
			if (byUuid.has(leafId)) {
				const path = [];
				const seen = new Set();
				let cur = byUuid.get(leafId);
				while (cur && !seen.has(cur.uuid)) {
					seen.add(cur.uuid);
					path.push(cur);
					cur = byUuid.get(cur.parent_message_uuid);
				}
				if (path.length) {
					path.reverse();
					console.log(
						`${TAG} Active branch: ${path.length}/${arr.length} messages (leaf walk)`,
					);
					return path;
				}
			}
		}

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
		console.log(TAG + " Export cancelled by user");
		return;
	}
	console.log(
		TAG + " Config:",
		JSON.stringify(cfg, (k, v) => (k.startsWith("_") ? undefined : v), 2),
	);

	const chatUrl = window.location.href;
	const chatId = chatUrl.match(/\/chat\/([a-f0-9-]+)/)?.[1] || "unknown";
	const chatTitle =
		document.title.replace(/ - Claude$/, "").trim() || "Untitled Chat";
	// [F29] One sanitizer for both the ZIP name and the folder name.
	// [F28] All-unicode titles sanitize to nothing → fall back to chat id.
	let safeTitle = chatTitle
		.replace(/[^a-zA-Z0-9_-]/g, "_")
		.substring(0, 60);
	if (!safeTitle.replace(/_/g, ""))
		safeTitle = `claude_chat_${chatId.slice(0, 8)}`;
	const exportTime = new Date().toISOString();

	// ── Resume check ────────────────────────────────────────────────────
	if (cfg.skipPreviouslyExported && chatId !== "unknown") {
		// [F16] safeParse: corrupt history must not throw (this runs outside
		// the main try/catch).
		const history = safeParse(
			localStorage.getItem("claude_export_history"),
			{},
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
				// [F30] Escape = dismiss and continue (user launched the
				// exporter, so proceeding is the safe default).
				const bannerKey = (e) => {
					if (e.key === "Escape") {
						document.removeEventListener("keydown", bannerKey);
						banner.remove();
						resolve(false);
					}
				};
				document.addEventListener("keydown", bannerKey);
				yes.addEventListener("click", () => {
					document.removeEventListener("keydown", bannerKey);
					banner.remove();
					resolve(false);
				});
				no.addEventListener("click", () => {
					document.removeEventListener("keydown", bannerKey);
					banner.remove();
					resolve(true);
				});
				row.appendChild(no);
				row.appendChild(yes);
				banner.appendChild(row);
				document.body.appendChild(banner);
			});
			if (skip) {
				console.log(TAG + " Skipped — previously exported");
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
			// [F29] Same sanitized name as the ZIP.
			// [F21] If the folder already exists (previous export), don't
			// merge/overwrite silently — create a timestamped sibling so the
			// manifest always matches the folder contents.
			let folderName = safeTitle;
			try {
				await cfg._parentHandle.getDirectoryHandle(folderName);
				folderName +=
					"_" + exportTime.replace(/[:.]/g, "-").slice(0, 19);
				console.log(
					`${TAG} Folder existed — using ${folderName}/ instead`,
				);
			} catch {
				// Not found → name is free.
			}
			folderHandle = await cfg._parentHandle.getDirectoryHandle(
				folderName,
				{
					create: true,
				},
			);
			setStatus(`📂 Writing to folder: ${folderName}/`);
		} else {
			setStatus("📦 Using local ZIP writer (no external libraries)");
		}
		console.log(
			`${TAG} Storage: ${useFolder ? "File System Access (folder)" : "inline ZIP"}`,
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
			`${TAG} API: ${apiData ? "ok" : "unavailable"}, messages: ${apiMessages.length}, model: ${apiModel || "unknown"}`,
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

		// [F24] The scroll pass is the slowest step and, once the API has
		// answered, only contributes image srcs (+ redundant timestamps and
		// file thumbnails the API also reports). Skip it when we don't need
		// images. Tradeoff: DOM-only file thumbnails are lost in that case.
		const needDomHarvest =
			apiMessages.length === 0 || cfg.downloadImages;

		if (scrollContainer && needDomHarvest) {
			setStatus("📜 Scrolling to load the full conversation...");
			const originalScroll = scrollContainer.scrollTop;
			scrollContainer.scrollTop = 0;
			await sleep(400);
			recordVisible();

			let guard = 0;
			let lastTop = -1;
			let stuck = 0; // [F15]
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
				// [F15] Sticky footers / sub-pixel heights can leave us
				// "not at bottom" but unable to advance — previously this
				// spun until guard hit 2000 (~7 min). Bail after 5 stalls.
				if (scrollContainer.scrollTop === lastTop) {
					stuck++;
					if (stuck >= 5) {
						console.warn(
							TAG + " Scroll made no progress 5×, stopping harvest early",
						);
						break;
					}
				} else {
					stuck = 0;
				}
				lastTop = scrollContainer.scrollTop;
			}
			recordVisible();
			scrollContainer.scrollTop = originalScroll;
			console.log(
				`${TAG} Harvested ${domByUuid.size} turn(s) from DOM after scroll`,
			);
		} else if (!scrollContainer) {
			console.warn(
				TAG + " No scroll container found — relying on API only",
			);
		} else {
			console.log(
				TAG + " Scroll harvest skipped (API ok, images off) [F24]",
			);
		}

		// ── Build unified turns: API primary, DOM fallback [I2] ─────────────
		let turns;
		let source;
		if (apiMessages.length > 0) {
			source = "api";
			turns = apiMessages.map((m) => {
				const dom = domByUuid.get(m.uuid) || {};
				// [F22] Attachments often carry the extracted text of the
				// upload (attachment.extracted_content). UNVERIFIED field
				// name — if absent, `extracted` stays null and nothing is
				// written. Combine files + attachments instead of taking the
				// first non-empty array, so neither source is dropped.
				const rawFiles = [
					...(m.attachments || []),
					...(m.files || []),
					...(m.files_v2 || []),
				];
				// [F22→v7.1, VERIFIED shape] file entries carry:
				// success, path, file_kind, file_uuid, file_name,
				// created_at, size_bytes, uuid. `path` is a fetchable URL
				// (same auth as chat images) → we can download the ORIGINAL
				// upload. attachments (pasted-text style) may still carry
				// extracted_content — kept as fallback.
				const seenFn = new Set();
				const apiFiles = rawFiles
					.map((f) => ({
						filename: f.file_name || f.name || f.title || "file",
						ext: "",
						size: f.file_size || f.size_bytes || f.size || "",
						fetchPath: typeof f.path === "string" ? f.path : null,
						fileUuid: f.file_uuid || f.uuid || null,
						extracted:
							typeof f.extracted_content === "string" &&
							f.extracted_content
								? f.extracted_content
								: null,
					}))
					.filter((f) => {
						// Same upload can appear in both `attachments` and
						// `files` — keep the first (attachments carries
						// extracted_content).
						if (seenFn.has(f.filename)) return false;
						seenFn.add(f.filename);
						return true;
					});
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
		console.log(`${TAG} Source: ${source} | turns: ${turns.length}`);

		// ── Strip reminders ─────────────────────────────────────────────────
		if (cfg.stripSystemReminders) {
			let stripped = 0;
			for (const turn of turns) {
				if (turn.role !== "user") continue;
				let changed = false;
				const before = turn.text;
				turn.text = stripReminders(turn.text);
				if (turn.text !== before) changed = true;
				for (const block of turn.content) {
					if (block.type === "text" && block.text) {
						const b = block.text;
						block.text = stripReminders(block.text);
						if (block.text !== b) changed = true; // [F27]
					}
				}
				if (changed) stripped++;
			}
			console.log(
				`${TAG} Stripped reminders from ${stripped} user turn(s)`,
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
		// [F1][F8] Reconstruction records EXACTLY which blocks it consumed
		// (block → {rec, cmd}). The renderers use this instead of re-deriving
		// keys, so bash_tool etc. can't be mistaken for artifacts and file-
		// tool refs can't miss due to key mismatches.
		const blockArtifact = new WeakMap();
		let foldFailures = 0; // [F7][F26]
		if (cfg.extractArtifacts) {
			for (const t of turns) {
				if (t.role !== "assistant") continue;
				for (const block of t.content) {
					if (block.type !== "tool_use" || !block.input) continue;
					const inp = block.input;
					// `command` alone is a weak signal — bash_tool also has
					// `command`. Treat as a claude.ai artifact only for the
					// real artifact commands or an explicit identifier.
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
								foldFailures: rec?.foldFailures || 0,
							};
							artifactMap.set(key, rec);
							blockArtifact.set(block, { rec, cmd: "create" }); // [F8]
						} else if (hasEdit) {
							if (
								rec &&
								oldS != null &&
								rec.content.includes(oldS)
							) {
								// [F2] Function replacement: newS containing
								// $&, $1 etc. must not be interpreted.
								rec.content = rec.content.replace(
									oldS,
									() => newS ?? "",
								);
								rec.versions++;
								blockArtifact.set(block, {
									rec,
									cmd: "update",
								});
							} else {
								// [F7] Previously silent → stale file with
								// no trace. Log + count.
								foldFailures++;
								if (rec) rec.foldFailures++;
								console.warn(
									`${TAG} str_replace fold FAILED for ${key} (old_str not found${rec ? "" : ", no prior create in this transcript"}) — exported file may be stale`,
								);
								if (rec)
									blockArtifact.set(block, {
										rec,
										cmd: "update",
									});
							}
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
							foldFailures: rec?.foldFailures || 0,
						};
						artifactMap.set(id, rec);
						blockArtifact.set(block, {
							rec,
							cmd: cmd || "create",
						}); // [F8]
					} else if (cmd === "update" && rec) {
						const oldS = inp.old_str ?? inp.oldStr;
						const newS = inp.new_str ?? inp.newStr ?? "";
						if (oldS != null && rec.content.includes(oldS)) {
							// [F2] Function replacement — no $-patterns.
							rec.content = rec.content.replace(
								oldS,
								() => newS,
							);
						} else if (oldS != null) {
							foldFailures++; // [F7]
							rec.foldFailures++;
							console.warn(
								`${TAG} Artifact update fold FAILED for "${id}" (old_str not found) — exported file may be stale`,
							);
						}
						if (inp.title) rec.title = inp.title;
						rec.versions++;
						blockArtifact.set(block, { rec, cmd: "update" });
					} else if (rec && inp.content != null) {
						rec.content = inp.content;
						rec.versions++;
						blockArtifact.set(block, { rec, cmd: "rewrite" });
					} else if (cmd === "update" && !rec) {
						foldFailures++; // [F7]
						console.warn(
							`${TAG} Artifact update for unknown id "${id}" — no create seen in this transcript`,
						);
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
				if (added) console.log(`${TAG} Regex added ${added} artifact(s)`);
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
		console.log(`${TAG} Reconstructed ${artifactFiles.length} artifact(s)`);

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
						// [F6] Best-effort original asset: strip resize
						// params PROPERLY. The old regex left broken URLs
						// like `path&h=2` when the first param was removed.
						const candidates = [img.src];
						try {
							const u = new URL(img.src, location.origin);
							let changed = false;
							for (const p of [
								"w",
								"h",
								"q",
								"fm",
								"dpr",
								"fit",
								"preview",
							]) {
								if (u.searchParams.has(p)) {
									u.searchParams.delete(p);
									changed = true;
								}
							}
							if (changed) candidates.unshift(u.href);
						} catch {
							// Unparseable src — just use it as-is.
						}
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
									TAG + " Image fetch error:",
									e.message,
								);
							}
						}
						console.warn(`${TAG} Image failed: ${img.safeName}`);
					}),
				);
			}
		}
		// [F9] Only link the local file when it actually exists; otherwise
		// fall back to the original src (works while logged in) instead of
		// emitting a dead images/ link.
		const imgLink = (img) =>
			img.downloaded
				? `images/${img.safeName}${img.ext || ".png"}`
				: img.src;

		// ── Build markdown ──────────────────────────────────────────────────
		setStatus(`📝 Building transcript (${turns.length} turns)...`);
		const md = [];
		md.push(`# ${chatTitle}\n`);
		md.push(`> **Source:** ${chatUrl}`);
		md.push(`> **Exported:** ${exportTime}`);
		md.push(`> **Model:** ${apiModel || "unknown"}`);
		md.push(`> **Turns:** ${turns.length} (source: ${source})\n`);
		md.push("---\n");

		// [F8] Refs come from the exact block→rec mapping recorded during
		// reconstruction — no key re-derivation, no mismatches.
		const renderArtifactRefs = (turn, sink) => {
			if (!cfg.extractArtifacts) return;
			for (const block of turn.content) {
				if (block.type !== "tool_use") continue;
				const hit = blockArtifact.get(block);
				if (hit) sink(hit.rec, hit.cmd);
			}
		};

		// [F1] A block is only "handled as artifact" if reconstruction
		// actually consumed it. Everything else renders as a normal tool
		// call. Artifact-SHAPED blocks that failed to map (e.g. update with
		// no create) are still suppressed to avoid dumping huge content
		// JSON, but they're counted [F26].
		const isArtifactShaped = (block) => {
			const inp = block.input || {};
			const isFileTool =
				inp.file_text != null ||
				((inp.old_str != null || inp.new_str != null) &&
					(inp.path ||
						inp.file_path ||
						inp.file_name ||
						inp.filename));
			return (
				block.name === "artifacts" ||
				(inp.command && ARTIFACT_CMDS.has(inp.command)) ||
				inp.identifier != null ||
				(inp.id != null && inp.content != null) ||
				isFileTool
			);
		};
		// [v7.1] Counts artifact-shaped blocks that reconstruction did NOT
		// consume (fold failed, update with no create, or extraction off).
		// These now RENDER in the transcript (capped) instead of vanishing.
		let unconsumedArtifactBlocks = 0; // [F26]

		// [F32] tool_result blocks rarely carry `name`; resolve it from the
		// matching tool_use block's id.
		const toolNameById = new Map();
		for (const t of turns)
			for (const b of t.content || [])
				if (b.type === "tool_use" && b.id && b.name)
					toolNameById.set(b.id, b.name);
		const resultName = (block) =>
			block.name ||
			(block.tool_use_id && toolNameById.get(block.tool_use_id)) ||
			"Result";

		// [F5] Shared truncation for tool_use JSON dumps.
		const TOOL_JSON_CAP = 4000;
		const capJson = (s) =>
			s.length <= TOOL_JSON_CAP
				? s
				: s.slice(0, TOOL_JSON_CAP) +
					`\n…(truncated, ${s.length} chars total — full input in the API tree)`;

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
							if (block.thinking?.trim()) {
								// [F12] Dynamic fence: thinking containing
								// ``` can't break out.
								const th = block.thinking.trim();
								const f = fenceFor(th);
								md.push(
									`<details><summary>💭 Thinking</summary>\n\n${f}\n${th}\n${f}\n\n</details>\n`,
								);
							}
							break;
						case "tool_use": {
							const inp = block.input || {};
							// [F1] Blocks reconstruction consumed are
							// rendered as refs below.
							if (blockArtifact.has(block)) break;
							// [v7.1] Artifact-shaped blocks that were NOT
							// consumed (fold failed / no create seen /
							// extraction disabled) previously vanished with
							// only a counter. Render them (capped) so the
							// edit content isn't lost — it may exist nowhere
							// else.
							const stray = isArtifactShaped(block);
							if (stray) unconsumedArtifactBlocks++; // [F26]
							md.push(
								`<details><summary>🔧 ${block.name || "Tool use"}${stray ? " ⚠️ (not folded into an exported file)" : ""}</summary>\n`,
							);
							const s =
								typeof inp === "string"
									? inp
									: JSON.stringify(inp, null, 2);
							// [F5] Truncate WITH a note (was: silently
							// dropped past 800 chars).
							const shown = capJson(s);
							const f = fenceFor(shown);
							md.push(f + "json\n" + shown + "\n" + f + "\n");
							md.push("</details>\n");
							break;
						}
						case "tool_result": {
							md.push(
								`<details><summary>📋 ${resultName(block)}</summary>\n`,
							);
							let has = false;
							// [F12] applied to every raw dump below.
							const dump = (txt) => {
								const f = fenceFor(txt);
								md.push(f + "\n" + txt + "\n" + f + "\n");
								has = true;
							};
							// [v7.1] display_content is sometimes an OBJECT
							// (was rendered as "[object Object]").
							if (block.display_content != null) {
								if (
									typeof block.display_content === "string"
								) {
									md.push(block.display_content + "\n");
								} else {
									dump(
										capJson(
											JSON.stringify(
												block.display_content,
												null,
												2,
											),
										),
									);
								}
								has = true;
							}
							if (Array.isArray(block.content)) {
								block.content.forEach((item) => {
									if (item.type === "text" && item.text) {
										dump(item.text);
									} else if (typeof item === "string") {
										dump(item);
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
								dump(block.content);
							}
							if (!has && block.text) dump(block.text);
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
					`${i + 1}. **${a.title}**${a.type ? " — " + a.type : ""} → \`${a.exportPath}\`${a.versions > 1 ? ` (${a.versions} versions folded)` : ""}${a.foldFailures ? ` ⚠️ ${a.foldFailures} edit(s) failed to fold — file may be stale` : ""}`,
				),
			);
			md.push("");
		}

		// [F3] The old blanket \n{3,} collapse mutated code inside fences
		// (consecutive blank lines in code were squashed).
		const finalMd = collapseOutsideFences(md.join("\n")).trim() + "\n";

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
								// [F1]/[v7.1] Same rule as the md renderer:
								// suppress only consumed blocks; render
								// artifact-shaped strays with a warning.
								if (blockArtifact.has(block)) break;
								const stray = isArtifactShaped(block);
								L.push(
									`<details><summary>${escHtml(block.name || "Tool use")}${stray ? " ⚠️ (not folded into an exported file)" : ""}</summary>`,
								);
								const s =
									typeof inp === "string"
										? inp
										: JSON.stringify(inp, null, 2);
								// [F5] Same cap as markdown (was: unbounded).
								L.push(
									`<pre><code>${escHtml(capJson(s))}</code></pre></details>`,
								);
								break;
							}
							case "tool_result": {
								L.push(
									`<details><summary>${escHtml(resultName(block))}</summary>`,
								);
								// [v7.1] display_content object handling.
								if (block.display_content != null) {
									if (
										typeof block.display_content ===
										"string"
									)
										L.push(
											`<div>${markdownToHtml(block.display_content)}</div>`,
										);
									else
										L.push(
											`<pre>${escHtml(capJson(JSON.stringify(block.display_content, null, 2)))}</pre>`,
										);
								}
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
			const raw = turns
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
			// [F25] Tool-only turns filter to nothing, which can leave
			// consecutive same-role messages — invalid for the Messages
			// API's strict alternation. Merge adjacent same-role.
			const messages = [];
			for (const m of raw) {
				const last = messages[messages.length - 1];
				if (last && last.role === m.role)
					last.content += "\n\n" + m.content;
				else messages.push({ ...m });
			}
			return JSON.stringify(
				{ model: apiModel || "unknown", max_tokens: 8192, messages },
				null,
				2,
			);
		}

		// ── [F22→v7.1] Uploaded files → uploads/ ────────────────────────────
		// VERIFIED: API file entries expose a fetchable `path` (same
		// credentials as chat images), so we download the ORIGINAL uploads.
		// extracted_content (attachments) is kept as a .txt fallback for
		// entries that have text but no path.
		const uploadFiles = [];
		{
			const usedUp = new Set();
			const seenSource = new Set(); // same upload can appear in multiple turns
			const uniqueName = (rawName, forcedExt) => {
				let base =
					rawName
						.replace(/[^a-zA-Z0-9_.-]/g, "_")
						.substring(0, 100) || "upload";
				if (forcedExt) base += forcedExt;
				let name = base;
				let n = 2;
				const dot = base.lastIndexOf(".");
				const stem = dot > 0 ? base.slice(0, dot) : base;
				const xt = dot > 0 ? base.slice(dot) : "";
				while (usedUp.has(name)) name = `${stem}_${n++}${xt}`;
				usedUp.add(name);
				return name;
			};
			for (const t of turns) {
				for (const f of t.files || []) {
					const sourceKey = f.fileUuid || f.fetchPath || f.filename;
					if (seenSource.has(sourceKey)) continue;
					seenSource.add(sourceKey);
					// [v7.3] CONFIRMED via live probe: `path` for
					// file_kind "blob" is the file's location inside
					// Claude's sandbox container (/mnt/user-data/uploads/…),
					// NOT a web URL — every endpoint guess 404s and the SPA
					// shell answers the raw path. Only attempt a web fetch
					// when the path plausibly is one; otherwise use the
					// extracted-text fallback.
					const isWebPath =
						typeof f.fetchPath === "string" &&
						(f.fetchPath.startsWith("/api/") ||
							f.fetchPath.includes("/files/")) &&
						!f.fetchPath.startsWith("/mnt/");
					if (cfg.downloadUploads && f.fetchPath && isWebPath) {
						uploadFiles.push({
							kind: "fetch",
							fetchPath: f.fetchPath,
							filename: f.filename,
							expectedSize:
								typeof f.size === "number" ? f.size : null,
							exportPath:
								"uploads/" + uniqueName(f.filename),
						});
					} else if (f.extracted) {
						uploadFiles.push({
							kind: "text",
							filename: f.filename,
							content: f.extracted,
							exportPath:
								"uploads/" +
								uniqueName(f.filename, ".txt"),
						});
					}
				}
			}
			if (uploadFiles.length) {
				setStatus(
					`📎 Downloading ${uploadFiles.length} uploaded file(s)...`,
				);
				for (const u of uploadFiles) {
					if (u.kind === "text") {
						await writeFile(u.exportPath, u.content);
						u.saved = true;
						continue;
					}
					// [v7.2] claude.ai's SPA catch-all serves the app-shell
					// HTML with a 200 for unknown routes — v7.1 saved that
					// as the "file". Validate before saving, and try an
					// /api-prefixed candidate too.
					const candidates = [u.fetchPath];
					if (!u.fetchPath.startsWith("/api"))
						candidates.push("/api" + u.fetchPath);
					for (const url of candidates) {
						try {
							const resp = await fetch(url, {
								credentials: "include",
							});
							if (!resp.ok) {
								console.warn(
									`${TAG} Upload fetch ${resp.status} for ${u.filename} at ${url}`,
								);
								continue;
							}
							const blob = await resp.blob();
							const head = await blob.slice(0, 256).text();
							const isHtmlDoc =
								/^\s*(<!doctype html|<html)/i.test(head);
							if (
								isHtmlDoc &&
								!/\.html?$/i.test(u.filename)
							) {
								console.warn(
									`${TAG} ${url} returned the app shell (HTML) for ${u.filename} — wrong endpoint, not saving`,
								);
								continue;
							}
							if (
								u.expectedSize != null &&
								blob.size !== u.expectedSize
							) {
								console.warn(
									`${TAG} Size mismatch for ${u.filename}: got ${blob.size}, API says ${u.expectedSize} — saving but flagging`,
								);
								u.sizeMismatch = true;
							}
							await writeFile(u.exportPath, blob);
							u.saved = true;
							break;
						} catch (e) {
							console.warn(
								`${TAG} Upload fetch error for ${u.filename} at ${url}:`,
								e.message,
							);
						}
					}
					if (!u.saved)
						console.warn(
							`${TAG} Upload NOT saved: ${u.filename} (no candidate URL returned valid content)`,
						);
				}
				console.log(
					`${TAG} Uploads saved: ${uploadFiles.filter((u) => u.saved).length}/${uploadFiles.length}`,
				);
			}
		}

		// ── Manifest ────────────────────────────────────────────────────────
		const outputsList = ["transcript.md"];
		outputsList.push(
			...uploadFiles.filter((u) => u.saved).map((u) => u.exportPath),
		);
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
			exporterVersion: "v" + VERSION,
			contentSource: source,
			model: apiModel || "unknown",
			// [F26] "Did the export lose anything?" — answerable from here.
			telemetry: {
				foldFailures,
				imagesFailed: cfg.downloadImages
					? allImages.filter((i) => !i.downloaded).length
					: 0,
				uploadsFailed: uploadFiles.filter((u) => !u.saved).length,
				uploadsSuspect: uploadFiles.filter((u) => u.sizeMismatch)
					.length, // [v7.2]
				unconsumedArtifactBlocks,
			},
			config: {
				extractArtifacts: cfg.extractArtifacts,
				downloadImages: cfg.downloadImages,
				downloadUploads: cfg.downloadUploads,
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
				foldFailures: a.foldFailures || 0, // [F7]
				// [v7.1] Bytes (matches ls), not UTF-16 char count.
				contentLength: new TextEncoder().encode(a.content).length,
			})),
			images: allImages.map((img) => ({
				alt: img.alt,
				src: img.src,
				downloaded: !!img.downloaded,
			})),
			// [v7.1] savedTo = where the original (or extracted text)
			// landed in uploads/, null if fetch failed or disabled.
			uploadedFiles: turns.flatMap((t) =>
				(t.files || []).map((f) => ({
					filename: f.filename,
					ext: f.ext,
					size: f.size,
					savedTo:
						uploadFiles.find(
							(u) => u.saved && u.filename === f.filename,
						)?.exportPath || null,
				})),
			),
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
		// (uploads/ files were already written in the F22 section above)

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

		// ── Update history [F20: AFTER the ZIP is triggered] ────────────────
		// A save-dialog cancel still can't be detected from JS — known
		// limitation — but a buildZip throw no longer records a phantom
		// export.
		if (cfg.skipPreviouslyExported && chatId !== "unknown") {
			const history = safeParse(
				localStorage.getItem("claude_export_history"),
				{},
			); // [F16]
			history[chatId] = { exportedAt: exportTime, title: chatTitle };
			localStorage.setItem(
				"claude_export_history",
				JSON.stringify(history),
			);
		}

		const dlImgs = allImages.filter((i) => i.downloaded).length;
		setStatus(
			[
				`✅ Export complete! (${useFolder ? "📂 Folder" : "📦 ZIP"})`,
				``,
				`📝 Transcript: ${turns.length} turns (source: ${source})`,
				`📄 Artifacts: ${artifactFiles.length} files`,
				`🖼️ Images: ${dlImgs}/${allImages.length}`,
				`📎 Uploads saved: ${uploadFiles.filter((u) => u.saved).length}/${manifest.uploadedFiles.length} referenced`,
				cfg.apiFormat ? `📋 API format: conversation.api.json` : "",
				cfg.htmlOutput ? `📄 HTML: conversation.html` : "",
			]
				.filter(Boolean)
				.join("\n"),
		);
		await sleep(8000);
	} catch (err) {
		console.error(TAG + " Export failed:", err);
		setStatus("❌ " + err.message + "\n\nCheck console for details.");
		await sleep(10000);
	} finally {
		overlay.remove();
	}
})();
