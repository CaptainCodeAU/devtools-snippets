// =============================================================================
// Probe: What happens when you click an artifact Download button?
// =============================================================================
// Instruments fetch, XHR, createObjectURL, anchor creation, navigation,
// and Blob constructor to capture exactly what Claude's download code does.
// Then clicks the FIRST artifact Download button and reports findings.
// =============================================================================

(async () => {
	"use strict";

	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const events = [];
	const log = (type, detail) => {
		const entry = { time: Date.now(), type, detail };
		events.push(entry);
		console.log(`🔬 [${type}]`, detail);
	};

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
		fontSize: "12px",
		boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
		minWidth: "400px",
		maxWidth: "600px",
		maxHeight: "80vh",
		overflow: "auto",
		border: "1px solid #333",
		lineHeight: "1.5",
		whiteSpace: "pre-wrap",
	});
	overlay.textContent = "🔬 Probing artifact download mechanism...\n";
	document.body.appendChild(overlay);

	const appendOverlay = (msg) => {
		overlay.textContent += msg + "\n";
	};

	// ── Instrument everything ────────────────────────────────────────────

	// 1. fetch
	const origFetch = window.fetch;
	window.fetch = function (...args) {
		const url =
			typeof args[0] === "string"
				? args[0]
				: args[0]?.url || "(Request obj)";
		const method = args[1]?.method || "GET";
		log("fetch", `${method} ${url.substring(0, 200)}`);
		return origFetch.apply(this, args);
	};

	// 2. XMLHttpRequest
	const origXHROpen = XMLHttpRequest.prototype.open;
	XMLHttpRequest.prototype.open = function (method, url, ...rest) {
		log("XHR.open", `${method} ${String(url).substring(0, 200)}`);
		return origXHROpen.call(this, method, url, ...rest);
	};

	// 3. URL.createObjectURL
	const origCreateObjURL = URL.createObjectURL;
	URL.createObjectURL = function (obj) {
		const type = obj?.type || "(no type)";
		const size = obj?.size || "(no size)";
		log("createObjectURL", `type=${type} size=${size}`);
		// Capture a stack trace to see what called this
		log(
			"createObjectURL.stack",
			new Error().stack.split("\n").slice(1, 6).join("\n"),
		);
		return origCreateObjURL.call(this, obj);
	};

	// 4. URL.revokeObjectURL
	const origRevokeObjURL = URL.revokeObjectURL;
	URL.revokeObjectURL = function (url) {
		log("revokeObjectURL", url?.substring(0, 80));
		return origRevokeObjURL.call(this, url);
	};

	// 5. Blob constructor
	const OrigBlob = window.Blob;
	window.Blob = function (parts, options) {
		const b = new OrigBlob(parts, options);
		log(
			"new Blob",
			`type=${options?.type || "(none)"} parts=${parts?.length || 0} size=${b.size}`,
		);
		return b;
	};
	window.Blob.prototype = OrigBlob.prototype;

	// 6. <a> element creation + click
	const origCreateElement = document.createElement.bind(document);
	document.createElement = function (tag, ...rest) {
		const el = origCreateElement(tag, ...rest);
		if (tag.toLowerCase() === "a") {
			log('createElement("a")', "(anchor created)");
			// Watch for href and download attribute being set
			const origSetAttr = el.setAttribute.bind(el);
			el.setAttribute = function (name, value) {
				if (name === "href" || name === "download") {
					log(
						`anchor.setAttribute`,
						`${name}="${String(value).substring(0, 150)}"`,
					);
				}
				return origSetAttr(name, value);
			};
			// Watch for .click()
			const origClick = el.click.bind(el);
			el.click = function () {
				log(
					"anchor.click()",
					`href=${el.href?.substring(0, 100)} download="${el.download}"`,
				);
				log(
					"anchor.click.stack",
					new Error().stack.split("\n").slice(1, 6).join("\n"),
				);
				// Actually perform it so we can see the full flow
				return origClick();
			};
			// Also watch property setters
			let _href = "",
				_download = "";
			Object.defineProperty(el, "href", {
				get() {
					return _href;
				},
				set(v) {
					_href = v;
					log("anchor.href=", String(v).substring(0, 150));
				},
			});
			Object.defineProperty(el, "download", {
				get() {
					return _download;
				},
				set(v) {
					_download = v;
					log("anchor.download=", v);
				},
			});
		}
		return el;
	};

	// 7. window.open
	const origWindowOpen = window.open;
	window.open = function (url, ...rest) {
		log("window.open", String(url).substring(0, 200));
		return origWindowOpen.call(this, url, ...rest);
	};

	// 8. Navigator.msSaveBlob / saveAs (IE/Edge legacy)
	if (navigator.msSaveBlob) {
		const origSaveBlob = navigator.msSaveBlob.bind(navigator);
		navigator.msSaveBlob = function (blob, name) {
			log("msSaveBlob", `name=${name} size=${blob?.size}`);
			return origSaveBlob(blob, name);
		};
	}

	// 9. showSaveFilePicker (modern File System Access)
	if (window.showSaveFilePicker) {
		const origPicker = window.showSaveFilePicker;
		window.showSaveFilePicker = function (...args) {
			log("showSaveFilePicker", JSON.stringify(args).substring(0, 200));
			return origPicker.apply(this, args);
		};
	}

	appendOverlay(
		"✅ All hooks installed. Clicking first Download button...\n",
	);

	// ── Find and click the first artifact download button ────────────────
	const btn = document.querySelector(
		'.artifact-block-cell button[aria-label="Download"]',
	);
	if (!btn) {
		appendOverlay("❌ No Download button found!");
		await sleep(5000);
		overlay.remove();
		return;
	}

	const cell = btn.closest(".artifact-block-cell");
	const title =
		cell?.querySelector(".line-clamp-1")?.textContent?.trim() ||
		"(unknown)";
	appendOverlay(`🎯 Clicking Download for: "${title}"\n`);

	// Clear events before click
	events.length = 0;

	btn.click();

	// Wait for async operations to complete
	await sleep(2000);

	appendOverlay(`\n═══ CAPTURED ${events.length} EVENTS ═══\n`);
	events.forEach((e) => {
		appendOverlay(
			`[${e.type}] ${typeof e.detail === "string" ? e.detail : JSON.stringify(e.detail)}`,
		);
	});

	// ── Restore everything ───────────────────────────────────────────────
	window.fetch = origFetch;
	XMLHttpRequest.prototype.open = origXHROpen;
	URL.createObjectURL = origCreateObjURL;
	URL.revokeObjectURL = origRevokeObjURL;
	window.Blob = OrigBlob;
	document.createElement = origCreateElement;
	window.open = origWindowOpen;
	if (window.showSaveFilePicker)
		window.showSaveFilePicker = window.showSaveFilePicker;

	appendOverlay("\n✅ All hooks restored. Copy this output and share it.");

	// Also dump to a downloadable file
	const report = events
		.map(
			(e) =>
				`[${e.type}] ${typeof e.detail === "string" ? e.detail : JSON.stringify(e.detail)}`,
		)
		.join("\n");

	const blob = new OrigBlob([report], { type: "text/plain" });
	const url = origCreateObjURL(blob);
	const a = origCreateElement("a");
	a.href = url;
	a.download = `artifact_download_probe_${Date.now()}.txt`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);

	// Keep overlay visible for reading
	await sleep(30000);
	overlay.remove();
})();
