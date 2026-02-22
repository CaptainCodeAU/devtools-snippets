// Speed control for streaming video (e.g. Prime Video)
// Run this snippet after the video has loaded.
//
// Usage:
//   - Press D to increase speed by 0.1
//   - Press S to decrease speed by 0.1
//   - Use ss(rate) in the console to set a specific speed
//     Examples: ss(1.7), ss(2), ss(1) to reset to normal
//
// A temporary overlay in the top-left corner shows the current speed
// for 2 seconds whenever it changes.
// The X-Ray panel is automatically removed on run.

// --- Remove X-Ray overlay ---
// Removes the Prime Video X-Ray cast/trivia panel from the DOM entirely.
// document.querySelectorAll('.xrayQuickView, .xrayQuickViewList, [class*="xray"]').forEach(el => el.remove());

// --- Track current rate ourselves to avoid floating point issues ---
let currentRate = 1.0;

// --- Overlay setup ---
// Creates a fixed overlay element in the top-left corner of the page.
// Hidden by default; shown briefly whenever the speed changes.
const overlay = document.createElement('div');
Object.assign(overlay.style, {
  position: 'fixed',
  top: '20px',
  left: '20px',
  background: 'rgba(0, 0, 0, 0.7)',
  color: 'white',
  padding: '8px 14px',
  borderRadius: '6px',
  fontSize: '16px',
  fontFamily: 'monospace',
  zIndex: '999999',
  opacity: '0',
  transition: 'opacity 0.3s ease',
  pointerEvents: 'none', // don't interfere with clicks
});
document.body.appendChild(overlay);

// Timer reference for hiding the overlay after 2 seconds
let overlayTimeout = null;

// --- Show overlay briefly ---
// Displays the current speed in the overlay, then fades it out after 2 seconds.
function showOverlay(text) {
  overlay.textContent = text;
  overlay.style.opacity = '1';
  clearTimeout(overlayTimeout);
  overlayTimeout = setTimeout(() => {
    overlay.style.opacity = '0';
  }, 2000);
}

// --- Set speed ---
// Sets playback rate on all video elements and shows the overlay.
// Updates our internal tracker to avoid floating point drift.
function ss(rate) {
  // Clamp speed to a reasonable range (0.1 to 16)
  rate = Math.min(16, Math.max(0.1, rate));
  // Round to 1 decimal place to avoid floating point drift
  rate = Math.round(rate * 10) / 10;
  currentRate = rate;
  document.querySelectorAll('video').forEach(v => v.playbackRate = rate);
  showOverlay(`${rate.toFixed(1)}x`);
  console.log(`Speed set to ${rate}x`);
}

// --- Keyboard shortcuts ---
// Listens for 'S' (decrease by 0.1) and 'D' (increase by 0.1).
// Ignored when typing in input fields, textareas, etc.
document.addEventListener('keydown', (e) => {
  // Don't trigger when typing in input fields or textareas
  const tag = e.target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;

  if (e.key === 'd' || e.key === 'D') {
    ss(currentRate + 0.1);
  } else if (e.key === 's' || e.key === 'S') {
    ss(currentRate - 0.1);
  }
});

// Set default speed on run
ss(1.0);