// =============================================================================
// Probe: Extract artifact download parameters + discover API endpoint
// =============================================================================
// We know onClick calls K({ filepath: t.path, orgUuid, conversationUuid })
// This script:
//   1. Extracts those params from each artifact's React fiber
//   2. Hooks fetch/XHR at the deepest level to catch the actual request
//   3. Clicks one Download button and captures the full request URL/body
// =============================================================================

(async () => {
	"use strict";

	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
		fontFamily: "system-ui, monospace",
		fontSize: "11px",
		boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
		minWidth: "500px",
		maxWidth: "700px",
		maxHeight: "85vh",
		overflow: "auto",
		border: "1px solid #333",
		lineHeight: "1.4",
		whiteSpace: "pre-wrap",
	});
	document.body.appendChild(overlay);
	const lines = [];
	const log = (msg) => {
		lines.push(msg);
		overlay.textContent += msg + "\n";
		console.log(msg);
	};

	log("🔬 Artifact Download API Probe\n");

	// ── Helper: get React fiber ──────────────────────────────────────────
	const getFiber = (el) => {
		const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
		return key ? el[key] : null;
	};
	const getProps = (el) => {
		const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"));
		return key ? el[key] : null;
	};

	// ── PART 1: Extract params from each artifact's onClick closure ──────
	log("═══ PART 1: ARTIFACT DOWNLOAD PARAMETERS ═══\n");

	const allBtns = document.querySelectorAll(
		'.artifact-block-cell button[aria-label="Download"]',
	);
	const seenTitles = new Set();
	const artifactParams = [];

	for (const btn of allBtns) {
		const cell = btn.closest(".artifact-block-cell");
		const title =
			cell?.querySelector(".line-clamp-1")?.textContent?.trim() || "?";
		if (seenTitles.has(title)) continue;
		seenTitles.add(title);

		const props = getProps(btn);
		if (!props?.onClick) {
			log(`  ❌ "${title}" — no onClick`);
			continue;
		}

		// The onClick closure captures variables. We can't directly read them,
		// but we CAN intercept the call to K by wrapping onClick.
		// First, let's see what the function looks like
		const fnStr = props.onClick.toString();

		// Walk up the fiber to find props that contain 'path', 'uuid', etc.
		const fiber = getFiber(btn);
		let current = fiber;
		let depth = 0;
		const pathCandidates = [];

		while (current && depth < 50) {
			if (current.memoizedProps) {
				const p = current.memoizedProps;
				// Look for path-like strings
				for (const [key, val] of Object.entries(p)) {
					if (typeof val === "string") {
						if (
							key === "path" ||
							key === "filepath" ||
							key === "filePath" ||
							(val.includes("/") &&
								val.includes(".") &&
								val.length < 200 &&
								!val.includes("class") &&
								!val.includes("http"))
						) {
							pathCandidates.push({
								depth,
								key,
								val,
								component:
									current.type?.name ||
									current.type?.displayName ||
									String(current.type).substring(0, 30),
							});
						}
					}
					if (
						val &&
						typeof val === "object" &&
						!Array.isArray(val) &&
						key !== "style"
					) {
						// Check one level deep for path/uuid
						for (const [k2, v2] of Object.entries(val)) {
							if (
								typeof v2 === "string" &&
								(k2 === "path" ||
									k2 === "filepath" ||
									k2 === "uuid" ||
									k2 === "conversationUuid" ||
									k2 === "orgUuid" ||
									k2 === "content" ||
									(v2.includes("/") &&
										v2.includes(".") &&
										v2.length < 200 &&
										!v2.includes("class")))
							) {
								pathCandidates.push({
									depth,
									key: `${key}.${k2}`,
									val: v2.substring(0, 200),
									component: current.type?.name || "?",
								});
							}
						}
					}
				}

				// Also check for the `t` and `G` and `s` variables by searching for
				// objects that have a `path` property
				for (const [key, val] of Object.entries(p)) {
					if (
						val &&
						typeof val === "object" &&
						val.path &&
						typeof val.path === "string"
					) {
						pathCandidates.push({
							depth,
							key: `${key}.path`,
							val: val.path,
							component: "(obj with .path)",
						});
					}
				}
			}

			// Also check hooks
			let hookState = current.memoizedState;
			let hookIdx = 0;
			while (hookState && hookIdx < 20) {
				const ms = hookState.memoizedState;
				if (ms && typeof ms === "object" && !Array.isArray(ms)) {
					if (ms.path)
						pathCandidates.push({
							depth,
							key: `hook[${hookIdx}].path`,
							val: ms.path,
							component: "hook",
						});
					if (ms.uuid)
						pathCandidates.push({
							depth,
							key: `hook[${hookIdx}].uuid`,
							val: ms.uuid,
							component: "hook",
						});
					if (ms.filepath)
						pathCandidates.push({
							depth,
							key: `hook[${hookIdx}].filepath`,
							val: ms.filepath,
							component: "hook",
						});
				}
				if (Array.isArray(ms)) {
					ms.forEach((item, i) => {
						if (item && typeof item === "object") {
							if (item.path)
								pathCandidates.push({
									depth,
									key: `hook[${hookIdx}][${i}].path`,
									val: item.path,
									component: "hook-arr",
								});
							if (item.uuid)
								pathCandidates.push({
									depth,
									key: `hook[${hookIdx}][${i}].uuid`,
									val: item.uuid,
									component: "hook-arr",
								});
						}
					});
				}
				hookState = hookState.next;
				hookIdx++;
			}

			current = current.return;
			depth++;
		}

		log(`📄 "${title}"`);
		if (pathCandidates.length > 0) {
			pathCandidates.forEach((c) => {
				log(
					`     [depth ${c.depth}] ${c.key} = "${c.val}" (${c.component})`,
				);
			});
		} else {
			log("     (no path/uuid found in fiber walk)");
		}
		artifactParams.push({ title, candidates: pathCandidates });
	}

	log("");

	// ── PART 2: Hook at the LOWEST possible level and click ──────────────
	log("═══ PART 2: DEEP REQUEST INTERCEPTION ═══\n");

	// Hook the raw XMLHttpRequest.send and fetch at prototype level
	const captured = [];

	// Deep fetch hook — patch on the window's fetch descriptor
	const origFetch = window.fetch;
	Object.defineProperty(window, "fetch", {
		configurable: true,
		writable: true,
		value: function (...args) {
			const url =
				typeof args[0] === "string"
					? args[0]
					: args[0]?.url || "(Request)";
			const method = args[1]?.method || args[0]?.method || "GET";
			const body = args[1]?.body || args[0]?.body || null;
			captured.push({
				type: "fetch",
				method,
				url: String(url).substring(0, 300),
				body: body ? String(body).substring(0, 500) : null,
				stack: new Error().stack.split("\n").slice(1, 8).join("\n"),
			});
			return origFetch.apply(this, args);
		},
	});

	// Deep XHR hook
	const origXHRSend = XMLHttpRequest.prototype.send;
	const origXHROpen = XMLHttpRequest.prototype.open;
	XMLHttpRequest.prototype.open = function (method, url, ...rest) {
		this._probeMethod = method;
		this._probeUrl = url;
		return origXHROpen.call(this, method, url, ...rest);
	};
	XMLHttpRequest.prototype.send = function (body) {
		captured.push({
			type: "XHR",
			method: this._probeMethod,
			url: String(this._probeUrl).substring(0, 300),
			body: body ? String(body).substring(0, 500) : null,
		});
		return origXHRSend.call(this, body);
	};

	// Also hook navigator.sendBeacon
	const origBeacon = navigator.sendBeacon?.bind(navigator);
	if (origBeacon) {
		navigator.sendBeacon = function (url, data) {
			captured.push({
				type: "sendBeacon",
				url: String(url).substring(0, 300),
			});
			return origBeacon(url, data);
		};
	}

	// Hook service worker postMessage if accessible
	if (navigator.serviceWorker?.controller) {
		const origSWPost = navigator.serviceWorker.controller.postMessage.bind(
			navigator.serviceWorker.controller,
		);
		navigator.serviceWorker.controller.postMessage = function (
			msg,
			...rest
		) {
			captured.push({
				type: "SW.postMessage",
				msg: JSON.stringify(msg).substring(0, 300),
			});
			return origSWPost(msg, ...rest);
		};
	}

	// Monitor network via PerformanceObserver for any requests we might miss
	let perfEntries = [];
	try {
		const perfObserver = new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				if (entry.entryType === "resource") {
					perfEntries.push({
						name: entry.name,
						type: entry.initiatorType,
						duration: entry.duration,
					});
				}
			}
		});
		perfObserver.observe({ type: "resource", buffered: false });
	} catch (e) {
		/* not supported */
	}

	log("All hooks installed. Clicking first Download button...\n");

	// Clear and click
	captured.length = 0;
	perfEntries = [];

	const firstBtn = document.querySelector(
		'.artifact-block-cell button[aria-label="Download"]',
	);
	firstBtn.click();

	// Wait longer this time
	await sleep(3000);

	log(`Captured ${captured.length} request(s):\n`);
	captured.forEach((c, i) => {
		log(`[${i}] ${c.type} ${c.method || ""} ${c.url}`);
		if (c.body) log(`    body: ${c.body}`);
		if (c.stack) log(`    stack:\n${c.stack}`);
		log("");
	});

	log(`PerformanceObserver entries: ${perfEntries.length}\n`);
	perfEntries.forEach((p, i) => {
		log(
			`[${i}] ${p.type}: ${p.name.substring(0, 200)} (${Math.round(p.duration)}ms)`,
		);
	});

	// ── Restore ──────────────────────────────────────────────────────────
	window.fetch = origFetch;
	XMLHttpRequest.prototype.open = origXHROpen;
	XMLHttpRequest.prototype.send = origXHRSend;
	if (origBeacon) navigator.sendBeacon = origBeacon;

	log("\n═══ DONE ═══");

	// Download report
	const blob = new Blob([lines.join("\n")], { type: "text/plain" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `artifact_api_probe_${Date.now()}.txt`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);

	await sleep(30000);
	overlay.remove();
})();
