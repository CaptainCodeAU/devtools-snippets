// =============================================================================
// Claude.ai Chat Transcript — DOM Inspector (DevTools Snippet)
// =============================================================================
// Run this on: https://claude.ai/chat/<conversation-id>
// Downloads a .txt report of the chat page DOM structure so we can build
// a proper transcript exporter in the next step.
// =============================================================================

(async () => {
	"use strict";

	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const downloadFile = (content, filename) => {
		const blob = new Blob([content], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	// ── Overlay for visual feedback ──────────────────────────────────────
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
		minWidth: "300px",
		border: "1px solid #333",
	});
	overlay.textContent = "🔍 Inspecting claude.ai chat page...";
	document.body.appendChild(overlay);

	const lines = [];
	const log = (...args) => {
		const l = args.join(" ");
		lines.push(l);
		console.log(l);
	};

	// ── Utility: describe a single element ───────────────────────────────
	const describeEl = (el, maxText = 100) => {
		if (!el || el.nodeType !== Node.ELEMENT_NODE) return "(null)";
		const tag = el.tagName.toLowerCase();
		const cls =
			el.className && typeof el.className === "string"
				? "." + el.className.trim().split(/\s+/).slice(0, 5).join(".")
				: "";
		const id = el.id ? "#" + el.id : "";
		const role = el.getAttribute("role")
			? ` [role=${el.getAttribute("role")}]`
			: "";
		const href = el.getAttribute("href")
			? ` [href="${el.getAttribute("href").substring(0, 80)}"]`
			: "";
		const ariaLabel = el.getAttribute("aria-label")
			? ` [aria-label="${el.getAttribute("aria-label").substring(0, 60)}"]`
			: "";
		const dataAttrs = Array.from(el.attributes)
			.filter((a) => a.name.startsWith("data-"))
			.map((a) => ` [${a.name}="${a.value.substring(0, 60)}"]`)
			.join("");
		const text = (el.textContent || "")
			.trim()
			.substring(0, maxText)
			.replace(/\n/g, "\\n");
		const textStr = text
			? ` text="${text}${text.length >= maxText ? "…" : ""}"`
			: "";
		return `<${tag}${id}${cls}${role}${href}${ariaLabel}${dataAttrs}>${textStr}`;
	};

	// ── Utility: dump DOM tree ───────────────────────────────────────────
	const dumpTree = (el, indent = 0, maxDepth = 8) => {
		if (indent > maxDepth) {
			log("  ".repeat(indent) + "... (depth limit)");
			return;
		}
		const pad = "  ".repeat(indent);

		if (el.nodeType === Node.TEXT_NODE) {
			const t = el.textContent.trim();
			if (t)
				log(
					`${pad}#text "${t.substring(0, 120).replace(/\n/g, "\\n")}"`,
				);
			return;
		}
		if (el.nodeType !== Node.ELEMENT_NODE) return;

		const childCount = el.children.length;
		log(
			`${pad}${describeEl(el, 80)}${childCount > 0 ? ` [${childCount} ch]` : ""}`,
		);
		Array.from(el.childNodes).forEach((child) =>
			dumpTree(child, indent + 1, maxDepth),
		);
	};

	try {
		log("═══════════════════════════════════════════════════════════════");
		log("  CLAUDE.AI CHAT PAGE — DOM INSPECTION REPORT");
		log(`  URL: ${window.location.href}`);
		log(`  Time: ${new Date().toISOString()}`);
		log("═══════════════════════════════════════════════════════════════");
		log("");

		// ── Section 1: Custom elements on page ─────────────────────────────
		log("── SECTION 1: ALL CUSTOM / INTERESTING ELEMENTS ON PAGE ──");
		const customTags = {};
		document.querySelectorAll("*").forEach((el) => {
			const tag = el.tagName.toLowerCase();
			if (tag.includes("-")) customTags[tag] = (customTags[tag] || 0) + 1;
		});
		Object.entries(customTags)
			.sort((a, b) => b[1] - a[1])
			.forEach(([tag, count]) => log(`  ${tag} × ${count}`));
		log("");

		// ── Section 2: Message / conversation containers ───────────────────
		log("── SECTION 2: MESSAGE & CONVERSATION CONTAINERS ──");
		const containerSelectors = [
			// Role-based
			"[data-is-streaming]",
			"[data-testid]",
			// Common class patterns for chat UIs
			'[class*="message"]',
			'[class*="Message"]',
			'[class*="conversation"]',
			'[class*="Conversation"]',
			'[class*="chat-"]',
			'[class*="Chat"]',
			'[class*="turn"]',
			'[class*="Turn"]',
			'[class*="response"]',
			'[class*="Response"]',
			'[class*="human"]',
			'[class*="Human"]',
			'[class*="assistant"]',
			'[class*="Assistant"]',
			'[class*="user"]',
			'[class*="User"]',
			'[class*="thread"]',
			'[class*="Thread"]',
			// Accessibility roles
			'[role="log"]',
			'[role="list"]',
			'[role="article"]',
			'[role="region"]',
			'[role="presentation"]',
			// Prosemirror / rich text
			".ProseMirror",
			"[contenteditable]",
		];
		containerSelectors.forEach((sel) => {
			const found = document.querySelectorAll(sel);
			if (found.length > 0) {
				log(`  "${sel}" → ${found.length} match(es)`);
				found.forEach((f, fi) => {
					if (fi < 3) log(`    [${fi}] ${describeEl(f, 60)}`);
				});
			}
		});
		log("");

		// ── Section 3: Code blocks, artifacts, attachments ─────────────────
		log("── SECTION 3: CODE BLOCKS, ARTIFACTS & ATTACHMENTS ──");
		const contentSelectors = [
			"pre",
			"code",
			'[class*="code"]',
			'[class*="Code"]',
			'[class*="artifact"]',
			'[class*="Artifact"]',
			'[class*="attachment"]',
			'[class*="Attachment"]',
			'[class*="file"]',
			'[class*="File"]',
			'[class*="image"]',
			'[class*="Image"]',
			'[class*="upload"]',
			'[class*="Upload"]',
			'[class*="markdown"]',
			'[class*="Markdown"]',
			'[class*="prose"]',
			'[class*="Prose"]',
			"img[src]",
			"svg",
			"iframe",
			"canvas",
			"audio",
			"video",
		];
		contentSelectors.forEach((sel) => {
			const found = document.querySelectorAll(sel);
			if (found.length > 0) {
				log(`  "${sel}" → ${found.length} match(es)`);
				found.forEach((f, fi) => {
					if (fi < 3) {
						const extra =
							sel === "img[src]"
								? ` src="${(f.getAttribute("src") || "").substring(0, 100)}"`
								: "";
						log(`    [${fi}] ${describeEl(f, 50)}${extra}`);
					}
				});
			}
		});
		log("");

		// ── Section 4: data-testid inventory ───────────────────────────────
		log("── SECTION 4: ALL data-testid VALUES ──");
		const testIds = {};
		document.querySelectorAll("[data-testid]").forEach((el) => {
			const tid = el.getAttribute("data-testid");
			testIds[tid] = (testIds[tid] || 0) + 1;
		});
		Object.entries(testIds)
			.sort((a, b) => b[1] - a[1])
			.forEach(([tid, count]) =>
				log(`  data-testid="${tid}" × ${count}`),
			);
		log("");

		// ── Section 5: Scrollable areas ────────────────────────────────────
		log("── SECTION 5: SCROLLABLE AREAS ──");
		document.querySelectorAll("*").forEach((el) => {
			if (el.scrollHeight > el.clientHeight + 50) {
				const s = getComputedStyle(el);
				if (/(auto|scroll)/.test(s.overflow + s.overflowY)) {
					const cls =
						el.className && typeof el.className === "string"
							? el.className.trim().substring(0, 80)
							: "";
					log(
						`  <${el.tagName.toLowerCase()}> class="${cls}" scrollH=${el.scrollHeight} clientH=${el.clientHeight}`,
					);
				}
			}
		});
		log("");

		// ── Section 6: Main content area tree ──────────────────────────────
		log("── SECTION 6: MAIN CONTENT AREA TREE (depth=5) ──");
		const mainCandidates = [
			"main",
			'[role="main"]',
			'[class*="conversation"]',
			'[class*="Conversation"]',
			'[class*="thread"]',
			'[class*="Thread"]',
			'[role="log"]',
		];
		let mainEl = null;
		for (const sel of mainCandidates) {
			mainEl = document.querySelector(sel);
			if (mainEl) {
				log(`  Found main via: "${sel}"`);
				break;
			}
		}
		if (!mainEl) {
			// Fallback: largest scrollable child of body
			let best = null,
				bestH = 0;
			document.querySelectorAll("*").forEach((el) => {
				if (
					el.scrollHeight > bestH &&
					el !== document.body &&
					el !== document.documentElement
				) {
					const s = getComputedStyle(el);
					if (/(auto|scroll)/.test(s.overflow + s.overflowY)) {
						best = el;
						bestH = el.scrollHeight;
					}
				}
			});
			if (best) {
				mainEl = best;
				log(
					`  Found main via largest scrollable area (scrollH=${bestH})`,
				);
			}
		}
		if (mainEl) {
			log("");
			dumpTree(mainEl, 0, 5);
		} else {
			log("  Could not find main content area — dumping body children:");
			Array.from(document.body.children).forEach((c) =>
				dumpTree(c, 0, 3),
			);
		}
		log("");

		// ── Section 7: Detailed dump of first few messages ─────────────────
		log("── SECTION 7: DETAILED DUMP OF FIRST 3 MESSAGES (depth=8) ──");

		// Strategy: find message-like containers. Try multiple approaches.
		let messages = [];

		// Approach A: data-testid based
		const testIdCandidates = Object.keys(testIds).filter((t) =>
			/message|turn|chat|human|assistant|user|response/i.test(t),
		);
		if (testIdCandidates.length > 0) {
			log(
				`  Trying data-testid candidates: ${testIdCandidates.join(", ")}`,
			);
			for (const tid of testIdCandidates) {
				const found = document.querySelectorAll(
					`[data-testid="${tid}"]`,
				);
				if (found.length >= 2) {
					messages = Array.from(found);
					log(
						`  ✓ Using data-testid="${tid}" → ${found.length} messages`,
					);
					break;
				}
			}
		}

		// Approach B: role-based or class-based
		if (messages.length === 0) {
			const msgSelectors = [
				'[class*="message-"]',
				'[class*="Message"]',
				'[class*="turn-"]',
				'[class*="Turn"]',
				'[role="article"]',
				'[role="listitem"]',
			];
			for (const sel of msgSelectors) {
				const found = document.querySelectorAll(sel);
				if (found.length >= 2) {
					messages = Array.from(found);
					log(
						`  ✓ Using selector "${sel}" → ${found.length} messages`,
					);
					break;
				}
			}
		}

		// Approach C: look for alternating human/assistant pattern in any container
		if (messages.length === 0) {
			log(
				`  No obvious message selectors found. Trying heuristic scan...`,
			);
			const allDivs = document.querySelectorAll("div[class]");
			const classCounts = {};
			allDivs.forEach((d) => {
				const cls = d.className.trim().split(/\s+/).sort().join(" ");
				if (cls && d.textContent.trim().length > 20) {
					classCounts[cls] = (classCounts[cls] || 0) + 1;
				}
			});
			// Find classes that appear multiple times (likely repeated message containers)
			const repeatedClasses = Object.entries(classCounts)
				.filter(([, c]) => c >= 2)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 10);
			log(`  Top repeated div class combos:`);
			repeatedClasses.forEach(([cls, count]) => {
				log(`    × ${count}: "${cls.substring(0, 80)}"`);
			});
		}

		log(`  Total message candidates: ${messages.length}`);
		log("");

		messages.slice(0, 3).forEach((entry, i) => {
			log(`▼▼▼ MESSAGE ${i} ▼▼▼`);
			dumpTree(entry, 0, 8);
			log(`▲▲▲ END MESSAGE ${i} ▲▲▲`);
			log("");
		});

		// ── Section 8: Images & downloadable resources ─────────────────────
		log("── SECTION 8: IMAGES & DOWNLOADABLE RESOURCES ──");
		const imgs = document.querySelectorAll("img");
		log(`  Total <img> elements: ${imgs.length}`);
		imgs.forEach((img, i) => {
			if (i < 15) {
				const src = (img.getAttribute("src") || "").substring(0, 120);
				const alt = (img.getAttribute("alt") || "").substring(0, 60);
				const w = img.naturalWidth || img.width;
				const h = img.naturalHeight || img.height;
				log(`  [${i}] ${w}×${h} alt="${alt}" src="${src}"`);
			}
		});
		if (imgs.length > 15) log(`  ... (${imgs.length - 15} more)`);

		const links = document.querySelectorAll(
			'a[download], a[href*="blob:"], a[href*="download"]',
		);
		log(`  Download-like links: ${links.length}`);
		links.forEach((a, i) => {
			log(`    [${i}] ${describeEl(a, 60)}`);
		});
		log("");

		// ── Section 9: Page metadata ───────────────────────────────────────
		log("── SECTION 9: PAGE METADATA ──");
		log(`  document.title = "${document.title}"`);
		log(
			`  Total elements on page: ${document.querySelectorAll("*").length}`,
		);
		log(`  Body direct children: ${document.body.children.length}`);
		Array.from(document.body.children).forEach((c) => {
			log(`    ${describeEl(c, 50)}`);
		});

		// Check for React/Next.js data
		const nextData = document.querySelector("#__NEXT_DATA__");
		if (nextData) {
			log("  __NEXT_DATA__ found — this is a Next.js app");
			try {
				const nd = JSON.parse(nextData.textContent);
				log(`    buildId: ${nd.buildId || "?"}`);
				log(`    page: ${nd.page || "?"}`);
				log(
					`    Top-level props keys: ${Object.keys(nd.props || {}).join(", ")}`,
				);
			} catch {
				log("    (could not parse __NEXT_DATA__)");
			}
		}

		// Check for any global state hints
		["__NEXT_DATA__", "__remixContext", "__APP_STATE__"].forEach((g) => {
			if (window[g]) log(`  window.${g} exists`);
		});

		log("");
		log("═══════════════════════════════════════════════════════════════");
		log("  DONE — Use this report to build the chat exporter script!");
		log("═══════════════════════════════════════════════════════════════");

		downloadFile(
			lines.join("\n"),
			`claude_chat_dom_report_${Date.now()}.txt`,
		);
		overlay.textContent = "✅ Done! Report downloaded & logged to console.";
		await sleep(3000);
	} catch (err) {
		log("FATAL: " + err.message);
		log(err.stack);
		downloadFile(lines.join("\n"), "claude_chat_dom_report_ERROR.txt");
		overlay.textContent = "❌ " + err.message;
		await sleep(4000);
	} finally {
		overlay.remove();
	}
})();
