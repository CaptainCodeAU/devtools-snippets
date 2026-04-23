// Speed + Brightness control for YouTube (beyond the 2x cap)
// Run this snippet after the video has loaded.
//
// Usage:
//   Speed:
//     - Press Shift+> to increase speed by 0.1
//     - Press Shift+< to decrease speed by 0.1
//     - Use ss(rate) in the console to set a specific speed
//       Examples: ss(2.5), ss(3), ss(1) to reset to normal
//
//   Brightness:
//     - Press 'a' to darken the video
//     - Press 's' to lighten the video
//     - Use sb(level) in the console to set a specific darkness
//       Examples: sb(0) for no overlay, sb(0.5) for 50% dark, sb(0) to reset
//
// A temporary overlay in the top-left corner shows the current value
// for 2 seconds whenever it changes.

// --- Track current state ---
let currentRate = document.querySelector("video")?.playbackRate || 1.0;
let currentDarkness = 0; // stored as integer 0–18 (steps of 5%, i.e. 0.05 opacity each)

// --- Info overlay setup ---
const overlay = document.createElement("div");
Object.assign(overlay.style, {
	position: "fixed",
	top: "20px",
	left: "20px",
	background: "rgba(0, 0, 0, 0.7)",
	color: "white",
	padding: "8px 14px",
	borderRadius: "6px",
	fontSize: "16px",
	fontFamily: "monospace",
	zIndex: "9999999",
	opacity: "0",
	transition: "opacity 0.3s ease",
	pointerEvents: "none",
});
document.body.appendChild(overlay);

let overlayTimeout = null;

function showOverlay(text) {
	overlay.textContent = text;
	overlay.style.opacity = "1";
	clearTimeout(overlayTimeout);
	overlayTimeout = setTimeout(() => {
		overlay.style.opacity = "0";
	}, 2000);
}

// --- Darkness overlay setup ---
const darkOverlay = document.createElement("div");
Object.assign(darkOverlay.style, {
	position: "fixed",
	top: "0",
	left: "0",
	width: "100vw",
	height: "100vh",
	background: "black",
	opacity: "0",
	zIndex: "9999998",
	pointerEvents: "none",
});
document.body.appendChild(darkOverlay);

// --- Set speed ---
function ss(rate) {
	rate = Math.min(16, Math.max(0.1, rate));
	rate = Math.round(rate * 10) / 10;
	currentRate = rate;
	document.querySelectorAll("video").forEach((v) => (v.playbackRate = rate));
	showOverlay(`Speed: ${rate.toFixed(1)}x`);
	console.log(`Speed set to ${rate}x`);
}

// --- Set brightness (darkness as integer steps 0–18, each step = 5%) ---
function sb(step) {
	step = Math.min(18, Math.max(0, Math.round(step)));
	currentDarkness = step;
	const opacity = (step * 5) / 100;
	darkOverlay.style.opacity = String(opacity);
	const pct = 100 - step * 5;
	showOverlay(`Brightness: ${pct}%`);
	console.log(`Brightness set to ${pct}% (darkness: ${opacity})`);
}

// --- Keyboard shortcuts ---
document.addEventListener(
	"keydown",
	(e) => {
		const tag = e.target.tagName.toLowerCase();
		if (tag === "input" || tag === "textarea" || e.target.isContentEditable)
			return;

		// Speed: Shift+> / Shift+<
		if (e.shiftKey && (e.key === ">" || e.key === ".")) {
			e.stopPropagation();
			e.preventDefault();
			ss(currentRate + 0.1);
		} else if (e.shiftKey && (e.key === "<" || e.key === ",")) {
			e.stopPropagation();
			e.preventDefault();
			ss(currentRate - 0.1);
		}

		// Brightness: a = darker, s = lighter
		if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
			if (e.key === "a") {
				e.stopPropagation();
				e.preventDefault();
				sb(currentDarkness + 1);
			} else if (e.key === "s") {
				e.stopPropagation();
				e.preventDefault();
				sb(currentDarkness - 1);
			}
		}
	},
	true,
);

// Sync on run
ss(currentRate);
sb(0);
