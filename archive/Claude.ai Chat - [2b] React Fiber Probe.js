// =============================================================================
// Probe: Extract artifact content from React fiber tree
// =============================================================================
// Since the Download button triggers zero DOM/network events, the content
// must be stored in React state/props. This script walks the React fiber
// tree to find it.
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
    minWidth: "450px",
    maxWidth: "650px",
    maxHeight: "85vh",
    overflow: "auto",
    border: "1px solid #333",
    lineHeight: "1.4",
    whiteSpace: "pre-wrap",
  });
  overlay.textContent =
    "🔬 Scanning React fiber tree for artifact content...\n\n";
  document.body.appendChild(overlay);

  const ap = (msg) => {
    overlay.textContent += msg + "\n";
    console.log(msg);
  };
  const lines = [];
  const log = (msg) => {
    lines.push(msg);
    ap(msg);
  };

  // ── Get React fiber from a DOM element ───────────────────────────────
  const getFiber = (el) => {
    const key = Object.keys(el).find(
      (k) =>
        k.startsWith("__reactFiber$") ||
        k.startsWith("__reactInternalInstance$"),
    );
    return key ? el[key] : null;
  };

  const getProps = (el) => {
    const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"));
    return key ? el[key] : null;
  };

  // ── Walk up the fiber tree and collect all props/state ───────────────
  const walkFiberUp = (fiber, maxDepth = 30) => {
    const findings = [];
    let current = fiber;
    let depth = 0;
    while (current && depth < maxDepth) {
      const entry = {
        depth,
        type: null,
        props: null,
        state: null,
        hooks: null,
      };

      // Component name
      if (typeof current.type === "function") {
        entry.type =
          current.type.displayName || current.type.name || "(anonymous fn)";
      } else if (typeof current.type === "string") {
        entry.type = current.type;
      } else if (current.type) {
        entry.type = String(current.type);
      }

      // Props
      if (current.memoizedProps) {
        entry.props = current.memoizedProps;
      }

      // State (class components)
      if (current.memoizedState && typeof current.memoizedState === "object") {
        entry.state = current.memoizedState;
      }

      findings.push(entry);
      current = current.return;
      depth++;
    }
    return findings;
  };

  // ── Search object for strings that look like artifact content ────────
  const searchForContent = (
    obj,
    path = "",
    maxDepth = 8,
    visited = new WeakSet(),
  ) => {
    const results = [];
    if (maxDepth <= 0 || !obj || typeof obj !== "object") return results;
    if (visited.has(obj)) return results;
    visited.add(obj);

    for (const [key, val] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (typeof val === "string" && val.length > 100) {
        // Could be artifact content
        const preview = val.substring(0, 120).replace(/\n/g, "\\n");
        results.push({
          path: currentPath,
          length: val.length,
          preview,
        });
      }

      if (val && typeof val === "object" && !Array.isArray(val)) {
        results.push(
          ...searchForContent(val, currentPath, maxDepth - 1, visited),
        );
      }
      if (Array.isArray(val)) {
        val.forEach((item, i) => {
          if (item && typeof item === "object") {
            results.push(
              ...searchForContent(
                item,
                `${currentPath}[${i}]`,
                maxDepth - 1,
                visited,
              ),
            );
          }
          if (typeof item === "string" && item.length > 100) {
            const preview = item.substring(0, 120).replace(/\n/g, "\\n");
            results.push({
              path: `${currentPath}[${i}]`,
              length: item.length,
              preview,
            });
          }
        });
      }
    }
    return results;
  };

  try {
    // ── Find first artifact Download button ─────────────────────────────
    const btn = document.querySelector(
      '.artifact-block-cell button[aria-label^="Download"]',
    );
    if (!btn) {
      log("❌ No Download button found");
      return;
    }

    const cell = btn.closest(".artifact-block-cell");
    const title =
      cell?.querySelector(".line-clamp-1")?.textContent?.trim() || "?";
    log(`🎯 Target artifact: "${title}"\n`);

    // ── Strategy 1: Walk fiber from the Download button ─────────────────
    log("═══ STRATEGY 1: Fiber walk from Download button ═══\n");
    const btnFiber = getFiber(btn);
    if (btnFiber) {
      const findings = walkFiberUp(btnFiber, 40);
      log(`Walked ${findings.length} fiber nodes up from button\n`);

      // Log component names
      log("Component chain:");
      findings.forEach((f, i) => {
        if (f.type && typeof f.type === "string" && f.type.length < 10) return; // skip div, span etc
        log(`  [${i}] ${f.type || "(dom)"}`);
      });
      log("");

      // Search each node for long strings (artifact content)
      log("Searching for content strings...");
      let found = false;
      for (const f of findings) {
        if (f.props) {
          const results = searchForContent(f.props, "props", 6);
          for (const r of results) {
            // Filter out obvious non-content (CSS classes, etc)
            if (
              r.length > 200 &&
              !r.preview.includes("className") &&
              !r.path.includes("className")
            ) {
              log(`  📄 [${f.type}] ${r.path} (${r.length} chars)`);
              log(`     "${r.preview}…"`);
              found = true;
            }
          }
        }
        if (f.state) {
          const results = searchForContent(f.state, "state", 6);
          for (const r of results) {
            if (r.length > 200) {
              log(`  📄 [${f.type}] ${r.path} (${r.length} chars)`);
              log(`     "${r.preview}…"`);
              found = true;
            }
          }
        }
      }
      if (!found) log("  (no long content strings found in fiber props/state)");
    } else {
      log("Could not get fiber from button element");
    }

    log("");

    // ── Strategy 2: Walk fiber from the artifact-block-cell ─────────────
    log("═══ STRATEGY 2: Fiber walk from artifact-block-cell ═══\n");
    const cellFiber = getFiber(cell);
    if (cellFiber) {
      const findings = walkFiberUp(cellFiber, 40);
      log(`Walked ${findings.length} fiber nodes\n`);

      let found = false;
      for (const f of findings) {
        for (const source of [f.props, f.state]) {
          if (!source) continue;
          const results = searchForContent(
            source,
            source === f.props ? "props" : "state",
            6,
          );
          for (const r of results) {
            if (
              r.length > 200 &&
              !r.preview.includes("className") &&
              !r.path.includes("className")
            ) {
              log(`  📄 [${f.type}] ${r.path} (${r.length} chars)`);
              log(`     "${r.preview}…"`);
              found = true;
            }
          }
        }
      }
      if (!found) log("  (no long content strings found)");
    }

    log("");

    // ── Strategy 3: Walk fiber from the parent [role="button"] ──────────
    log("═══ STRATEGY 3: Fiber walk from parent role=button ═══\n");
    const roleBtn = cell?.closest('[role="button"]');
    if (roleBtn) {
      const rbFiber = getFiber(roleBtn);
      if (rbFiber) {
        const findings = walkFiberUp(rbFiber, 50);
        log(`Walked ${findings.length} fiber nodes\n`);

        // Also look for onClick handlers that might contain content
        let found = false;
        for (const f of findings) {
          // Check for content in props
          if (f.props) {
            // Look specifically for content/text/markdown/body/value keys
            for (const key of [
              "content",
              "text",
              "markdown",
              "body",
              "value",
              "artifactContent",
              "artifact",
              "data",
              "children",
              "fileContent",
              "rawContent",
              "source",
            ]) {
              const val = f.props[key];
              if (typeof val === "string" && val.length > 100) {
                log(`  📄 [${f.type}] props.${key} (${val.length} chars)`);
                log(`     "${val.substring(0, 150).replace(/\n/g, "\\n")}…"`);
                found = true;
              }
            }
            // Deep search
            const results = searchForContent(f.props, "props", 8);
            for (const r of results) {
              if (r.length > 500 && !r.preview.includes("class")) {
                log(`  📄 [${f.type}] ${r.path} (${r.length} chars)`);
                log(`     "${r.preview}…"`);
                found = true;
              }
            }
          }
          // Check memoizedState hooks chain
          let hookState = f.state;
          let hookIdx = 0;
          while (hookState && hookIdx < 20) {
            if (hookState.memoizedState) {
              const hs = hookState.memoizedState;
              if (typeof hs === "string" && hs.length > 200) {
                log(
                  `  📄 [${f.type}] hook[${hookIdx}].memoizedState (${hs.length} chars)`,
                );
                log(`     "${hs.substring(0, 150).replace(/\n/g, "\\n")}…"`);
                found = true;
              }
              if (hs && typeof hs === "object") {
                const results = searchForContent(hs, `hook[${hookIdx}]`, 5);
                for (const r of results) {
                  if (r.length > 500 && !r.preview.includes("class")) {
                    log(`  📄 [${f.type}] ${r.path} (${r.length} chars)`);
                    log(`     "${r.preview}…"`);
                    found = true;
                  }
                }
              }
            }
            hookState = hookState.next;
            hookIdx++;
          }
        }
        if (!found) log("  (no content found)");
      }
    }

    log("");

    // ── Strategy 4: Check the onClick handler of the Download button ────
    log("═══ STRATEGY 4: Download button onClick inspection ═══\n");
    const btnProps = getProps(btn);
    if (btnProps) {
      log("Button props keys: " + Object.keys(btnProps).join(", "));
      if (btnProps.onClick) {
        log("onClick exists: " + typeof btnProps.onClick);
        log("onClick.toString():");
        const fnStr = btnProps.onClick.toString();
        log(fnStr.substring(0, 500));
        // Check if it's a closure with bound variables
        log("\nClosure scope (via toString):");
        log(fnStr.substring(0, 1000));
      }
    } else {
      log("Could not get React props from button");
    }

    log("");
    log("═══ DONE ═══");

    // Download report
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fiber_probe_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    overlay.style.cursor = "pointer";
    overlay.addEventListener("click", () => overlay.remove());
    await sleep(8000);
  } catch (err) {
    log("FATAL: " + err.message);
    log(err.stack);
    await sleep(5000);
  } finally {
    overlay.remove();
  }
})();
