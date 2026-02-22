// Comprehensive Resource Analyzer
// Run this in the console of the page you want to analyze
// Make sure you're logged-in before you run the analyzer
(async function analyzePageResources() {
	console.clear();
	console.log("🔍 COMPREHENSIVE PAGE RESOURCE ANALYSIS");
	console.log("=".repeat(60));

	// 1. Performance API resources
	const perfResources = performance.getEntriesByType("resource");

	// 2. Better categorization
	const categories = {
		css: [],
		js: [],
		fonts: [],
		fontCss: [], // Google Fonts CSS links
		images: [],
		svg: [],
		api: [],
		other: [],
	};

	perfResources.forEach((r) => {
		const url = r.name.toLowerCase();

		if (url.includes("fonts.googleapis.com")) {
			categories.fontCss.push(r.name);
		} else if (
			url.includes("fonts.gstatic.com") ||
			url.match(/\.(woff2?|ttf|otf|eot)/)
		) {
			categories.fonts.push(r.name);
		} else if (url.includes(".css")) {
			categories.css.push(r.name);
		} else if (
			url.includes(".js") &&
			!url.includes("gtm.js") &&
			!url.includes("analytics")
		) {
			categories.js.push(r.name);
		} else if (url.match(/\.(png|jpg|jpeg|gif|webp|ico|avif)(\?|$)/)) {
			categories.images.push(r.name);
		} else if (url.includes(".svg")) {
			categories.svg.push(r.name);
		} else if (url.includes("/api/")) {
			categories.api.push(r.name);
		} else if (!url.includes("gtm.js") && !url.includes("googletagmanager")) {
			categories.other.push(r.name);
		}
	});

	// 3. Check document.fonts API for loaded fonts
	const loadedFonts = [];
	if (document.fonts) {
		document.fonts.forEach((font) => {
			loadedFonts.push({
				family: font.family,
				weight: font.weight,
				style: font.style,
				status: font.status,
			});
		});
	}

	// 4. Find fonts from stylesheets
	const fontFacesInCSS = [];
	try {
		for (const sheet of document.styleSheets) {
			try {
				for (const rule of sheet.cssRules || []) {
					if (rule instanceof CSSFontFaceRule) {
						fontFacesInCSS.push({
							family: rule.style.fontFamily,
							src: rule.style.src,
						});
					}
				}
			} catch (e) {
				/* CORS blocked stylesheet */
			}
		}
	} catch (e) {}

	// 5. Find inline SVGs
	const inlineSvgs = document.querySelectorAll("svg");
	const svgInfo = {
		count: inlineSvgs.length,
		unique: new Set(),
	};
	inlineSvgs.forEach((svg) => {
		// Get a simplified identifier
		const id =
			svg.getAttribute("data-slot") ||
			svg.getAttribute("class")?.split(" ")[0] ||
			svg.innerHTML.substring(0, 50);
		svgInfo.unique.add(id);
	});

	// 6. Find all images in DOM (including background images)
	const domImages = new Set();

	// Regular img tags
	document.querySelectorAll("img").forEach((img) => {
		if (img.src) domImages.add(img.src);
		if (img.srcset) domImages.add(`srcset: ${img.srcset}`);
	});

	// Background images in computed styles
	document.querySelectorAll("*").forEach((el) => {
		const bg = getComputedStyle(el).backgroundImage;
		if (bg && bg !== "none" && bg.includes("url(")) {
			domImages.add(bg);
		}
	});

	// 7. Check link tags for more resources
	const linkTags = {
		stylesheets: [],
		preconnect: [],
		icons: [],
		other: [],
	};
	document.querySelectorAll("link").forEach((link) => {
		const href = link.href;
		const rel = link.rel;
		if (rel === "stylesheet") linkTags.stylesheets.push(href);
		else if (rel === "preconnect") linkTags.preconnect.push(href);
		else if (rel === "icon" || rel === "apple-touch-icon")
			linkTags.icons.push(href);
		else if (href) linkTags.other.push({ rel, href });
	});

	// 8. Parse Google Fonts CSS to find actual font files
	let googleFontFiles = [];
	for (const fontCssUrl of categories.fontCss) {
		try {
			const response = await fetch(fontCssUrl);
			const css = await response.text();
			const fontUrls =
				css.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/g) || [];
			googleFontFiles = fontUrls.map((u) =>
				u.replace("url(", "").replace(")", ""),
			);
		} catch (e) {
			console.log("Could not fetch Google Fonts CSS:", e);
		}
	}

	// PRINT RESULTS
	console.log("\n" + "=".repeat(60));
	console.log("📊 NETWORK RESOURCES (from Performance API)");
	console.log("=".repeat(60));

	console.log(`\n🎨 CSS FILES (${categories.css.length}):`);
	categories.css.forEach((u) => console.log(`  ✓ ${u}`));

	console.log(`\n🔤 GOOGLE FONTS CSS (${categories.fontCss.length}):`);
	categories.fontCss.forEach((u) => console.log(`  ✓ ${u}`));

	console.log(`\n📜 JS FILES (${categories.js.length}):`);
	categories.js.forEach((u) => console.log(`  ✓ ${u}`));

	console.log(`\n🖼️ IMAGES (${categories.images.length}):`);
	categories.images.forEach((u) => console.log(`  ✓ ${u}`));

	console.log(`\n🎯 SVG FILES (${categories.svg.length}):`);
	categories.svg.forEach((u) => console.log(`  ✓ ${u}`));

	console.log(`\n🔗 API CALLS (${categories.api.length}):`);
	categories.api.forEach((u) => console.log(`  ✓ ${u}`));

	console.log("\n" + "=".repeat(60));
	console.log("🔤 FONT ANALYSIS");
	console.log("=".repeat(60));

	console.log(
		`\n📥 Font files loaded via network (${categories.fonts.length}):`,
	);
	categories.fonts.forEach((u) => console.log(`  ✓ ${u}`));

	console.log(
		`\n📥 Font files from Google Fonts CSS (${googleFontFiles.length}):`,
	);
	googleFontFiles.forEach((u) => console.log(`  ✓ ${u}`));

	console.log(
		`\n🖥️ Fonts registered in document.fonts (${loadedFonts.length}):`,
	);
	const uniqueFamilies = [...new Set(loadedFonts.map((f) => f.family))];
	uniqueFamilies.forEach((family) => {
		const variants = loadedFonts.filter((f) => f.family === family);
		console.log(`  ✓ ${family} (${variants.length} variants)`);
	});

	console.log("\n" + "=".repeat(60));
	console.log("🎨 DOM ANALYSIS");
	console.log("=".repeat(60));

	console.log(
		`\n🔷 Inline SVGs: ${svgInfo.count} total (${svgInfo.unique.size} unique patterns)`,
	);

	console.log(`\n🖼️ Images in DOM (${domImages.size}):`);
	domImages.forEach((u) => console.log(`  ✓ ${u}`));

	console.log(`\n🔗 Link tags - Icons (${linkTags.icons.length}):`);
	linkTags.icons.forEach((u) => console.log(`  ✓ ${u}`));

	console.log("\n" + "=".repeat(60));
	console.log("📋 SUMMARY - WHAT NEEDS TO BE DOWNLOADED");
	console.log("=".repeat(60));

	const totalAssets = {
		"CSS files": categories.css.length,
		"Google Fonts CSS": categories.fontCss.length,
		"Font files (woff2)": googleFontFiles.length,
		"JS files": categories.js.length,
		"External images": categories.images.length,
		"External SVGs": categories.svg.length,
		"Inline SVGs": svgInfo.count,
		"Favicons/Icons": linkTags.icons.length,
	};

	console.log("\n");
	Object.entries(totalAssets).forEach(([key, val]) => {
		const status = val > 0 ? "✓" : "⚠️";
		console.log(`  ${status} ${key}: ${val}`);
	});

	// What extension captured vs what exists
	console.log("\n" + "=".repeat(60));
	console.log("🔴 EXTENSION GAP ANALYSIS");
	console.log("=".repeat(60));
	console.log("\nExtension captured:");
	console.log("  - 2 CSS files");
	console.log("  - 1 JS file");
	console.log("  - 2 images");
	console.log("  - 0 font files");
	console.log("\nMissing:");
	console.log(`  - ${googleFontFiles.length} font files (woff2)`);
	console.log(
		`  - ${svgInfo.count} inline SVGs (need to be preserved in HTML)`,
	);

	// Return data for export
	return {
		categories,
		googleFontFiles,
		loadedFonts,
		inlineSvgCount: svgInfo.count,
		domImages: [...domImages],
		linkTags,
	};
})();
