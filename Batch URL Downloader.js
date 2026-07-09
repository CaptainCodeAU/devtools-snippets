(() => {
	// ── Trigger Code Snippet: batch URL downloader (v8) ─────────────────
	// Main-world page JS. fetch→blob→<a download>. Subject to page CORS/CSP.
	// Download history is per-origin localStorage (this snippet's record only,
	// NOT a view of your actual Downloads folder).

	if (document.getElementById("tcs-dl-backdrop")) return;

	const $ = (t, s = {}, txt) => {
		const e = document.createElement(t);
		Object.assign(e.style, s);
		if (txt != null) e.textContent = txt;
		return e;
	};
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
		greenBg: "#132a20",
		amberBg: "#2a2113",
		redBg: "#2a1616",
	};

	const HIST_KEY = "tcs_download_history_v1";
	const loadHist = () => {
		try {
			return JSON.parse(localStorage.getItem(HIST_KEY) || "{}");
		} catch {
			return {};
		}
	};
	const saveHist = (h) => {
		try {
			localStorage.setItem(HIST_KEY, JSON.stringify(h));
		} catch {}
	};
	let history = loadHist();
	const fmtWhen = (iso) => {
		try {
			return new Date(iso).toLocaleString("en-AU", {
				dateStyle: "medium",
				timeStyle: "short",
			});
		} catch {
			return iso;
		}
	};

	const backdrop = $("div", {
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
	backdrop.id = "tcs-dl-backdrop";

	const modal = $("div", {
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

	const header = $("div", {
		padding: "16px 24px",
		borderBottom: `1px solid ${C.line}`,
		display: "flex",
		alignItems: "center",
		gap: "12px",
		flexShrink: "0",
	});
	header.appendChild(
		$("div", {
			width: "10px",
			height: "10px",
			borderRadius: "50%",
			background: C.accent,
			boxShadow: `0 0 12px ${C.accent}`,
		}),
	);
	header.appendChild(
		$(
			"div",
			{ fontSize: "16px", fontWeight: "600", letterSpacing: "0.2px" },
			"Batch URL Downloader",
		),
	);
	const urlCount = $(
		"div",
		{ marginLeft: "auto", fontSize: "12px", color: C.faint },
		"0 URLs",
	);
	header.appendChild(urlCount);
	modal.appendChild(header);

	const inputZone = $("div", {
		padding: "16px 24px 14px",
		borderBottom: `1px solid ${C.line}`,
		flexShrink: "0",
		display: "flex",
		flexDirection: "column",
		gap: "12px",
	});
	inputZone.appendChild(
		$(
			"div",
			{ fontSize: "12px", color: C.dim, lineHeight: "1.5" },
			"One URL per line. Test probes status and filename. Inspect shows metadata for the first URL. Nothing downloads until you press Download.",
		),
	);

	const ta = $("textarea", {
		width: "100%",
		height: "120px",
		boxSizing: "border-box",
		background: C.panel,
		color: C.text,
		border: `1px solid ${C.line}`,
		borderRadius: "10px",
		padding: "12px 14px",
		fontFamily: "ui-monospace, monospace",
		fontSize: "12.5px",
		lineHeight: "1.6",
		resize: "none",
		outline: "none",
	});
	ta.placeholder =
		"https://example.com/file1.pdf\nhttps://example.com/download?id=123";
	ta.addEventListener("focus", () => (ta.style.borderColor = C.accent));
	ta.addEventListener("blur", () => (ta.style.borderColor = C.line));
	inputZone.appendChild(ta);

	const mkCheck = (parent, labelTxt, checked) => {
		const l = $("label", {
			display: "flex",
			alignItems: "center",
			gap: "7px",
			cursor: "pointer",
		});
		const c = document.createElement("input");
		c.type = "checkbox";
		c.checked = checked;
		Object.assign(c.style, {
			accentColor: C.accent,
			width: "15px",
			height: "15px",
		});
		l.appendChild(c);
		l.appendChild(document.createTextNode(labelTxt));
		parent.appendChild(l);
		return c;
	};
	const optRow1 = $("div", {
		display: "flex",
		gap: "20px",
		fontSize: "13px",
		flexWrap: "wrap",
		alignItems: "center",
		color: C.dim,
	});
	const optUnique = mkCheck(optRow1, "Dedupe URLs", true);
	const optSort = mkCheck(optRow1, "Sort URLs", false);
	const optSkip = mkCheck(optRow1, "Skip already-downloaded", true);
	inputZone.appendChild(optRow1);

	const optRow2 = $("div", {
		display: "flex",
		gap: "20px",
		fontSize: "13px",
		flexWrap: "wrap",
		alignItems: "center",
		color: C.dim,
	});
	const optFallback = mkCheck(optRow2, "New-tab fallback if blocked", false);
	const delayWrap = $("label", {
		display: "flex",
		alignItems: "center",
		gap: "7px",
		cursor: "pointer",
	});
	const optDelay = document.createElement("input");
	optDelay.type = "checkbox";
	optDelay.checked = true;
	Object.assign(optDelay.style, {
		accentColor: C.accent,
		width: "15px",
		height: "15px",
	});
	delayWrap.appendChild(optDelay);
	delayWrap.appendChild(document.createTextNode("Delay"));
	const delayInput = document.createElement("input");
	delayInput.type = "number";
	delayInput.value = "300";
	delayInput.min = "0";
	delayInput.max = "10000";
	delayInput.step = "50";
	Object.assign(delayInput.style, {
		width: "72px",
		background: C.panel,
		color: C.text,
		border: `1px solid ${C.line}`,
		borderRadius: "6px",
		padding: "4px 8px",
		fontSize: "13px",
		outline: "none",
	});
	delayWrap.appendChild(delayInput);
	delayWrap.appendChild($("span", { color: C.faint }, "ms"));
	optRow2.appendChild(delayWrap);
	inputZone.appendChild(optRow2);
	const getDelay = () => {
		const v = parseInt(delayInput.value);
		return Number.isFinite(v) && v >= 0 ? v : 300;
	};

	// ── textarea normalisation: dedupe/sort rewrite the textarea in place ──
	// Destructive by design (per request): sort loses original order permanently.
	const normalizeTextarea = () => {
		let urls = ta.value
			.split("\n")
			.map((s) => s.trim())
			.filter(Boolean);
		const before = urls.join("\n");
		if (optUnique.checked) urls = [...new Set(urls)];
		if (optSort.checked)
			urls = urls.slice().sort((a, b) => a.localeCompare(b));
		const after = urls.join("\n");
		if (after !== before) ta.value = after;
		updateCount();
	};
	// trigger on paste (after paste lands), and on checkbox toggle
	ta.addEventListener("paste", () => setTimeout(normalizeTextarea, 0));
	ta.addEventListener("input", () => updateCount());
	[optUnique, optSort].forEach((c) =>
		c.addEventListener("change", normalizeTextarea),
	);

	const btnRow = $("div", {
		display: "flex",
		gap: "10px",
		alignItems: "center",
	});
	const mkBtn = (label, bg, fg = "#fff", solid = true) => {
		const b = $(
			"button",
			{
				background: solid ? bg : "transparent",
				border: solid ? "none" : `1px solid ${C.line}`,
				color: solid ? fg : C.dim,
				padding: "9px 20px",
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
		b.addEventListener("mouseleave", () => (b.style.filter = "none"));
		return b;
	};
	// order: Inspect, Test, Download
	const inspectBtn = mkBtn("Inspect 1st", C.amber, "#1a1207");
	const testBtn = mkBtn("Test", C.green, "#08130d");
	const dlBtn = mkBtn("Download", C.accent);
	const copyBtn = mkBtn("Copy results", null, null, false);
	const clearBtn = mkBtn("Clear", null, null, false);
	const closeBtn = mkBtn("Close", null, null, false);
	closeBtn.style.marginLeft = "auto";
	[inspectBtn, testBtn, dlBtn, copyBtn, clearBtn, closeBtn].forEach((b) =>
		btnRow.appendChild(b),
	);
	inputZone.appendChild(btnRow);

	const histLine = $("div", {
		display: "flex",
		alignItems: "center",
		gap: "10px",
		fontSize: "11.5px",
		color: C.faint,
	});
	const histInfo = $("span", {}, "");
	const histClear = $(
		"span",
		{ color: C.accent, cursor: "pointer", textDecoration: "underline" },
		"clear history",
	);
	histClear.addEventListener("click", () => {
		history = {};
		saveHist(history);
		refreshHistInfo();
	});
	histLine.appendChild(histInfo);
	histLine.appendChild(histClear);
	inputZone.appendChild(histLine);
	const refreshHistInfo = () => {
		const n = Object.keys(history).length;
		histInfo.textContent = `Download history: ${n} URL${n === 1 ? "" : "s"} recorded (this origin only).`;
	};
	refreshHistInfo();
	modal.appendChild(inputZone);

	const scrollZone = $("div", {
		flex: "1",
		overflowY: "auto",
		padding: "14px 24px 20px",
		display: "flex",
		flexDirection: "column",
		gap: "12px",
		minHeight: "160px",
	});

	const setTitle = (el, segs) => {
		el.innerHTML = "";
		segs.forEach(([txt, col]) =>
			el.appendChild($("span", col ? { color: col } : {}, txt)),
		);
	};

	const mkSection = (titleTxt) => {
		const wrap = $("div", {
			display: "none",
			flexDirection: "column",
			border: `1px solid ${C.line}`,
			borderRadius: "10px",
			overflow: "hidden",
			flexShrink: "0",
		});
		const head = $("div", {
			display: "flex",
			alignItems: "center",
			gap: "8px",
			padding: "10px 14px",
			background: C.panel2,
			cursor: "pointer",
			fontSize: "12.5px",
			fontWeight: "600",
			color: C.dim,
			userSelect: "none",
		});
		const caret = $(
			"span",
			{
				transition: "transform .15s",
				display: "inline-block",
				fontSize: "11px",
			},
			"▶",
		);
		const title = $("span", { flex: "1" }, titleTxt);
		const hint = $(
			"span",
			{ fontSize: "11px", color: C.faint, fontWeight: "400" },
			"click to toggle",
		);
		head.appendChild(caret);
		head.appendChild(title);
		head.appendChild(hint);
		const bodyEl = $("div", {
			display: "block",
			background: "#08080a",
			padding: "12px 14px",
			maxHeight: "320px",
			overflowY: "auto",
		});
		wrap.appendChild(head);
		wrap.appendChild(bodyEl);
		let open = true;
		const setOpen = (o) => {
			open = o;
			bodyEl.style.display = o ? "block" : "none";
			caret.style.transform = o ? "rotate(90deg)" : "none";
			hint.textContent = o ? "click to collapse" : "click to expand";
		};
		setOpen(true);
		head.addEventListener("click", () => setOpen(!open));
		return {
			wrap,
			head,
			title,
			bodyEl,
			setOpen,
			show: () => (wrap.style.display = "flex"),
		};
	};

	const inspectSec = mkSection("Inspect");
	scrollZone.appendChild(inspectSec.wrap);
	const testSec = mkSection("Test results");
	scrollZone.appendChild(testSec.wrap);
	const dlSec = mkSection("Download results");
	scrollZone.appendChild(dlSec.wrap);
	const collapseAll = () =>
		[inspectSec, testSec, dlSec].forEach((s) => {
			if (s.wrap.style.display !== "none") s.setOpen(false);
		});

	const emptyState = $(
		"div",
		{
			color: C.faint,
			fontSize: "13px",
			textAlign: "center",
			padding: "40px 0",
		},
		"Results appear here after Test or Download.",
	);
	scrollZone.appendChild(emptyState);
	modal.appendChild(scrollZone);

	backdrop.appendChild(modal);
	document.body.appendChild(backdrop);
	ta.focus();

	const cleanup = () => {
		backdrop.remove();
		document.removeEventListener("keydown", esc);
	};
	function esc(e) {
		if (e.key === "Escape") cleanup();
	}
	closeBtn.addEventListener("click", cleanup);
	backdrop.addEventListener("click", (e) => {
		if (e.target === backdrop) cleanup();
	});
	document.addEventListener("keydown", esc);
	clearBtn.addEventListener("click", () => {
		[inspectSec, testSec, dlSec].forEach((s) => {
			s.wrap.style.display = "none";
			s.bodyEl.innerHTML = "";
		});
		emptyState.style.display = "block";
		dlBtn.textContent = "Download";
		lastResults = null;
	});

	const CT_EXT = {
		"image/jpeg": ".jpg",
		"image/png": ".png",
		"image/gif": ".gif",
		"image/webp": ".webp",
		"image/svg+xml": ".svg",
		"image/avif": ".avif",
		"application/pdf": ".pdf",
		"application/zip": ".zip",
		"application/json": ".json",
		"text/plain": ".txt",
		"text/csv": ".csv",
		"text/html": ".html",
		"application/xml": ".xml",
		"text/xml": ".xml",
		"application/octet-stream": "",
		"video/mp4": ".mp4",
		"audio/mpeg": ".mp3",
		"application/msword": ".doc",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document":
			".docx",
		"application/vnd.ms-excel": ".xls",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
			".xlsx",
	};
	const parseCD = (cd) => {
		if (!cd) return null;
		const m = /filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i.exec(cd);
		return m ? decodeURIComponent(m[1].trim()) : null;
	};
	const pathName = (url) => {
		try {
			const p = new URL(url).pathname.split("/").filter(Boolean).pop();
			return p ? decodeURIComponent(p) : null;
		} catch {
			return null;
		}
	};
	const hasExt = (name) => /\.[a-z0-9]{1,5}$/i.test(name);
	const resolveName = (url, resp, idx) => {
		const ct = (resp.headers.get("content-type") || "")
			.split(";")[0]
			.trim()
			.toLowerCase();
		const ext = CT_EXT[ct] ?? "";
		let name =
			parseCD(resp.headers.get("content-disposition")) || pathName(url);
		if (!name) name = `file_${idx + 1}`;
		if (!hasExt(name) && ext) name += ext;
		return name;
	};
	const humanSize = (bytes) => {
		if (bytes == null || !Number.isFinite(bytes)) return "unknown";
		const u = ["B", "KB", "MB", "GB", "TB"];
		let n = bytes,
			i = 0;
		while (n >= 1024 && i < u.length - 1) {
			n /= 1024;
			i++;
		}
		return `${n.toFixed(i === 0 ? 0 : 2)} ${u[i]}`;
	};

	const mkRow = (parent, url) => {
		const row = $("div", {
			display: "flex",
			alignItems: "center",
			gap: "10px",
			padding: "8px 12px",
			background: C.panel,
			borderRadius: "8px",
			fontSize: "12px",
			borderLeft: `3px solid ${C.faint}`,
			marginBottom: "6px",
		});
		const icon = $(
			"span",
			{ flexShrink: "0", fontSize: "13px", width: "14px" },
			"○",
		);
		const text = $(
			"span",
			{
				flexShrink: "0",
				maxWidth: "300px",
				color: C.faint,
				whiteSpace: "nowrap",
				overflow: "hidden",
				textOverflow: "ellipsis",
			},
			url,
		);
		text.title = url;
		const stat = $(
			"span",
			{
				flex: "1",
				color: C.dim,
				paddingLeft: "12px",
				whiteSpace: "nowrap",
				overflow: "hidden",
				textOverflow: "ellipsis",
			},
			"",
		);
		row.appendChild(icon);
		row.appendChild(text);
		row.appendChild(stat);
		parent.appendChild(row);
		const set = (state, statTxt) => {
			stat.textContent = statTxt;
			stat.title = statTxt;
			const map = {
				ok: [C.green, C.greenBg, "✓"],
				warn: [C.amber, C.amberBg, "!"],
				tab: [C.amber, C.amberBg, "↗"],
				skip: [C.dim, C.panel2, "⤼"],
				err: [C.red, C.redBg, "✕"],
			};
			const [col, bgc, gl] = map[state] || map.err;
			icon.textContent = gl;
			icon.style.color = col;
			stat.style.color = col;
			row.style.borderLeftColor = col;
			row.style.background = bgc;
		};
		return { set };
	};

	// getUrls now just reads the textarea (already normalised); apply guards anyway
	const getUrls = () => {
		let urls = ta.value
			.split("\n")
			.map((s) => s.trim())
			.filter(Boolean);
		if (optUnique.checked) urls = [...new Set(urls)];
		if (optSort.checked)
			urls = urls.slice().sort((a, b) => a.localeCompare(b));
		return urls;
	};
	const updateCount = () => {
		const n = getUrls().length;
		urlCount.textContent = `${n} URL${n === 1 ? "" : "s"}`;
	};
	const busy = (b) =>
		[inspectBtn, testBtn, dlBtn, copyBtn, clearBtn].forEach((x) => {
			x.disabled = b;
			x.style.opacity = b ? "0.5" : "1";
			x.style.pointerEvents = b ? "none" : "auto";
		});

	let lastResults = null;

	copyBtn.addEventListener("click", async () => {
		if (!lastResults || !lastResults.lines.length) {
			copyBtn.textContent = "Nothing to copy";
			setTimeout(() => (copyBtn.textContent = "Copy results"), 1200);
			return;
		}
		const tsv = lastResults.lines
			.map((l) =>
				[l.status ?? "", l.name ?? "", l.note ?? "", l.url].join("\t"),
			)
			.join("\n");
		try {
			await navigator.clipboard.writeText(tsv);
			copyBtn.textContent = "Copied ✓";
		} catch {
			const t = document.createElement("textarea");
			t.value = tsv;
			document.body.appendChild(t);
			t.select();
			try {
				document.execCommand("copy");
				copyBtn.textContent = "Copied ✓";
			} catch {
				copyBtn.textContent = "Copy failed";
			}
			t.remove();
		}
		setTimeout(() => (copyBtn.textContent = "Copy results"), 1200);
	});

	// ── live title updater ──────────────────────────────────────────────
	const updateTestTitle = (sec, ok, fail, total, done) => {
		const segs = [
			[`Test results (${done}/${total}): `, null],
			[`${ok} ok`, C.green],
		];
		if (fail > 0) segs.push([`, ${fail} failed`, C.red]);
		setTitle(sec.title, segs);
	};
	const updateDlTitle = (sec, ok, fail, skipped, opened, total, done) => {
		const segs = [
			[`Download results (${done}/${total}): `, null],
			[`${ok} downloaded`, C.green],
		];
		if (fail > 0) segs.push([`, ${fail} failed`, C.red]);
		if (skipped > 0) segs.push([`, ${skipped} skipped`, C.dim]);
		if (opened > 0) segs.push([`, ${opened} opened in tab`, C.amber]);
		setTitle(sec.title, segs);
	};

	inspectBtn.addEventListener("click", async () => {
		const urls = getUrls();
		if (!urls.length) return;
		const url = urls[0];
		busy(true);
		collapseAll();
		emptyState.style.display = "none";
		inspectSec.show();
		inspectSec.setOpen(true);
		setTitle(inspectSec.title, [
			["Inspect: ", null],
			["probing…", C.dim],
		]);
		inspectSec.bodyEl.innerHTML = "";
		inspectSec.bodyEl.appendChild(
			$(
				"div",
				{
					color: C.dim,
					fontFamily: "ui-monospace, monospace",
					fontSize: "12px",
				},
				"…",
			),
		);
		try {
			let resp = await fetch(url, {
				method: "HEAD",
				credentials: "omit",
			});
			let via = "HEAD";
			if (!resp.ok && (resp.status === 405 || resp.status === 501)) {
				resp = await fetch(url, {
					method: "GET",
					headers: { Range: "bytes=0-0" },
					credentials: "omit",
				});
				via = "ranged GET (HEAD rejected)";
			}
			const h = resp.headers;
			const ctRaw = h.get("content-type") || "(none)";
			const ct = ctRaw.split(";")[0].trim().toLowerCase();
			const ext = CT_EXT[ct] ?? "(unmapped)";
			const name = resolveName(url, resp, 0);
			let size = null;
			const cl = h.get("content-length");
			if (cl != null) size = parseInt(cl);
			const cr = h.get("content-range");
			if ((size == null || via.startsWith("ranged")) && cr) {
				const m = /\/(\d+)\s*$/.exec(cr);
				if (m) size = parseInt(m[1]);
			}
			if (size == null && via === "HEAD") {
				try {
					const r2 = await fetch(url, {
						method: "GET",
						headers: { Range: "bytes=0-0" },
						credentials: "omit",
					});
					const cr2 = r2.headers.get("content-range");
					const m2 = cr2 && /\/(\d+)\s*$/.exec(cr2);
					if (m2) {
						size = parseInt(m2[1]);
						via += " + ranged GET";
					}
				} catch {}
			}
			const prior = history[url];
			const okStatus = resp.ok || resp.status === 206;
			let titleCol = C.green;
			if (!okStatus) titleCol = C.red;
			else if (ext === "(unmapped)" || !hasExt(name) || size == null)
				titleCol = C.amber;
			setTitle(inspectSec.title, [
				["Inspect: ", null],
				[name, titleCol],
			]);
			const rows = [
				["URL", url],
				["Probed via", via],
				["Status", `${resp.status} ${resp.statusText}`],
				["Content-Type", ctRaw],
				["Mapped ext", ext],
				["Will save as", name],
				[
					"Size",
					size == null
						? "unknown"
						: `${humanSize(size)} (${size.toLocaleString()} bytes)`,
				],
				["Last-Modified", h.get("last-modified") || "(none)"],
				["ETag", h.get("etag") || "(none)"],
				["Accept-Ranges", h.get("accept-ranges") || "(none)"],
				["Cache-Control", h.get("cache-control") || "(none)"],
				[
					"Content-Disposition",
					h.get("content-disposition") || "(none)",
				],
				["Downloaded before", prior ? fmtWhen(prior.at) : "no"],
			];
			inspectSec.bodyEl.innerHTML = "";
			rows.forEach(([k, v]) => {
				const line = $("div", {
					display: "flex",
					gap: "12px",
					fontFamily: "ui-monospace, monospace",
					fontSize: "12px",
					lineHeight: "1.85",
				});
				line.appendChild(
					$(
						"span",
						{ color: C.faint, minWidth: "150px", flexShrink: "0" },
						k,
					),
				);
				line.appendChild(
					$("span", { color: C.text, wordBreak: "break-all" }, v),
				);
				inspectSec.bodyEl.appendChild(line);
			});
			// #3: Inspect now populates lastResults too
			lastResults = {
				kind: "inspect",
				lines: [
					{
						url,
						status: resp.status,
						name,
						note: `${ctRaw}; ${size == null ? "size unknown" : humanSize(size)}`,
					},
				],
			};
		} catch (err) {
			setTitle(inspectSec.title, [
				["Inspect: ", null],
				["failed / not reachable", C.red],
			]);
			inspectSec.bodyEl.innerHTML = "";
			inspectSec.bodyEl.appendChild(
				$(
					"div",
					{
						color: C.red,
						fontFamily: "ui-monospace, monospace",
						fontSize: "12px",
					},
					"Blocked by CORS/CSP or network error: " +
						(err.message || String(err)),
				),
			);
			lastResults = {
				kind: "inspect",
				lines: [
					{
						url,
						status: "",
						name: "",
						note: "blocked: " + (err.message || "error"),
					},
				],
			};
		}
		busy(false);
	});

	testBtn.addEventListener("click", async () => {
		const urls = getUrls();
		if (!urls.length) return;
		busy(true);
		collapseAll();
		emptyState.style.display = "none";
		testSec.show();
		testSec.setOpen(true);
		testSec.bodyEl.innerHTML = "";
		const total = urls.length;
		const d = optDelay.checked
			? Math.max(50, Math.floor(getDelay() / 2))
			: 0;
		let ok = 0,
			fail = 0;
		const lines = [];
		updateTestTitle(testSec, 0, 0, total, 0);
		for (let i = 0; i < urls.length; i++) {
			const r = mkRow(testSec.bodyEl, urls[i]);
			try {
				let resp = await fetch(urls[i], {
					method: "HEAD",
					credentials: "omit",
				});
				if (!resp.ok && (resp.status === 405 || resp.status === 501))
					resp = await fetch(urls[i], {
						method: "GET",
						headers: { Range: "bytes=0-0" },
						credentials: "omit",
					});
				const name = resolveName(urls[i], resp, i);
				if (resp.ok || resp.status === 206) {
					r.set("ok", `${resp.status} · ${name}`);
					ok++;
					lines.push({
						url: urls[i],
						status: resp.status,
						name,
						note: "ok",
					});
				} else {
					r.set("warn", `${resp.status} ${resp.statusText}`);
					fail++;
					lines.push({
						url: urls[i],
						status: resp.status,
						name: "",
						note: resp.statusText,
					});
				}
			} catch {
				r.set("err", "blocked");
				fail++;
				lines.push({
					url: urls[i],
					status: "",
					name: "",
					note: "blocked",
				});
			}
			updateTestTitle(testSec, ok, fail, total, i + 1); // #1: live update
			if (d) await sleep(d);
		}
		testSec.setOpen(false);
		lastResults = { kind: "test", lines };
		busy(false);
	});

	dlBtn.addEventListener("click", async () => {
		let urls = getUrls();
		if (!urls.length) return;
		busy(true);
		collapseAll();
		emptyState.style.display = "none";
		dlSec.show();
		dlSec.setOpen(true);
		dlSec.bodyEl.innerHTML = "";
		const total = urls.length;
		const d = optDelay.checked ? getDelay() : 0;
		let ok = 0,
			fail = 0,
			opened = 0,
			skipped = 0;
		const lines = [];
		updateDlTitle(dlSec, 0, 0, 0, 0, total, 0);
		for (let i = 0; i < urls.length; i++) {
			const url = urls[i];
			const r = mkRow(dlSec.bodyEl, url);
			if (optSkip.checked && history[url]) {
				r.set(
					"skip",
					`skipped · downloaded ${fmtWhen(history[url].at)}`,
				);
				skipped++;
				lines.push({
					url,
					status: "",
					name: history[url].name || "",
					note: "skipped (prior " + fmtWhen(history[url].at) + ")",
				});
				updateDlTitle(dlSec, ok, fail, skipped, opened, total, i + 1);
				if (d) await sleep(d);
				continue;
			}
			try {
				const resp = await fetch(url, { credentials: "omit" });
				if (!resp.ok) {
					r.set("err", `${resp.status} ${resp.statusText}`);
					fail++;
					lines.push({
						url,
						status: resp.status,
						name: "",
						note: resp.statusText,
					});
					updateDlTitle(
						dlSec,
						ok,
						fail,
						skipped,
						opened,
						total,
						i + 1,
					);
					if (d) await sleep(d);
					continue;
				}
				const blob = await resp.blob();
				const name = resolveName(url, resp, i);
				const objUrl = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = objUrl;
				a.download = name;
				document.body.appendChild(a);
				a.click();
				a.remove();
				URL.revokeObjectURL(objUrl);
				r.set(
					"ok",
					`${resp.status} · ${name} · ${humanSize(blob.size)}`,
				);
				ok++;
				history[url] = { at: new Date().toISOString(), name };
				saveHist(history);
				lines.push({
					url,
					status: resp.status,
					name,
					note: humanSize(blob.size),
				});
			} catch (err) {
				if (optFallback.checked) {
					try {
						window.open(url, "_blank");
						r.set("tab", "opened in tab");
						opened++;
						lines.push({
							url,
							status: "",
							name: "",
							note: "opened in tab",
						});
					} catch {
						r.set("err", "blocked");
						fail++;
						lines.push({
							url,
							status: "",
							name: "",
							note: "blocked",
						});
					}
				} else {
					r.set("err", "blocked");
					fail++;
					lines.push({ url, status: "", name: "", note: "blocked" });
				}
			}
			updateDlTitle(dlSec, ok, fail, skipped, opened, total, i + 1); // #1: live update
			if (d) await sleep(d);
		}
		dlSec.setOpen(false);
		dlBtn.textContent = "Download again";
		refreshHistInfo();
		lastResults = { kind: "download", lines };
		busy(false);
	});

	normalizeTextarea();
})();
