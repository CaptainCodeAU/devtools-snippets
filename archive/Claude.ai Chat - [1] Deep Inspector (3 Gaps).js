// =============================================================================
// Claude.ai Chat — Targeted Deep Inspector
// =============================================================================
// Fills 3 gaps from the initial inspection:
//   1. Assistant message inner structure (action bar, tool-use, markdown)
//   2. File attachment / thumbnail structure + download URLs
//   3. Artifact block structure (content, download links)
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
    minWidth: "320px",
    border: "1px solid #333",
  });
  overlay.textContent =
    "🔬 Deep-inspecting assistant messages, files & artifacts...";
  document.body.appendChild(overlay);

  const lines = [];
  const log = (...args) => {
    const l = args.join(" ");
    lines.push(l);
    console.log(l);
  };

  const describeEl = (el, maxText = 120) => {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return "(null)";
    const tag = el.tagName.toLowerCase();
    const cls =
      el.className && typeof el.className === "string"
        ? "." + el.className.trim().split(/\s+/).slice(0, 6).join(".")
        : "";
    const id = el.id ? "#" + el.id : "";
    const role = el.getAttribute("role")
      ? ` [role=${el.getAttribute("role")}]`
      : "";
    const href = el.getAttribute("href")
      ? ` [href="${el.getAttribute("href").substring(0, 120)}"]`
      : "";
    const src = el.getAttribute("src")
      ? ` [src="${el.getAttribute("src").substring(0, 120)}"]`
      : "";
    const ariaLabel = el.getAttribute("aria-label")
      ? ` [aria-label="${el.getAttribute("aria-label").substring(0, 80)}"]`
      : "";
    const dataAttrs = Array.from(el.attributes)
      .filter((a) => a.name.startsWith("data-"))
      .map((a) => ` [${a.name}="${a.value.substring(0, 80)}"]`)
      .join("");
    const text = (el.textContent || "")
      .trim()
      .substring(0, maxText)
      .replace(/\n/g, "\\n");
    const textStr = text
      ? ` text="${text}${text.length >= maxText ? "…" : ""}"`
      : "";
    return `<${tag}${id}${cls}${role}${href}${src}${ariaLabel}${dataAttrs}>${textStr}`;
  };

  const dumpTree = (el, indent = 0, maxDepth = 12) => {
    if (indent > maxDepth) {
      log("  ".repeat(indent) + "... (depth limit)");
      return;
    }
    const pad = "  ".repeat(indent);
    if (el.nodeType === Node.TEXT_NODE) {
      const t = el.textContent.trim();
      if (t) log(`${pad}#text "${t.substring(0, 150).replace(/\n/g, "\\n")}"`);
      return;
    }
    if (el.nodeType !== Node.ELEMENT_NODE) return;
    const childCount = el.children.length;
    log(
      `${pad}${describeEl(el, 100)}${childCount > 0 ? ` [${childCount} ch]` : ""}`,
    );
    Array.from(el.childNodes).forEach((child) =>
      dumpTree(child, indent + 1, maxDepth),
    );
  };

  try {
    log("═══════════════════════════════════════════════════════════════");
    log("  CLAUDE.AI CHAT — DEEP INSPECTION (3 GAPS)");
    log(`  URL: ${window.location.href}`);
    log(`  Time: ${new Date().toISOString()}`);
    log("═══════════════════════════════════════════════════════════════");
    log("");

    // ── Find all turn wrappers ─────────────────────────────────────────
    const scrollContainer = document.querySelector(
      '[data-autoscroll-container="true"]',
    );
    const allTurns = scrollContainer
      ? Array.from(
          scrollContainer.querySelectorAll("div[data-test-render-count]"),
        )
      : [];
    log(`Total turn wrappers found: ${allTurns.length}`);
    log("");

    // Classify turns
    const classified = allTurns.map((turn, i) => {
      const hasUserMsg = !!turn.querySelector('[data-testid="user-message"]');
      const hasResponse = !!turn.querySelector(
        '.font-claude-response, [class*="font-claude-response"]',
      );
      const hasArtifact = !!turn.querySelector('[class*="artifact-block"]');
      const hasFileThumbnail = !!turn.querySelector(
        '[data-testid="file-thumbnail"]',
      );
      const hasToolUse = !!turn.querySelector(
        '[class*="tool-use"], [class*="search"], [class*="web_search"], [class*="fetch"]',
      );
      return {
        el: turn,
        i,
        hasUserMsg,
        hasResponse,
        hasArtifact,
        hasFileThumbnail,
        hasToolUse,
      };
    });

    log("── Turn classification summary ──");
    classified.forEach((t) => {
      const flags = [
        t.hasUserMsg && "USER",
        t.hasResponse && "ASSISTANT",
        t.hasArtifact && "ARTIFACT",
        t.hasFileThumbnail && "FILE",
        t.hasToolUse && "TOOL",
      ]
        .filter(Boolean)
        .join("+");
      const preview = t.el.textContent
        .trim()
        .substring(0, 80)
        .replace(/\n/g, "\\n");
      log(`  [${t.i}] ${flags.padEnd(25)} "${preview}…"`);
    });
    log("");

    // ═══════════════════════════════════════════════════════════════════
    // GAP 1: ASSISTANT MESSAGE INNER STRUCTURE
    // ═══════════════════════════════════════════════════════════════════
    log("═══════════════════════════════════════════════════════════════");
    log("  GAP 1: ASSISTANT MESSAGE INNER STRUCTURE");
    log("═══════════════════════════════════════════════════════════════");
    log("");

    // Find first 2 assistant turns (preferring ones with artifacts or tool use)
    const assistantTurns = classified.filter((t) => t.hasResponse);
    const interestingAssistant = [
      // One with tool use if possible
      assistantTurns.find((t) => t.hasToolUse) || assistantTurns[0],
      // One with artifact if possible
      assistantTurns.find((t) => t.hasArtifact) || assistantTurns[1],
      // One plain response
      assistantTurns.find((t) => !t.hasToolUse && !t.hasArtifact) ||
        assistantTurns[2],
    ].filter(Boolean);

    // Deduplicate
    const seen = new Set();
    const uniqueAssistant = interestingAssistant.filter((t) => {
      if (seen.has(t.i)) return false;
      seen.add(t.i);
      return true;
    });

    uniqueAssistant.forEach((t) => {
      const flags =
        [t.hasToolUse && "TOOL", t.hasArtifact && "ARTIFACT"]
          .filter(Boolean)
          .join("+") || "PLAIN";
      log(`▼▼▼ ASSISTANT TURN ${t.i} (${flags}) — FULL DEPTH ▼▼▼`);
      dumpTree(t.el, 0, 12);
      log(`▲▲▲ END ASSISTANT TURN ${t.i} ▲▲▲`);
      log("");
    });

    // ═══════════════════════════════════════════════════════════════════
    // GAP 2: FILE ATTACHMENT / THUMBNAIL STRUCTURE
    // ═══════════════════════════════════════════════════════════════════
    log("═══════════════════════════════════════════════════════════════");
    log("  GAP 2: FILE ATTACHMENTS & THUMBNAILS");
    log("═══════════════════════════════════════════════════════════════");
    log("");

    const fileThumbnails = document.querySelectorAll(
      '[data-testid="file-thumbnail"]',
    );
    log(`Total file-thumbnail elements: ${fileThumbnails.length}`);
    log("");

    // Dump first 4 in full depth, then summarize the rest
    fileThumbnails.forEach((ft, i) => {
      if (i < 4) {
        log(`▼▼▼ FILE-THUMBNAIL ${i} — FULL DEPTH ▼▼▼`);
        // Also dump 2 levels of parent context
        const parent = ft.parentElement;
        const grandparent = parent ? parent.parentElement : null;
        if (grandparent) {
          log(`  GRANDPARENT: ${describeEl(grandparent, 80)}`);
        }
        if (parent) {
          log(`  PARENT: ${describeEl(parent, 80)}`);
        }
        dumpTree(ft, 0, 10);
        log(`▲▲▲ END FILE-THUMBNAIL ${i} ▲▲▲`);
        log("");
      } else if (i === 4) {
        log("── Remaining file-thumbnails (summary only) ──");
      }
      if (i >= 4) {
        // Just log key attributes
        const name = ft.getAttribute("data-testid") || "";
        const text = ft.textContent
          .trim()
          .substring(0, 80)
          .replace(/\n/g, "\\n");
        const innerA = ft.querySelector("a[href]");
        const href = innerA ? innerA.getAttribute("href") : "(no link)";
        const innerImg = ft.querySelector("img");
        const imgSrc = innerImg ? innerImg.getAttribute("src") : "(no img)";
        log(`  [${i}] text="${text}" href=${href} img=${imgSrc}`);
      }
    });
    log("");

    // Also look for file references via other patterns
    log("── Other file-related elements ──");
    const filePatterns = [
      'a[href*="/files/"]',
      'a[href*="/api/"][href*="/files/"]',
      'img[src*="/files/"]',
      '[class*="file-name"]',
      '[class*="fileName"]',
      '[class*="attachment-name"]',
      '[class*="attachmentName"]',
    ];
    filePatterns.forEach((sel) => {
      const found = document.querySelectorAll(sel);
      if (found.length > 0) {
        log(`  "${sel}" → ${found.length} match(es)`);
        found.forEach((f, fi) => {
          if (fi < 5) log(`    [${fi}] ${describeEl(f, 100)}`);
        });
      }
    });
    log("");

    // ═══════════════════════════════════════════════════════════════════
    // GAP 3: ARTIFACT BLOCK STRUCTURE
    // ═══════════════════════════════════════════════════════════════════
    log("═══════════════════════════════════════════════════════════════");
    log("  GAP 3: ARTIFACT BLOCKS");
    log("═══════════════════════════════════════════════════════════════");
    log("");

    const artifactBlocks = document.querySelectorAll(
      '[class*="artifact-block"]',
    );
    log(`Total artifact-block elements: ${artifactBlocks.length}`);
    log("");

    // Deduplicate — artifact-block-cell might be inside a parent artifact-block wrapper
    const topLevelArtifacts = [];
    const artSeen = new Set();
    artifactBlocks.forEach((ab) => {
      // Walk up to find the outermost artifact-block ancestor
      let top = ab;
      let parent = ab.parentElement;
      while (parent) {
        if (
          parent.className &&
          typeof parent.className === "string" &&
          parent.className.includes("artifact-block")
        ) {
          top = parent;
        }
        parent = parent.parentElement;
      }
      if (!artSeen.has(top)) {
        artSeen.add(top);
        topLevelArtifacts.push(top);
      }
    });

    log(
      `Deduplicated top-level artifact containers: ${topLevelArtifacts.length}`,
    );
    log("");

    // Dump first 3 in full detail
    topLevelArtifacts.slice(0, 3).forEach((ab, i) => {
      log(`▼▼▼ ARTIFACT ${i} — FULL DEPTH ▼▼▼`);
      // Parent context
      const parent = ab.parentElement;
      if (parent) log(`  PARENT: ${describeEl(parent, 80)}`);
      dumpTree(ab, 0, 10);
      log(`▲▲▲ END ARTIFACT ${i} ▲▲▲`);
      log("");
    });

    // Summarize the rest
    if (topLevelArtifacts.length > 3) {
      log("── Remaining artifacts (summary) ──");
      topLevelArtifacts.slice(3).forEach((ab, i) => {
        const text = ab.textContent
          .trim()
          .substring(0, 100)
          .replace(/\n/g, "\\n");
        const links = ab.querySelectorAll("a[href]");
        const hrefs = Array.from(links)
          .map((a) => a.getAttribute("href"))
          .filter(Boolean);
        const buttons = ab.querySelectorAll("button");
        const btnLabels = Array.from(buttons).map((b) =>
          (b.getAttribute("aria-label") || b.textContent.trim()).substring(
            0,
            40,
          ),
        );
        log(`  [${i + 3}] text="${text}"`);
        if (hrefs.length) log(`         hrefs: ${hrefs.join(", ")}`);
        if (btnLabels.length) log(`         buttons: ${btnLabels.join(", ")}`);
      });
      log("");
    }

    // ═══════════════════════════════════════════════════════════════════
    // BONUS: Check for user turn with files (to see how files attach
    //        to a specific message)
    // ═══════════════════════════════════════════════════════════════════
    log("═══════════════════════════════════════════════════════════════");
    log("  BONUS: USER TURNS WITH FILE ATTACHMENTS");
    log("═══════════════════════════════════════════════════════════════");
    log("");

    const userTurnsWithFiles = classified.filter(
      (t) => t.hasUserMsg && t.hasFileThumbnail,
    );
    log(`User turns with files: ${userTurnsWithFiles.length}`);
    log("");

    // Dump first 2 at full depth
    userTurnsWithFiles.slice(0, 2).forEach((t) => {
      log(`▼▼▼ USER TURN ${t.i} (with files) — FULL DEPTH ▼▼▼`);
      dumpTree(t.el, 0, 12);
      log(`▲▲▲ END USER TURN ${t.i} ▲▲▲`);
      log("");
    });

    // ═══════════════════════════════════════════════════════════════════
    // BONUS 2: Unique class names containing key terms
    // ═══════════════════════════════════════════════════════════════════
    log("═══════════════════════════════════════════════════════════════");
    log("  BONUS 2: KEY CLASS NAME PATTERNS");
    log("═══════════════════════════════════════════════════════════════");
    log("");

    const keyTerms = [
      "tool",
      "search",
      "fetch",
      "source",
      "citation",
      "cite",
      "download",
      "copy",
      "retry",
      "action-bar",
      "streaming",
    ];
    const classSet = new Set();
    document.querySelectorAll("*").forEach((el) => {
      if (el.className && typeof el.className === "string") {
        el.className
          .trim()
          .split(/\s+/)
          .forEach((c) => {
            for (const term of keyTerms) {
              if (c.toLowerCase().includes(term)) classSet.add(c);
            }
          });
      }
    });
    const sortedClasses = Array.from(classSet).sort();
    sortedClasses.forEach((c) => log(`  .${c}`));
    log("");

    log("═══════════════════════════════════════════════════════════════");
    log("  DONE — Deep inspection complete");
    log("═══════════════════════════════════════════════════════════════");

    downloadFile(
      lines.join("\n"),
      `claude_chat_deep_inspect_${Date.now()}.txt`,
    );
    overlay.textContent = "✅ Done! Deep inspection report downloaded.";
    await sleep(3000);
  } catch (err) {
    log("FATAL: " + err.message);
    log(err.stack);
    downloadFile(lines.join("\n"), "claude_chat_deep_inspect_ERROR.txt");
    overlay.textContent = "❌ " + err.message;
    await sleep(4000);
  } finally {
    overlay.remove();
  }
})();
