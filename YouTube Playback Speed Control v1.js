// Speed control for YouTube (beyond the 2x cap)
// Run this snippet after the video has loaded.
//
// Usage:
//   - Press Shift+> to increase speed by 0.1
//   - Press Shift+< to decrease speed by 0.1
//   - Use ss(rate) in the console to set a specific speed
//     Examples: ss(2.5), ss(3), ss(1) to reset to normal
//
// A temporary overlay in the top-left corner shows the current speed
// for 2 seconds whenever it changes.
// Overrides YouTube's native Shift+>/< behaviour to allow speeds beyond 2x.

// --- Track current rate ourselves to avoid floating point issues ---
let currentRate = document.querySelector("video")?.playbackRate || 1.0;

// --- Overlay setup ---
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
	zIndex: "999999",
	opacity: "0",
	transition: "opacity 0.3s ease",
	pointerEvents: "none",
});
document.body.appendChild(overlay);

let overlayTimeout = null;

// --- Show overlay briefly ---
function showOverlay(text) {
	overlay.textContent = text;
	overlay.style.opacity = "1";
	clearTimeout(overlayTimeout);
	overlayTimeout = setTimeout(() => {
		overlay.style.opacity = "0";
	}, 2000);
}

// --- Set speed ---
function ss(rate) {
	rate = Math.min(16, Math.max(0.1, rate));
	rate = Math.round(rate * 10) / 10;
	currentRate = rate;
	document.querySelectorAll("video").forEach((v) => (v.playbackRate = rate));
	showOverlay(`${rate.toFixed(1)}x`);
	console.log(`Speed set to ${rate}x`);
}

// --- Keyboard shortcuts ---
// Captures Shift+> and Shift+< before YouTube's own handler,
// allowing speed adjustments in 0.1 increments with no 2x cap.
document.addEventListener(
	"keydown",
	(e) => {
		const tag = e.target.tagName.toLowerCase();
		if (tag === "input" || tag === "textarea" || e.target.isContentEditable)
			return;

		if (e.shiftKey && (e.key === ">" || e.key === ".")) {
			e.stopPropagation();
			e.preventDefault();
			ss(currentRate + 0.1);
		} else if (e.shiftKey && (e.key === "<" || e.key === ",")) {
			e.stopPropagation();
			e.preventDefault();
			ss(currentRate - 0.1);
		}
	},
	true,
); // <-- 'true' = capture phase, so this fires before YouTube's listener

// Sync with current video speed on run
ss(currentRate);
