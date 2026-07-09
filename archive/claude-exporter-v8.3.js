// =============================================================================
// Claude.ai Chat Exporter v8.3 — Self-contained, API-primary, no external deps
// =============================================================================
// Run on any https://claude.ai/chat/<id> page (console paste or bookmarklet).
//
// v8.3 (batch 2, user-requested):
//   - Font-size toggles A−/A/A+ (0.8 / 0.875 / 1.0 em = 12.8/14/16px),
//     default 0.8em, persisted like the width toggle.
//   - "Expand turns" (turn level only) vs "Expand all" (now REALLY all —
//     nested Thinking/tool sections too, which the old button missed);
//     "Collapse all" closes nested sections as well. Header's More details
//     is deliberately left alone by all three.
//   - Header redesigned as a card (surface bg, border, radius): model as a
//     mauve pill, blue/peach turn split, muted created/lifespan. The
//     fold-failure line is reworded ("N file edits couldn't be rebuilt
//     into files — shown as raw edits in the transcript instead") and
//     demoted to a muted footnote with an amber dot; yellow ⚠️ is now
//     reserved for excluded branch messages. transcript.md mirrors both.
//     "More details" reads as a control: sky, caret that rotates, hover
//     underline, separator line above.
//   - Per-turn elapsed time (vs previous turn) in turn summaries and md
//     headers: "2 days 3 h" / "4 hrs 12 m" / "3 min 42 s" / "18 s".
//     Skipped for turns without raw API timestamps (DOM fallback).
//
// v8.2 (batch, user-requested):
//   - Popup tooltips FIXED: the tip element painted behind the backdrop
//     (equal z-index, earlier DOM order) — now attached inside it. The ⓘ
//     dots are gone; hovering the row is the trigger.
//   - thinkingMd fences tagged ```md (thinking treated as markdown);
//     tool-result dumps in the transcript get guessLang tags.
//   - HTML: body font-weight 300 (user's Nerd Font maps 400→heavy), bold
//     pinned on strong/summaries/roles/buttons; Claude turns peach (role,
//     border, tint), inline code moved to green; S/M/L width toggles
//     (950/1400/1900px, vw-capped, persisted, M default); faint
//     scroll-to-top button; header shows model/turn-split/created/lifespan
//     plus warnings, with everything else in a collapsed "More details"
//     grid (stats, recovery, branch, settings, chat summary).
//   - transcript.md mirrors the same lean header + <details> block.
//   - Completion summary redesigned: destination + size + duration,
//     branch confirmation, decomposed uploads (unique / not retrievable /
//     duplicate refs), files inventory, and a visible ⚠️ fold-failure
//     line. Overlay is monospace so columns align.
//
// v8.1 (HTML polish, user-requested):
//   a) HTML section summaries carry the same icons as the markdown
//      (👤/🤖 turns, 💭 Thinking, 🔧 tool, 📋 result, 📑 index).
//   b) Copy buttons are now a ⧉ icon (title-attr explains; md implied).
//   c) EVERY subsection (thinking / tool call / tool result) has its own ⧉
//      that copies just that block as Markdown — block markdown is built by
//      shared helpers so copies match transcript.md exactly.
//   e) Fenced code without a language gets an educated guess
//      (json/bash/python/js/html/sql/css → else plaintext) so highlight.js
//      colours everything; tool dumps are tagged language-json etc.
//   f) Primary font: "JetBrainsMono Nerd Font Mono" (user-installed),
//      falling back to JetBrains Mono / Fira Code / ui-monospace.
//   g) max-width 950px.  h) Exported time human-readable (en-AU locale,
//      ISO on hover).  i) expand/collapse caret vertically centred.
//   j) Colour scheme: user-supplied Catppuccin-Macchiato-derived palette
//      via CSS variables; hljs theme switched to tokyo-night-dark to match.
//
// v8:
//   - Config popup fully redesigned (Batch URL Downloader visual language):
//     dark near-black palette, glow-dot header, 2-column card grid, hover
//     tooltip on EVERY option (plain-English title + detail), whole-row
//     click targets, ghost/solid buttons, Escape + backdrop-click cancel.
//   - Chat info preview in the popup header (messages · model). The API
//     fetch now starts BEFORE the popup and is reused by the export.
//   - New content toggles: includeThinking, includeToolCalls (both default
//     on). File/artifact references stay in the transcript either way.
//   - Default change: skipPreviouslyExported now defaults ON (warn banner
//     only — never blocks). NOTE: a previously saved config overrides this.
//   - HTML page: every turn is a collapsible <details> with its own
//     "Copy MD" button (copies that turn as Markdown); Artifacts Index has
//     one too; toolbar adds Expand all / Collapse all / Copy ALL as
//     Markdown. Per-turn markdown is embedded as JSON (script-safe
//     \u003c-escaped) — built once and shared with transcript.md.
//   - Status overlay + resume banner restyled to the same palette.
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
	const VERSION = "8.3";
	const TAG = `[v${VERSION}]`;
	// [v8.3] user-specified ladder: "2 days 3 h", "4 hrs 12 m",
	// "3 min 42 s", "18 s" — full label on the primary unit, single letter
	// on the secondary.
	const elapsedNice = (ms) => {
		if (!Number.isFinite(ms) || ms < 0) return null;
		const s = Math.round(ms / 1000);
		if (s < 60) return `${s} s`;
		const m = Math.floor(s / 60);
		if (m < 60) return `${m} min ${s % 60} s`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h} ${h === 1 ? "hr" : "hrs"} ${m % 60} m`;
		const d = Math.floor(h / 24);
		return `${d} ${d === 1 ? "day" : "days"} ${h % 24} h`;
	};
	const humanSize = (b) => {
		if (!Number.isFinite(b)) return "?";
		const u = ["B", "KB", "MB", "GB"];
		let n = b,
			i = 0;
		while (n >= 1024 && i < u.length - 1) {
			n /= 1024;
			i++;
		}
		return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
	};

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
		includeThinking: true, // [v8] content toggle
		includeToolCalls: true, // [v8] content toggle
		antArtifactRegex: true,
		imageConcurrency: 5,
		skipPreviouslyExported: true, // [v8] on by default: warns, never blocks
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
	// [v8.2] set by extractApiMessages; used by the HTML header + summary.
	let branchStats = null;
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

	// ── UI palette (matches Batch URL Downloader) ────────────────────────
	const C = {
		bg: "#0e0e11",
		panel: "#16161b",
		panel2: "#1c1c22",
		line: "#2a2a33",
		text: "#e7e7ea",
		dim: "#8b8b96",
		faint: "#6a6a74",
		accent: "#5b7cfa",
		green: "#3ecf8e",
		amber: "#e0a458",
		red: "#f26d6d",
	};
	const $el = (t, s = {}, txt) => {
		const e = document.createElement(t);
		Object.assign(e.style, s);
		if (txt != null) e.textContent = txt;
		return e;
	};

	// Plain-English tooltips, one per option. First line = short summary,
	// second = detail.
	const TIPS = {
		transcript: [
			"The conversation as Markdown",
			"Always included. Saves the whole chat as transcript.md — your messages, Claude's replies, and references to every extracted file.",
		],
		extractArtifacts: [
			"Rebuild the files Claude created",
			"Collects artifacts and code files Claude wrote, applies every edit made during the chat, and saves the final versions into artifacts/ and files/.",
		],
		downloadImages: [
			"Save every image in the chat",
			"Downloads images into images/ and links them from the transcript. The page scrolls through the whole chat first, so long chats take a little longer.",
		],
		downloadUploads: [
			"Recover files you uploaded",
			"Saves the text content of your uploads into uploads/ when Claude's servers provide it. Original binary files usually can't be retrieved — only their extracted text.",
		],
		manifest: [
			"A machine-readable receipt",
			"manifest.json lists everything exported, the settings used, and any warnings — for example edits that could not be applied to a file.",
		],
		apiFormat: [
			"The chat as an API request",
			"conversation.api.json shapes the conversation as an Anthropic Messages API request body, ready to replay or continue via the API.",
		],
		htmlOutput: [
			"A styled page you can open anywhere",
			"conversation.html is a self-contained page with collapsible turns, syntax highlighting, and copy-as-Markdown buttons on every turn.",
		],
		stripSystemReminders: [
			"Hide Anthropic's housekeeping text",
			"Removes automatic reminder blocks that get attached to your messages behind the scenes, so the transcript shows only what you actually wrote.",
		],
		includeThinking: [
			"Keep Claude's reasoning",
			"Includes Claude's internal thinking blocks, folded into collapsible sections. Turn off for a cleaner, conversation-only export.",
		],
		includeToolCalls: [
			"Keep tool activity",
			"Includes tool calls and their results — web searches, code runs, file edits. Turn off to export just the conversation text. File references stay either way.",
		],
		antArtifactRegex: [
			"Fallback for older chats",
			"Also scans message text for artifact tags, which older chats used. Harmless to leave on; it only adds files the main method missed.",
		],
		imageConcurrency: [
			"Parallel image downloads",
			"How many images download at once. Higher is faster but harder on the server. 5 is a safe default.",
		],
		skipPreviouslyExported: [
			"Warn before exporting twice",
			"If this chat was exported before, a small banner shows the date and asks first. It never blocks you — one click exports again.",
		],
		storage_auto: [
			"Folder if possible, ZIP if not",
			"Tries to save straight into a folder you pick (Chromium browsers). Falls back to a single ZIP download anywhere else.",
		],
		storage_folder: [
			"Always write into a folder",
			"Asks for a folder and writes files directly into it. Needs a Chromium browser; fails cleanly elsewhere.",
		],
		storage_zip: [
			"Always download one ZIP",
			"Bundles everything into a single ZIP. Works in every browser — the ZIP is built locally with no external libraries.",
		],
	};

	function showConfigPopup(defaults, infoPromise) {
		return new Promise((resolve, reject) => {
			const cfg = structuredClone(defaults);

			const backdrop = $el("div", {
				position: "fixed",
				inset: "0",
				background: "rgba(0,0,0,0.66)",
				backdropFilter: "blur(3px)",
				zIndex: "2147483647",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontFamily: "system-ui, -apple-system, sans-serif",
			});
			const modal = $el("div", {
				background: C.bg,
				color: C.text,
				borderRadius: "16px",
				width: "950px",
				maxWidth: "96vw",
				maxHeight: "92vh",
				display: "flex",
				flexDirection: "column",
				border: `1px solid ${C.line}`,
				boxShadow:
					"0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.02) inset",
				fontSize: "14px",
				overflow: "hidden",
			});

			// ── header: glow dot · title · chat info (async) ───────────────
			const header = $el("div", {
				padding: "16px 24px",
				borderBottom: `1px solid ${C.line}`,
				display: "flex",
				alignItems: "center",
				gap: "12px",
				flexShrink: "0",
			});
			header.appendChild(
				$el("div", {
					width: "10px",
					height: "10px",
					borderRadius: "50%",
					background: C.accent,
					boxShadow: `0 0 12px ${C.accent}`,
				}),
			);
			header.appendChild(
				$el(
					"div",
					{
						fontSize: "16px",
						fontWeight: "600",
						letterSpacing: "0.2px",
					},
					"Claude Chat Exporter",
				),
			);
			header.appendChild(
				$el("div", { fontSize: "11px", color: C.faint }, "v" + VERSION),
			);
			const chatInfo = $el(
				"div",
				{ marginLeft: "auto", fontSize: "12px", color: C.faint },
				"loading chat info…",
			);
			header.appendChild(chatInfo);
			modal.appendChild(header);
			// Chat info preview: fills in when the (shared) API fetch lands.
			if (infoPromise)
				infoPromise
					.then((d) => {
						if (!d) {
							chatInfo.textContent =
								"chat info unavailable (DOM fallback)";
							return;
						}
						const n = (d.chat_messages || d.messages || []).length;
						chatInfo.textContent = `${n} messages · ${d.model || "model unknown"}`;
						chatInfo.style.color = C.dim;
					})
					.catch(() => {
						chatInfo.textContent = "chat info unavailable";
					});

			// ── shared floating tooltip (one element, repositioned) ────────
			const tip = $el("div", {
				position: "fixed",
				zIndex: "2147483647",
				maxWidth: "320px",
				background: C.panel2,
				border: `1px solid ${C.line}`,
				borderRadius: "10px",
				padding: "10px 14px",
				fontSize: "12px",
				lineHeight: "1.55",
				color: C.dim,
				boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
				display: "none",
				pointerEvents: "none",
			});
			const tipTitle = $el("div", {
				color: C.text,
				fontWeight: "600",
				marginBottom: "4px",
				fontSize: "12.5px",
			});
			const tipBody = $el("div", {});
			tip.appendChild(tipTitle);
			tip.appendChild(tipBody);
			// [v8.2] The tip was appended to <body> BEFORE the backdrop; equal
			// z-indexes tie-break by DOM order, so it painted BEHIND the modal
			// and tooltips never showed. Inside the backdrop = always on top.
			backdrop.appendChild(tip);
			const showTip = (anchor, key) => {
				const t = TIPS[key];
				if (!t) return;
				tipTitle.textContent = t[0];
				tipBody.textContent = t[1];
				tip.style.display = "block";
				const r = anchor.getBoundingClientRect();
				// Prefer right of the row; flip below if no room.
				let x = r.right + 12;
				let y = r.top - 4;
				tip.style.left = "0px";
				tip.style.top = "0px";
				const tw = tip.offsetWidth;
				const th = tip.offsetHeight;
				if (x + tw > window.innerWidth - 8) {
					x = Math.max(8, r.left);
					y = r.bottom + 8;
				}
				if (y + th > window.innerHeight - 8)
					y = Math.max(8, window.innerHeight - th - 8);
				tip.style.left = x + "px";
				tip.style.top = y + "px";
			};
			const hideTip = () => (tip.style.display = "none");

			// ── body: 2-column grid of panel cards ─────────────────────────
			const body = $el("div", {
				padding: "18px 24px",
				overflowY: "auto",
				display: "grid",
				gridTemplateColumns: "1fr 1fr",
				gap: "14px",
				alignItems: "start",
			});
			modal.appendChild(body);

			const mkCard = (titleTxt) => {
				const card = $el("div", {
					background: C.panel,
					border: `1px solid ${C.line}`,
					borderRadius: "12px",
					padding: "14px 16px",
					display: "flex",
					flexDirection: "column",
					gap: "2px",
				});
				card.appendChild(
					$el(
						"div",
						{
							fontSize: "11.5px",
							fontWeight: "600",
							color: C.accent,
							textTransform: "uppercase",
							letterSpacing: "0.8px",
							marginBottom: "8px",
						},
						titleTxt,
					),
				);
				body.appendChild(card);
				return card;
			};

			const mkRow = (parent, tipKey) => {
				const row = $el("div", {
					display: "flex",
					alignItems: "center",
					gap: "9px",
					padding: "6px 8px",
					margin: "0 -8px",
					borderRadius: "8px",
					cursor: "pointer",
					fontSize: "13px",
					color: C.text,
					transition: "background .12s",
				});
				row.addEventListener("mouseenter", () => {
					row.style.background = C.panel2;
					showTip(row, tipKey);
				});
				row.addEventListener("mouseleave", () => {
					row.style.background = "transparent";
					hideTip();
				});
				parent.appendChild(row);
				return row;
			};

			const addCheckbox = (parent, key, label, alwaysOn = false) => {
				const row = mkRow(parent, key || "transcript");
				const inp = document.createElement("input");
				inp.type = "checkbox";
				inp.checked = alwaysOn ? true : cfg[key];
				inp.disabled = alwaysOn;
				Object.assign(inp.style, {
					accentColor: C.accent,
					width: "15px",
					height: "15px",
					flexShrink: "0",
					cursor: alwaysOn ? "default" : "pointer",
				});
				if (alwaysOn) row.style.opacity = "0.55";
				const lbl = $el("span", {}, label);
				row.appendChild(inp);
				row.appendChild(lbl);
				const toggle = () => {
					if (alwaysOn) return;
					inp.checked = !inp.checked;
					cfg[key] = inp.checked;
				};
				// whole row clickable; keep native checkbox behaviour sane
				row.addEventListener("click", (e) => {
					if (e.target === inp) {
						cfg[key] = inp.checked;
						return;
					}
					toggle();
				});
				return inp;
			};

			const addNumber = (parent, key, label, min, max) => {
				const row = mkRow(parent, key);
				row.style.cursor = "default";
				row.appendChild($el("span", {}, label));
				const inp = document.createElement("input");
				inp.type = "number";
				inp.value = cfg[key];
				inp.min = min;
				inp.max = max;
				Object.assign(inp.style, {
					width: "64px",
					background: C.bg,
					color: C.text,
					border: `1px solid ${C.line}`,
					borderRadius: "6px",
					padding: "4px 8px",
					fontSize: "13px",
					outline: "none",
				});
				inp.addEventListener("change", () => {
					cfg[key] = Math.max(
						min,
						Math.min(max, parseInt(inp.value) || min),
					);
					inp.value = cfg[key];
				});
				row.appendChild(inp);
			};

			const addRadio = (parent, key, value, label) => {
				const row = mkRow(parent, "storage_" + value);
				const inp = document.createElement("input");
				inp.type = "radio";
				inp.name = "cce-" + key;
				inp.checked = cfg[key] === value;
				Object.assign(inp.style, {
					accentColor: C.accent,
					flexShrink: "0",
				});
				row.appendChild(inp);
				row.appendChild($el("span", {}, label));
				const radios = (parent.__radios = parent.__radios || []);
				radios.push(inp);
				row.addEventListener("click", () => {
					radios.forEach((r) => (r.checked = false));
					inp.checked = true;
					cfg[key] = value;
				});
			};

			// column 1
			const fsOutput = mkCard("Output formats");
			addCheckbox(fsOutput, null, "Transcript (Markdown)", true);
			addCheckbox(fsOutput, "extractArtifacts", "Artifacts extraction");
			addCheckbox(fsOutput, "downloadImages", "Images download");
			addCheckbox(
				fsOutput,
				"downloadUploads",
				"Uploaded files (extracted text)",
			);
			addCheckbox(fsOutput, "manifest", "Manifest (JSON)");
			addCheckbox(fsOutput, "apiFormat", "API-compatible format");
			addCheckbox(fsOutput, "htmlOutput", "HTML page");

			const fsBehavior = mkCard("Export behaviour");
			addCheckbox(
				fsBehavior,
				"skipPreviouslyExported",
				"Warn if exported before",
			);
			addRadio(
				fsBehavior,
				"storageMethod",
				"auto",
				"Auto (folder → ZIP fallback)",
			);
			addRadio(fsBehavior, "storageMethod", "folder", "Force folder");
			addRadio(fsBehavior, "storageMethod", "zip", "Force ZIP");

			// column 2
			const fsContent = mkCard("Content");
			addCheckbox(
				fsContent,
				"stripSystemReminders",
				"Strip system reminders",
			);
			addCheckbox(
				fsContent,
				"includeThinking",
				"Include thinking blocks",
			);
			addCheckbox(
				fsContent,
				"includeToolCalls",
				"Include tool calls & results",
			);
			addCheckbox(
				fsContent,
				"antArtifactRegex",
				"antArtifact regex fallback",
			);

			const fsPerf = mkCard("Performance");
			addNumber(fsPerf, "imageConcurrency", "Image concurrency", 1, 20);

			// ── footer ──────────────────────────────────────────────────────
			const footer = $el("div", {
				padding: "14px 24px 16px",
				borderTop: `1px solid ${C.line}`,
				flexShrink: "0",
				display: "flex",
				flexDirection: "column",
				gap: "8px",
			});
			footer.appendChild(
				$el(
					"div",
					{ fontSize: "11.5px", color: C.faint, lineHeight: "1.5" },
					"Settings are remembered for next time. ZIP is built locally (no external libraries). Folder mode needs a Chromium browser. Hover any option for details.",
				),
			);
			const status = $el("div", {
				fontSize: "12px",
				color: C.amber,
				minHeight: "16px",
			});
			footer.appendChild(status);

			const btnRow = $el("div", {
				display: "flex",
				gap: "10px",
				justifyContent: "flex-end",
			});
			const mkBtn = (label, solid) => {
				const b = $el(
					"button",
					{
						background: solid ? C.accent : "transparent",
						border: solid ? "none" : `1px solid ${C.line}`,
						color: solid ? "#fff" : C.dim,
						padding: "9px 22px",
						borderRadius: "9px",
						cursor: "pointer",
						fontSize: "13.5px",
						fontWeight: "600",
						transition: "filter .15s",
						outline: "none",
					},
					label,
				);
				b.addEventListener(
					"mouseenter",
					() => (b.style.filter = "brightness(1.15)"),
				);
				b.addEventListener(
					"mouseleave",
					() => (b.style.filter = "none"),
				);
				return b;
			};
			const cancelBtn = mkBtn("Cancel", false);
			const exportBtn = mkBtn("Export", true);
			btnRow.appendChild(cancelBtn);
			btnRow.appendChild(exportBtn);
			footer.appendChild(btnRow);
			modal.appendChild(footer);

			const cleanup = () => {
				document.removeEventListener("keydown", keyHandler);
				tip.remove();
			};

			// Folder picker MUST run inside this click handler to keep the
			// user gesture (fixes the silent v5 fallback / activation loss).
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
			backdrop.addEventListener("click", (e) => {
				if (e.target === backdrop) doCancel();
			});
			const keyHandler = (e) => {
				if (e.key === "Escape") doCancel();
			};
			document.addEventListener("keydown", keyHandler);

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
	// [v8.1-e] Educated guess for fenced code without a language tag, so
	// highlight.js has something to work with.
	const guessLang = (code) => {
		const c = (code || "").trim();
		if (!c) return "";
		if (/^[{\[]/.test(c) && /[}\]]\s*$/.test(c)) return "json";
		if (
			/^#!\s*\/bin\/(ba|z)?sh/.test(c) ||
			/^\s*(\$ |sudo |cd |ls |grep |curl |wget |npm |git |node |python3? |sed |awk |cat |echo )/m.test(
				c,
			)
		)
			return "bash";
		if (/^\s*(import|from)\s+[\w.]+|^\s*def\s+\w+\s*\(/m.test(c))
			return "python";
		if (/^\s*<!doctype html|^\s*<html|^\s*<svg/i.test(c)) return "html";
		if (
			/\b(const|let|var)\s+\w+\s*=|=>|function\s*\w*\s*\(|console\.\w+\(/.test(
				c,
			)
		)
			return "javascript";
		if (/^\s*(SELECT|INSERT INTO|UPDATE|CREATE TABLE)\b/im.test(c))
			return "sql";
		if (/^\s*[.#\w-]+\s*\{[^}]*:\s*[^}]+\}/m.test(c)) return "css";
		return "plaintext";
	};

	function markdownToHtml(md) {
		if (!md) return "";
		let html = escHtml(md);

		const codeBlocks = [];
		const stashBlock = (lang, code) => {
			const idx = codeBlocks.length;
			// [v8.1-e] Missing language → guess one for the highlighter.
			const lg = lang || guessLang(code);
			codeBlocks.push(
				`<pre><code class="${lg ? "language-" + lg : ""}">${code.trim()}</code></pre>`,
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
					branchStats = {
						active: path.length,
						total: arr.length,
					}; // [v8.2]
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
	// [v8] Chat identity + the API fetch start BEFORE the popup so the
	// popup can preview chat info; the export reuses the same promise (no
	// duplicate fetch).
	const chatUrl = window.location.href;
	const chatId = chatUrl.match(/\/chat\/([a-f0-9-]+)/)?.[1] || "unknown";
	const apiPromise = fetchConversationData(chatId).catch(() => null);

	let cfg;
	try {
		cfg = await showConfigPopup(CONFIG, apiPromise);
	} catch {
		console.log(TAG + " Export cancelled by user");
		return;
	}
	console.log(
		TAG + " Config:",
		JSON.stringify(cfg, (k, v) => (k.startsWith("_") ? undefined : v), 2),
	);

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
					zIndex: "2147483647",
					background: C.bg,
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
	const exportStart = Date.now(); // [v8.2] for the summary
	let zipBlobSize = null; // [v8.2]
	const overlay = document.createElement("div");
	Object.assign(overlay.style, {
		position: "fixed",
		top: "16px",
		right: "16px",
		zIndex: "2147483647",
		background: C.bg,
		fontFamily: "ui-monospace, monospace", // [v8.2] aligned summary
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
		const apiData = await apiPromise; // [v8] shared with the popup preview
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
					rawTs: m.created_at || null, // [v8.3] for elapsed calc
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
					rawTs: message.created_at || null, // [v8.3]
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

		// ── [F22→v7.1] Uploaded files → uploads/ ────────────────────────────
		// VERIFIED: API file entries expose a fetchable `path` (same
		// credentials as chat images), so we download the ORIGINAL uploads.
		// extracted_content (attachments) is kept as a .txt fallback for
		// entries that have text but no path.
		const uploadFiles = [];
		const uploadStats = { uniqueRefs: 0, retrievable: 0 }; // [v8.2]
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
			// [v8.2] decomposition for the summary + header
			uploadStats.uniqueRefs = seenSource.size;
			uploadStats.retrievable = uploadFiles.length;
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


		// ── Build markdown ──────────────────────────────────────────────────
		setStatus(`📝 Building transcript (${turns.length} turns)...`);
		const md = [];
		md.push(`# ${chatTitle}\n`);
		md.push(`> **Source:** ${chatUrl}`);
		md.push(`> **Exported:** ${exportTime}`);
		md.push(`> **Model:** ${apiModel || "unknown"}`);
		md.push(
			`> **Turns:** ${turns.length} (source: ${source})`,
		);
		// [v8.2] lean warnings + collapsed details, mirroring the HTML.
		// (branch/fold/meta lines are appended later, once known — see
		// %%MD_META%% below.)
		md.push("%%MD_META%%");
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

		// [v8.1-c] Block-level markdown builders — shared by turnToMd (the
		// transcript) and buildHtml (per-subsection ⧉ copy buttons), so a
		// copied section matches transcript.md exactly. Pure functions: the
		// unconsumed-block counter stays in turnToMd.
		const thinkingMd = (block) => {
			const th = block.thinking.trim();
			const f = fenceFor(th);
			// [v8.2] thinking is treated as markdown (```md), per user.
			return `<details><summary>💭 Thinking</summary>\n\n${f}md\n${th}\n${f}\n\n</details>\n`;
		};
		const toolUseMd = (block, stray) => {
			const inp = block.input || {};
			const s =
				typeof inp === "string" ? inp : JSON.stringify(inp, null, 2);
			const shown = capJson(s);
			const f = fenceFor(shown);
			return (
				`<details><summary>🔧 ${block.name || "Tool use"}${stray ? " ⚠️ (not folded into an exported file)" : ""}</summary>\n\n` +
				f +
				"json\n" +
				shown +
				"\n" +
				f +
				"\n\n</details>\n"
			);
		};
		const toolResultMd = (block) => {
			const md = [];
			md.push(`<details><summary>📋 ${resultName(block)}</summary>\n`);
			let has = false;
			const dump = (txt) => {
				const f = fenceFor(txt);
				// [v8.2] tag the fence so renderers can highlight it.
				md.push(f + guessLang(txt) + "\n" + txt + "\n" + f + "\n");
				has = true;
			};
			if (block.display_content != null) {
				if (typeof block.display_content === "string") {
					md.push(block.display_content + "\n");
				} else {
					dump(
						capJson(
							JSON.stringify(block.display_content, null, 2),
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
						if (item.title) md.push(`**${item.title}**`);
						if (item.url) md.push(`URL: ${item.url}`);
						md.push("");
						has = true;
					}
				});
			} else if (typeof block.content === "string") {
				dump(block.content);
			}
			if (!has && block.text) dump(block.text);
			md.push("</details>\n");
			return md.join("\n");
		};

		// [v8] Per-turn markdown builder. Used for BOTH the transcript and
		// the per-turn "Copy as Markdown" data embedded in the HTML page.
		// Content toggles: cfg.includeThinking / cfg.includeToolCalls.
		const turnToMd = (t) => {
			const md = [];
			if (t.role === "user") {
				const ts = t.timestamp || t.uiTimestamp;
				md.push(
					`## 👤 User${ts ? " — " + ts : ""}${t.elapsed ? " · ⏱ " + t.elapsed : ""}\n`,
				);
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
					`## 🤖 Claude${t.timestamp ? " — " + t.timestamp : ""}${t.elapsed ? " · ⏱ " + t.elapsed : ""}\n`,
				);
				for (const block of t.content) {
					switch (block.type) {
						case "text":
							if (block.text?.trim())
								md.push(block.text.trim() + "\n");
							break;
						case "thinking":
							if (!cfg.includeThinking) break; // [v8]
							if (block.thinking?.trim())
								md.push(thinkingMd(block)); // [v8.1-c] shared
							break;
						case "tool_use": {
							// [F1] Blocks reconstruction consumed are
							// rendered as refs below.
							if (blockArtifact.has(block)) break;
							const stray = isArtifactShaped(block);
							if (stray) unconsumedArtifactBlocks++; // [F26]
							if (!cfg.includeToolCalls) break; // [v8]
							md.push(toolUseMd(block, stray)); // [v8.1-c] shared
							break;
						}
						case "tool_result": {
							if (!cfg.includeToolCalls) break; // [v8]
							md.push(toolResultMd(block)); // [v8.1-c] shared
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
			// [F3] collapse only outside fences, per turn.
			return collapseOutsideFences(md.join("\n")).trim();
		};
		const turnMds = turns.map(turnToMd); // [v8] computed ONCE (counters!)
		const blockMds = []; // [v8.1-c] filled by buildHtml, embedded in md-data

		let artifactsIndexMd = "";
		if (artifactFiles.length) {
			const ix = ["## 📑 Artifacts Index\n"];
			artifactFiles.forEach((a, i) =>
				ix.push(
					`${i + 1}. **${a.title}**${a.type ? " — " + a.type : ""} → \`${a.exportPath}\`${a.versions > 1 ? ` (${a.versions} versions folded)` : ""}${a.foldFailures ? ` ⚠️ ${a.foldFailures} edit(s) failed to fold — file may be stale` : ""}`,
				),
			);
			artifactsIndexMd = ix.join("\n");
		}

		// [v8.2] Content + integrity stats for the header and summary.
		const humanSpan = (ms) => {
			if (!Number.isFinite(ms) || ms < 0) return null;
			const m = Math.round(ms / 60000);
			if (m < 60) return `${m} min`;
			const h = Math.floor(m / 60);
			if (h < 48) return `${h} h ${m % 60} min`;
			return `${Math.round(h / 24)} days`;
		};
		const chatStats = (() => {
			let thinking = 0,
				toolCalls = 0;
			for (const t of turns)
				for (const b of t.content || []) {
					if (b.type === "thinking" && b.thinking?.trim())
						thinking++;
					if (b.type === "tool_use") toolCalls++;
				}
			const joined = turnMds.join("\n");
			return {
				userTurns: turns.filter((t) => t.role === "user").length,
				asstTurns: turns.filter((t) => t.role === "assistant").length,
				thinking,
				toolCalls,
				words: joined.split(/\s+/).filter(Boolean).length,
				codeBlocks: Math.floor(
					(joined.match(/^`{3,}/gm) || []).length / 2,
				),
			};
		})();
		// [v8.2] chat-level metadata from the API response (absent on DOM
		// fallback — every field is optional).
		const chatMeta = {
			created: apiData?.created_at || null,
			updated: apiData?.updated_at || null,
			starred: !!apiData?.is_starred,
			temporary: !!apiData?.is_temporary,
			thinkingMode: apiData?.effective_thinking_mode || null,
			summary: (apiData?.summary || "").trim() || null,
			span:
				apiData?.created_at && apiData?.updated_at
					? humanSpan(
							new Date(apiData.updated_at) -
								new Date(apiData.created_at),
						)
					: null,
		};
		const fmtAU = (iso) =>
			iso
				? new Date(iso).toLocaleString("en-AU", {
						dateStyle: "medium",
						timeStyle: "short",
					})
				: null;

		// [v8.2] build the md meta block now that stats exist.
		{
			const lean = [];
			if (branchStats && branchStats.active < branchStats.total)
				lean.push(
					`> ⚠️ **${branchStats.total - branchStats.active} message(s) in abandoned edit branches excluded**`,
				);
			if (foldFailures > 0)
				lean.push(
					`> • ${foldFailures} file edit${foldFailures === 1 ? "" : "s"} couldn't be rebuilt into files — shown as raw edits in the transcript instead`,
				);
			const d = [];
			d.push("<details><summary>More details</summary>\n");
			const fmtAU2 = (iso) =>
				iso
					? new Date(iso).toLocaleString("en-AU", {
							dateStyle: "medium",
							timeStyle: "short",
						})
					: null;
			if (chatMeta.created)
				d.push(
					`- **Created:** ${fmtAU2(chatMeta.created)}${chatMeta.span ? " · spanned " + chatMeta.span : ""}`,
				);
			if (chatMeta.updated)
				d.push(`- **Last updated:** ${fmtAU2(chatMeta.updated)}`);
			if (chatMeta.starred) d.push("- **Starred:** ★ yes");
			if (chatMeta.temporary) d.push("- **Temporary chat:** yes");
			if (chatMeta.thinkingMode)
				d.push(`- **Thinking mode:** ${chatMeta.thinkingMode}`);
			d.push(
				`- **Split:** ${chatStats.userTurns} you / ${chatStats.asstTurns} Claude`,
			);
			d.push(
				`- **Content:** ≈${chatStats.words.toLocaleString()} words · ${chatStats.codeBlocks} code blocks · ${chatStats.thinking} thinking blocks · ${chatStats.toolCalls} tool calls`,
			);
			d.push(
				`- **Recovery:** ${artifactFiles.length} artifact(s) rebuilt${foldFailures ? ` · ${foldFailures} edit(s) not applied` : " · all edits applied"} · images ${allImages.filter((i) => i.downloaded).length}/${allImages.length} · uploads ${uploadFiles.filter((u) => u.saved).length} recovered`,
			);
			if (branchStats)
				d.push(
					`- **Branch:** active path ${branchStats.active}/${branchStats.total} messages`,
				);
			if (chatMeta.summary) d.push(`- **Summary:** *${chatMeta.summary}*`);
			d.push(`- **Exporter:** v${VERSION}`);
			d.push("\n</details>");
			const metaBlock =
				(lean.length ? lean.join("\n") + "\n\n" : "") + d.join("\n");
			const i = md.indexOf("%%MD_META%%");
			if (i >= 0) md[i] = metaBlock;
		}

		const finalMd =
			(
				md.join("\n") +
				"\n" +
				turnMds.join("\n\n---\n\n") +
				(artifactsIndexMd ? "\n\n---\n\n" + artifactsIndexMd : "")
			).trim() + "\n";


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
				`<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/tokyo-night-dark.min.css">`,
			);
			L.push(
				`<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js" onerror="window.__noHljs=1"><\/script>`,
			);
			// [v8.1] Palette: user-supplied Catppuccin-Macchiato-derived
			// colours. Surfaces/lines are derived shades in the same family.
			L.push(`<style>
  :root {
    --bg:#1f202f; --text:#ccd3f3; --muted:#6f738b;
    --yellow:#ddca9d; --blue:#93acef; --green:#afd89b;
    --peach:#e5a982; --sky:#8ec2e1; --mauve:#c2a2f1;
    --surface:#262838; --deep:#181925; --line:#34364a;
    --mono:"JetBrainsMono Nerd Font Mono","JetBrains Mono","Fira Code",ui-monospace,monospace;
  }
  /* [v8.2] font-weight 300: user's Nerd Font build maps faces one step
     heavy (400 renders as bold). Bold is pinned explicitly below. */
  body { background:var(--bg); color:var(--text); font-family:var(--mono),system-ui,sans-serif;
    margin:0 auto; padding:24px; line-height:1.7; font-weight:300;
    transition:max-width .2s; }
  body.f-s { font-size:0.8em; } body.f-m { font-size:0.875em; } body.f-l { font-size:1em; }
  body.w-s { max-width:min(950px, 94vw); }
  body.w-m { max-width:min(1400px, 94vw); }
  body.w-l { max-width:min(1900px, 92vw); }
  strong, summary, .role, th, button { font-weight:700; }
  h1 { color:var(--mauve); border-bottom:1px solid var(--line); padding-bottom:12px; font-size:1.5em; }
  h2,h3,h4,h5,h6 { color:var(--mauve); }
  .role { font-weight:bold; font-size:0.85em; text-transform:uppercase; letter-spacing:1px;
    display:flex; align-items:center; margin:0; }
  .user .role { color:var(--blue); } .assistant .role { color:var(--peach); }
  .timestamp { color:var(--muted); font-size:0.85em; margin-left:12px; font-weight:normal;
    text-transform:none; letter-spacing:normal; }
  details { margin:8px 0; background:var(--deep); border-radius:8px; padding:8px 12px; border:1px solid var(--line); }
  details:not(.turn) > summary { cursor:pointer; font-weight:bold; color:var(--sky);
    display:flex; align-items:center; gap:8px; list-style-position:inside; }
  pre { background:var(--deep); padding:14px 16px; border-radius:8px; overflow-x:auto; border:1px solid var(--line); }
  code { font-family:var(--mono); font-size:0.9em; }
  /* [v8.2] inline code green — peach now owns Claude's turn frames */
  p code, li code, td code { background:rgba(175,216,155,0.12); color:var(--green); padding:2px 6px; border-radius:4px; }
  a { color:var(--sky); } img { max-width:100%; border-radius:8px; margin:8px 0; }
  strong { color:var(--yellow); }
  table { border-collapse:collapse; margin:12px 0; width:100%; }
  th,td { border:1px solid var(--line); padding:6px 10px; text-align:left; }
  th { background:var(--surface); color:var(--blue); }
  blockquote { border-left:3px solid var(--muted); margin:8px 0; padding:4px 12px; color:var(--muted); }
  .meta { color:var(--muted); font-size:0.85em; border-bottom:1px solid var(--line); padding-bottom:12px; margin-bottom:12px; }
  .artifact-ref { background:rgba(194,162,241,0.08); border:1px solid var(--line); border-left:3px solid var(--mauve);
    border-radius:6px; padding:8px 12px; margin:8px 0; font-size:0.9em; }
  ul,ol { padding-left:24px; } li { margin:4px 0; }
  .toolbar { display:flex; gap:8px; margin:0 0 20px; flex-wrap:wrap; }
  .toolbar button, .copy-md { background:transparent; border:1px solid var(--line); color:var(--muted);
    padding:5px 12px; border-radius:7px; cursor:pointer; font-size:12px; font-weight:600;
    font-family:var(--mono); transition:color .15s, border-color .15s; }
  .toolbar button:hover, .copy-md:hover { color:var(--text); border-color:var(--muted); }
  details.turn { margin:24px 0; border-radius:10px; border:1px solid var(--line); padding:0; overflow:hidden; background:transparent; }
  details.turn.user { background:rgba(147,172,239,0.06); border-left:3px solid var(--blue); }
  details.turn.assistant { background:rgba(229,169,130,0.05); border-left:3px solid var(--peach); }
  details.turn > summary { list-style:none; cursor:pointer; padding:12px 20px; display:flex;
    align-items:center; gap:10px; user-select:none; }
  details.turn > summary::-webkit-details-marker { display:none; }
  /* [v8.1-i] caret vertically centred with the label text */
  details.turn > summary::before { content:"▶"; font-size:10px; color:var(--muted);
    transition:transform .15s; line-height:1; align-self:center; }
  details.turn[open] > summary::before { transform:rotate(90deg); }
  .turn-body { padding:0 20px 16px; }
  .copy-md { margin-left:auto; flex-shrink:0; }
  .copy-md.sub { padding:1px 8px; font-size:12px; }
  .idx { margin:24px 0; padding:16px 20px; border-radius:10px; border:1px solid var(--line);
    border-left:3px solid var(--mauve); background:var(--surface); }
  /* [v8.2] width toggle + scroll-to-top */
  .wbtns, .fbtns { display:flex; gap:6px; } .wbtns { margin-left:auto; }
  .toolbar button.active { border-color:var(--sky); color:var(--sky); }
  #totop { position:fixed; right:22px; bottom:22px; width:42px; height:42px; border-radius:10px;
    background:var(--surface); border:1px solid var(--line); color:var(--muted); font-size:18px;
    cursor:pointer; opacity:0; pointer-events:none; transition:opacity .2s; z-index:9; }
  #totop.show { opacity:0.3; pointer-events:auto; }
  #totop:hover { opacity:1; color:var(--text); }
  /* [v8.3] header card */
  .meta { line-height:1.9; background:var(--surface); border:1px solid var(--line);
    border-radius:10px; padding:14px 20px 10px; margin-bottom:12px; border-bottom:1px solid var(--line); }
  .meta .m-model { color:var(--mauve); font-weight:700; background:rgba(194,162,241,0.12);
    padding:1px 9px; border-radius:6px; }
  .meta .m-you { color:var(--blue); } .meta .m-claude { color:var(--peach); }
  .meta .m-warn { color:var(--yellow); }
  /* [v8.3] fold disclosure, demoted: muted footnote with a soft amber dot */
  .meta .m-note { color:var(--muted); font-size:0.88em; }
  .meta .m-note::before { content:"•"; color:var(--yellow); margin-right:7px; }
  details.more { background:transparent; border:none; border-top:1px solid var(--line);
    border-radius:0; padding:8px 0 0; margin:10px 0 0; }
  details.more > summary { color:var(--sky); font-size:0.9em; font-weight:700;
    display:inline-flex; align-items:center; gap:6px; cursor:pointer; }
  details.more > summary:hover { text-decoration:underline; }
  details.more > summary::before { content:"▸"; font-size:11px; transition:transform .15s; line-height:1; }
  details.more[open] > summary::before { transform:rotate(90deg); }
  .more-grid { display:grid; grid-template-columns:max-content 1fr; gap:2px 18px;
    font-size:0.88em; color:var(--muted); padding:8px 0 0 4px; }
  .more-grid .k { color:var(--sky); }
  .more-grid .v { color:var(--text); font-weight:300; }
  .more-grid .full { grid-column:1 / -1; font-style:italic; color:var(--muted); }
</style></head><body class="w-m f-s">`);
			L.push(`<h1>${escHtml(chatTitle)}</h1>`);
			// [v8.1-h] Human-readable local time; ISO kept on hover.
			const exportedNice = new Date(exportTime).toLocaleString("en-AU", {
				dateStyle: "full",
				timeStyle: "short",
			});
			// [v8.2] Lean header: identity + anything needing attention.
			// Everything else lives in the collapsed "More details".
			const meta = [];
			meta.push(
				`Source: <a href="${escHtml(chatUrl)}">${escHtml(chatUrl)}</a>`,
			);
			meta.push(
				`Exported: <span title="${escHtml(exportTime)}">${escHtml(exportedNice)}</span>`,
			);
			meta.push(
				`<span class="m-model">${escHtml(apiModel || "unknown")}</span> · ${turns.length} turns — <span class="m-you">${chatStats.userTurns} you</span> / <span class="m-claude">${chatStats.asstTurns} Claude</span>`,
			);
			if (chatMeta.created)
				meta.push(
					`Created: ${escHtml(fmtAU(chatMeta.created))}${chatMeta.span ? " · spanned " + escHtml(chatMeta.span) : ""}`,
				);
			if (branchStats && branchStats.active < branchStats.total)
				meta.push(
					`<span class="m-warn">⚠️ ${branchStats.total - branchStats.active} message(s) in abandoned edit branches excluded</span>`,
				);
			if (foldFailures > 0)
				meta.push(
					`<span class="m-note">${foldFailures} file edit${foldFailures === 1 ? "" : "s"} couldn't be rebuilt into files — shown as raw edits in the transcript instead</span>`,
				);
			L.push(`<div class="meta">${meta.join("<br>")}`);

			// "More details" grid (muted facts).
			const kv = [];
			const row = (k, v) =>
				kv.push(
					`<span class="k">${escHtml(k)}</span><span class="v">${v}</span>`,
				);
			if (chatMeta.updated)
				row("Last updated", escHtml(fmtAU(chatMeta.updated)));
			if (chatMeta.starred) row("Starred", "★ yes");
			if (chatMeta.temporary) row("Temporary chat", "yes");
			if (chatMeta.thinkingMode)
				row("Thinking mode", escHtml(chatMeta.thinkingMode));
			row(
				"Content",
				`≈${chatStats.words.toLocaleString()} words · ${chatStats.codeBlocks} code blocks · ${chatStats.thinking} thinking blocks · ${chatStats.toolCalls} tool calls`,
			);
			row(
				"Recovery",
				`${artifactFiles.length} artifact(s) rebuilt${foldFailures ? ` · ${foldFailures} edit(s) not applied` : " · all edits applied"} · images ${allImages.filter((i) => i.downloaded).length}/${allImages.length} · uploads ${uploadFiles.filter((u) => u.saved).length} recovered`,
			);
			if (branchStats)
				row(
					"Branch",
					`active path ${branchStats.active}/${branchStats.total} messages`,
				);
			row("Exporter", `v${VERSION}`);
			row(
				"Settings",
				escHtml(
					Object.entries(cfg)
						.filter(([k]) => !k.startsWith("_"))
						.map(([k, v]) => `${k}=${v}`)
						.join(" · "),
				),
			);
			let moreHtml = `<details class="more"><summary>More details</summary><div class="more-grid">${kv.join("")}`;
			if (chatMeta.summary)
				moreHtml += `<span class="full">“${escHtml(chatMeta.summary)}”</span>`;
			moreHtml += `</div></details>`;
			L.push(moreHtml);
			L.push(`</div>`);

			// [v8] toolbar: expand/collapse all + copy whole transcript
			L.push(
				`<div class="toolbar"><button data-act="expand-turns">Expand turns</button><button data-act="expand-all">Expand all</button><button data-act="collapse">Collapse all</button><button data-act="copyall">Copy ALL as Markdown</button><span class="wbtns"><button data-w="s" title="950px">S</button><button data-w="m" title="1400px">M</button><button data-w="l" title="1900px">L</button></span><span class="fbtns"><button data-f="s" title="12.8px">A−</button><button data-f="m" title="14px">A</button><button data-f="l" title="16px">A+</button></span></div>`,
			);

			turns.forEach((turn, ti) => {
				const cls = turn.role === "user" ? "user" : "assistant";
				// [v8.1-a] same icons as the markdown transcript
				const icon = turn.role === "user" ? "👤 User" : "🤖 Claude";
				const ts = turn.timestamp || turn.uiTimestamp || "";
				L.push(`<details class="turn ${cls}" open>`);
				L.push(
					`<summary><span class="role">${icon}<span class="timestamp">${escHtml(ts)}${turn.elapsed ? " · ⏱ " + escHtml(turn.elapsed) : ""}</span></span><button class="copy-md" data-i="${ti}" title="Copy this turn as Markdown">⧉</button></summary>`,
				);
				L.push(`<div class="turn-body">`);

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
							case "thinking": {
								if (!cfg.includeThinking) break; // [v8]
								if (!block.thinking?.trim()) break;
								// [v8.1-c] ⧉ = copy this section as Markdown
								const bi =
									blockMds.push(thinkingMd(block)) - 1;
								L.push(
									`<details><summary><span>💭 Thinking</span><button class="copy-md sub" data-b="${bi}" title="Copy this section as Markdown">⧉</button></summary><pre><code class="language-plaintext">${escHtml(block.thinking)}</code></pre></details>`,
								);
								break;
							}
							case "tool_use": {
								const inp = block.input || {};
								// [F1]/[v7.1] Same rule as the md renderer:
								// suppress only consumed blocks; render
								// artifact-shaped strays with a warning.
								if (blockArtifact.has(block)) break;
								if (!cfg.includeToolCalls) break; // [v8]
								const stray = isArtifactShaped(block);
								const bi =
									blockMds.push(toolUseMd(block, stray)) - 1;
								L.push(
									`<details><summary><span>🔧 ${escHtml(block.name || "Tool use")}${stray ? " ⚠️ (not folded into an exported file)" : ""}</span><button class="copy-md sub" data-b="${bi}" title="Copy this section as Markdown">⧉</button></summary>`,
								);
								const s =
									typeof inp === "string"
										? inp
										: JSON.stringify(inp, null, 2);
								// [F5] Same cap as markdown (was: unbounded).
								L.push(
									`<pre><code class="language-json">${escHtml(capJson(s))}</code></pre></details>`,
								);
								break;
							}
							case "tool_result": {
								if (!cfg.includeToolCalls) break; // [v8]
								const bi =
									blockMds.push(toolResultMd(block)) - 1;
								L.push(
									`<details><summary><span>📋 ${escHtml(resultName(block))}</span><button class="copy-md sub" data-b="${bi}" title="Copy this section as Markdown">⧉</button></summary>`,
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
											`<pre><code class="language-json">${escHtml(capJson(JSON.stringify(block.display_content, null, 2)))}</code></pre>`,
										);
								}
								if (Array.isArray(block.content))
									block.content.forEach((item) => {
										if (item.type === "text" && item.text)
											L.push(
												`<pre><code class="language-${guessLang(item.text)}">${escHtml(item.text)}</code></pre>`,
											);
										else if (typeof item === "string")
											L.push(
												`<pre><code class="language-${guessLang(item)}">${escHtml(item)}</code></pre>`,
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
										`<pre><code class="language-${guessLang(block.content)}">${escHtml(block.content)}</code></pre>`,
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
				L.push(`</div></details>`);
			});

			// [v8] Artifacts index section with its own copy button.
			if (artifactFiles.length) {
				L.push(`<div class="idx">`);
				L.push(
					`<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><strong>📑 Artifacts Index</strong><button class="copy-md" data-i="idx" title="Copy the index as Markdown">⧉</button></div>`,
				);
				L.push(`<ol>`);
				artifactFiles.forEach((a) =>
					L.push(
						`<li><strong>${escHtml(a.title)}</strong>${a.type ? " — " + escHtml(a.type) : ""} → <code>${escHtml(a.exportPath)}</code>${a.foldFailures ? ` <span style="color:#e0a458">⚠️ ${a.foldFailures} edit(s) failed to fold</span>` : ""}</li>`,
					),
				);
				L.push(`</ol></div>`);
			}

			// [v8] Per-section markdown, embedded as JSON. `<` is escaped to
			// \u003c so content can never close the script tag.
			const mdData = JSON.stringify({
				turns: turnMds,
				blocks: blockMds, // [v8.1-c]
				idx: artifactsIndexMd,
				full: finalMd,
			}).replace(/</g, "\\u003c");
			L.push(
				`<script id="md-data" type="application/json">${mdData}<\/script>`,
			);
			L.push(`<script>
(() => {
  const data = JSON.parse(document.getElementById("md-data").textContent);
  const flash = (btn, txt) => {
    const old = btn.textContent;
    btn.textContent = txt;
    setTimeout(() => (btn.textContent = old), 1200);
  };
  const copy = async (btn, text) => {
    try { await navigator.clipboard.writeText(text); flash(btn, "Copied ✓"); }
    catch {
      const t = document.createElement("textarea");
      t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); flash(btn, "Copied ✓"); }
      catch { flash(btn, "Copy failed"); }
      t.remove();
    }
  };
  document.querySelectorAll(".copy-md").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation(); // don't toggle the <details>
      const b = btn.dataset.b;
      if (b != null) return copy(btn, data.blocks[+b] || "");
      const i = btn.dataset.i;
      copy(btn, i === "idx" ? data.idx : data.turns[+i] || "");
    });
  });
  document.querySelectorAll(".toolbar button[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const act = btn.dataset.act;
      if (act === "copyall") return copy(btn, data.full);
      // [v8.3] expand-turns: turn level only; expand-all/collapse: turns
      // AND nested sections (header's More details left alone).
      document.querySelectorAll("details.turn").forEach(
        (d) => (d.open = act !== "collapse"),
      );
      if (act !== "expand-turns")
        document.querySelectorAll("details.turn details").forEach(
          (d) => (d.open = act === "expand-all"),
        );
    });
  });
  // [v8.2] width toggle (S/M/L), persisted across all exported pages
  const WKEY = "cce_html_width";
  const wbtns = document.querySelectorAll(".wbtns button");
  const setW = (w) => {
    // [v8.3] classList, not className — must not wipe the font class
    document.body.classList.remove("w-s","w-m","w-l");
    document.body.classList.add("w-" + w);
    wbtns.forEach((b) => b.classList.toggle("active", b.dataset.w === w));
    try { localStorage.setItem(WKEY, w); } catch {}
  };
  wbtns.forEach((b) => b.addEventListener("click", () => setW(b.dataset.w)));
  let savedW = "m";
  try { savedW = localStorage.getItem(WKEY) || "m"; } catch {}
  setW(["s","m","l"].includes(savedW) ? savedW : "m");
  // [v8.3] font size toggle, same pattern (default S = 0.8em)
  const FKEY = "cce_html_font";
  const fbtns = document.querySelectorAll(".fbtns button");
  const setF = (f) => {
    document.body.classList.remove("f-s","f-m","f-l");
    document.body.classList.add("f-" + f);
    fbtns.forEach((b) => b.classList.toggle("active", b.dataset.f === f));
    try { localStorage.setItem(FKEY, f); } catch {}
  };
  fbtns.forEach((b) => b.addEventListener("click", () => setF(b.dataset.f)));
  let savedF = "s";
  try { savedF = localStorage.getItem(FKEY) || "s"; } catch {}
  setF(["s","m","l"].includes(savedF) ? savedF : "s");
  // [v8.2] scroll-to-top: appears after ~1 screen, faint until hovered
  const top = document.createElement("button");
  top.id = "totop"; top.textContent = "↑"; top.title = "Scroll to top";
  document.body.appendChild(top);
  top.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" }),
  );
  addEventListener(
    "scroll",
    () => top.classList.toggle("show", scrollY > innerHeight),
    { passive: true },
  );
})();
<\/script>`);
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
				includeThinking: cfg.includeThinking, // [v8]
				includeToolCalls: cfg.includeToolCalls, // [v8]
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
			zipBlobSize = blob.size; // [v8.2]
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

		setStatus(
			// [v8.2] redesigned summary: destination · integrity · files
				(() => {
					const secs = Math.round((Date.now() - exportStart) / 1000);
					const dest = useFolder
						? `folder ${safeTitle}/`
						: `${safeTitle}.zip${zipBlobSize != null ? " · " + humanSize(zipBlobSize) : ""}`;
					const dlImgsN = allImages.filter(
						(i) => i.downloaded,
					).length;
					const saved = uploadFiles.filter((u) => u.saved).length;
					const totalRefs = manifest.uploadedFiles.length;
					const dupRefs = totalRefs - uploadStats.uniqueRefs;
					const notRetr =
						uploadStats.uniqueRefs - uploadStats.retrievable;
					const uploadBits = [
						`${saved} of ${uploadStats.uniqueRefs} unique recovered`,
					];
					if (notRetr > 0)
						uploadBits.push(`${notRetr} not retrievable`);
					if (dupRefs > 0)
						uploadBits.push(`${dupRefs} repeat refs skipped`);
					const artLine =
						artifactFiles.length === 1
							? `1 file rebuilt (${artifactFiles[0].fileName})`
							: `${artifactFiles.length} files rebuilt`;
					const lines = [
						`✅ Export complete — ${dest} · ${secs} s`,
						``,
						`Content   ${turns.length} turns · ${apiModel || "unknown"} · source: ${source}${branchStats ? ` (active branch ${branchStats.active}/${branchStats.total})` : ""}`,
						`Artifacts ${artLine}${artifactFiles.length ? (foldFailures ? "" : " — all edits applied cleanly") : ""}`,
						allImages.length
							? `Images    ${dlImgsN} of ${allImages.length} downloaded`
							: "",
						totalRefs
							? `Uploads   ${uploadBits.join(" · ")}`
							: "",
						`Files     ${outputsList.length} written (${outputsList.slice(0, 3).join(" · ")}${outputsList.length > 3 ? " …" : ""})`,
						foldFailures
							? `\n⚠️ ${foldFailures} edit(s) couldn't be applied to exported files — shown inline in the transcript (manifest → telemetry)`
							: "",
					];
					return lines.filter(Boolean).join("\n");
				})(),
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
