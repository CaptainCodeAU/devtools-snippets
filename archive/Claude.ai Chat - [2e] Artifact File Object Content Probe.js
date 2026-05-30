// =============================================================================
// Probe: Dump the full `file` object from depth 6 of the artifact fiber
// =============================================================================
// We know fiber[depth 6] has file.path. Let's dump ALL properties of that
// file object — it might contain .content, .text, .data, .body, etc.
// =============================================================================

(async () => {
  "use strict";

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
    minWidth: "550px",
    maxWidth: "750px",
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

  log("🔬 Artifact File Object Probe\n");

  const getFiber = (el) => {
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    return key ? el[key] : null;
  };

  // Deep dump any object showing all keys, types, and values
  const dumpObject = (
    obj,
    path = "",
    maxDepth = 6,
    visited = new WeakSet(),
  ) => {
    if (!obj || typeof obj !== "object" || maxDepth <= 0) return;
    if (visited.has(obj)) {
      log(`${path} → (circular ref)`);
      return;
    }
    visited.add(obj);

    const keys = Object.keys(obj);
    for (const key of keys) {
      const val = obj[key];
      const p = path ? `${path}.${key}` : key;
      const type = typeof val;

      if (val === null) {
        log(`  ${p} = null`);
      } else if (type === "string") {
        if (val.length > 200) {
          log(
            `  ${p} = (string, ${val.length} chars) "${val.substring(0, 200).replace(/\n/g, "\\n")}…"`,
          );
        } else {
          log(`  ${p} = "${val.replace(/\n/g, "\\n")}"`);
        }
      } else if (type === "number" || type === "boolean") {
        log(`  ${p} = ${val}`);
      } else if (type === "function") {
        log(`  ${p} = [function ${val.name || "(anon)"}]`);
      } else if (Array.isArray(val)) {
        log(`  ${p} = [Array, length=${val.length}]`);
        if (val.length <= 10) {
          val.forEach((item, i) => {
            if (item && typeof item === "object") {
              dumpObject(item, `${p}[${i}]`, maxDepth - 1, visited);
            } else {
              const sv =
                typeof item === "string"
                  ? `"${item.substring(0, 100).replace(/\n/g, "\\n")}${item.length > 100 ? "…" : ""}"`
                  : String(item);
              log(`  ${p}[${i}] = ${sv}`);
            }
          });
        }
      } else if (type === "object") {
        const childKeys = Object.keys(val);
        log(
          `  ${p} = {${childKeys.slice(0, 8).join(", ")}${childKeys.length > 8 ? "..." : ""}} (${childKeys.length} keys)`,
        );
        dumpObject(val, p, maxDepth - 1, visited);
      }
    }
  };

  // ── Find first artifact cell and walk fiber ──────────────────────────
  const cells = document.querySelectorAll(".artifact-block-cell");
  const seenTitles = new Set();

  for (const cell of cells) {
    const title =
      cell.querySelector(".line-clamp-1")?.textContent?.trim() || "?";
    if (seenTitles.has(title)) continue;
    seenTitles.add(title);

    // Only dump first 3 artifacts in detail
    if (seenTitles.size > 3) break;

    log(`\n═══ ARTIFACT: "${title}" ═══\n`);

    const fiber = getFiber(cell);
    let current = fiber;
    let depth = 0;

    while (current && depth < 15) {
      const props = current.memoizedProps;
      if (props) {
        // Check for 'file' property
        if (props.file && typeof props.file === "object") {
          log(`--- fiber[${depth}].props.file ---`);
          dumpObject(props.file, "file", 5);
          log("");
        }
        // Check for 'properties' property
        if (props.properties && typeof props.properties === "object") {
          log(`--- fiber[${depth}].props.properties ---`);
          dumpObject(props.properties, "properties", 5);
          log("");
        }
        // Check for any prop containing 'content' or 'artifact'
        for (const [key, val] of Object.entries(props)) {
          if (key === "children" || key === "className" || key === "style")
            continue;
          if (
            /content|artifact|data|source|text|body|markdown|raw/i.test(key)
          ) {
            if (typeof val === "string" && val.length > 50) {
              log(
                `--- fiber[${depth}].props.${key} (string, ${val.length} chars) ---`,
              );
              log(`  "${val.substring(0, 300).replace(/\n/g, "\\n")}…"`);
              log("");
            } else if (val && typeof val === "object") {
              log(`--- fiber[${depth}].props.${key} ---`);
              dumpObject(val, key, 4);
              log("");
            }
          }
        }

        // Check for message object (which might contain artifact content)
        if (props.message && typeof props.message === "object") {
          log(`--- fiber[${depth}].props.message (top-level keys) ---`);
          const msgKeys = Object.keys(props.message);
          log(`  Keys: ${msgKeys.join(", ")}`);
          // Dump specific interesting fields
          for (const mk of [
            "content",
            "text",
            "files",
            "attachments",
            "artifacts",
            "output",
            "outputs",
          ]) {
            if (props.message[mk]) {
              log(`\n  message.${mk}:`);
              if (typeof props.message[mk] === "string") {
                log(
                  `    (string, ${props.message[mk].length} chars) "${props.message[mk].substring(0, 200).replace(/\n/g, "\\n")}…"`,
                );
              } else {
                dumpObject(props.message[mk], `message.${mk}`, 4);
              }
            }
          }
          log("");
        }

        // Check for updatedMessage
        if (props.updatedMessage && typeof props.updatedMessage === "object") {
          log(`--- fiber[${depth}].props.updatedMessage (top-level keys) ---`);
          const msgKeys = Object.keys(props.updatedMessage);
          log(`  Keys: ${msgKeys.join(", ")}`);
          for (const mk of [
            "content",
            "text",
            "files",
            "attachments",
            "artifacts",
            "output",
            "outputs",
            "files_v2",
          ]) {
            if (props.updatedMessage[mk]) {
              log(`\n  updatedMessage.${mk}:`);
              if (typeof props.updatedMessage[mk] === "string") {
                log(`    (string, ${props.updatedMessage[mk].length} chars)`);
                log(
                  `    "${props.updatedMessage[mk].substring(0, 300).replace(/\n/g, "\\n")}…"`,
                );
              } else {
                dumpObject(props.updatedMessage[mk], `updatedMessage.${mk}`, 5);
              }
            }
          }
          log("");
        }
      }

      current = current.return;
      depth++;
    }
  }

  log("\n═══ DONE ═══");

  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `file_object_probe_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  overlay.style.cursor = "pointer";
  overlay.addEventListener("click", () => overlay.remove());
  await new Promise((r) => setTimeout(r, 8000));
  overlay.remove();
})();
