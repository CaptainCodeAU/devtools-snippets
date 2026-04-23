// =============================================================================
// Claude.ai Chat Exporter v4 — Fiber-Based Artifact Extraction
// =============================================================================
// Run on any https://claude.ai/chat/<id> page.
//
// Exports:
//   1. transcript.md   — full conversation in structured Markdown
//   2. artifacts/       — artifact file contents extracted from React fiber state
//   3. images/          — chat images fetched and saved
//   4. manifest.json    — machine-readable index of all exported content
//
// Strategy:
//   1. Try File System Access API → folder with subfolder structure
//   2. Fall back to JSZip → single .zip download
//   3. Artifact content extracted directly from React fiber message.content[]
//      (no Download button clicking — content lives in client-side state)
// =============================================================================

(async () => {
  "use strict";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── UI ───────────────────────────────────────────────────────────────
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
    minWidth: "380px",
    border: "1px solid #333",
    lineHeight: "1.6",
    whiteSpace: "pre-line",
  });
  const setStatus = (msg) => {
    overlay.textContent = msg;
    console.log(msg);
  };
  setStatus("📦 Exporting chat...");
  document.body.appendChild(overlay);

  // ── Storage ──────────────────────────────────────────────────────────
  let folderHandle = null,
    useFolder = false,
    zip = null;

  try {
    if (window.showDirectoryPicker) {
      setStatus("📂 Pick a parent folder for the export...");
      const parentHandle = await window.showDirectoryPicker({
        mode: "readwrite",
      });
      const title =
        document.title.replace(/ - Claude$/, "").trim() || "Untitled_Chat";
      const safeName = title.replace(/[^a-zA-Z0-9 _-]/g, "_").substring(0, 80);
      folderHandle = await parentHandle.getDirectoryHandle(safeName, {
        create: true,
      });
      useFolder = true;
      setStatus(`📂 Writing to: ${safeName}/`);
    }
  } catch (e) {
    if (e.name !== "AbortError") console.warn("FS API failed:", e.message);
  }

  if (!useFolder) {
    setStatus("📦 Loading JSZip...");
    await new Promise((res, rej) => {
      if (window.JSZip) return res();
      const s = document.createElement("script");
      s.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = res;
      s.onerror = () => rej(new Error("JSZip load failed"));
      document.head.appendChild(s);
    });
    zip = new JSZip();
  }

  console.log(
    `[v4] Storage: ${useFolder ? "File System Access API (folder)" : "JSZip (ZIP download)"}`,
  );

  const writeFile = async (path, content) => {
    if (useFolder) {
      const parts = path.split("/");
      let dir = folderHandle;
      for (let i = 0; i < parts.length - 1; i++)
        dir = await dir.getDirectoryHandle(parts[i], { create: true });
      const fh = await dir.getFileHandle(parts[parts.length - 1], {
        create: true,
      });
      const w = await fh.createWritable();
      await w.write(content);
      await w.close();
    } else {
      zip.file(path, content);
    }
  };

  const finalizeZip = async (filename) => {
    if (!useFolder && zip) {
      setStatus("📦 Generating ZIP...");
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  try {
    // ── React fiber helpers ────────────────────────────────────────────
    let cachedFiberKey = null;
    const getFiber = (el) => {
      if (cachedFiberKey && el[cachedFiberKey]) return el[cachedFiberKey];
      const k = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
      if (k) {
        cachedFiberKey = k;
        return el[k];
      }
      return null;
    };

    // Walk UP the fiber tree (toward root) to find a prop on an ancestor
    const findPropUp = (fiber, name, maxD = 50) => {
      let c = fiber,
        d = 0;
      while (c && d < maxD) {
        if (c.memoizedProps?.[name] !== undefined) return c.memoizedProps[name];
        c = c.return;
        d++;
      }
    };

    // Walk DOWN the fiber tree (BFS through children) to find a prop on a descendant
    const findPropDown = (fiber, name, maxD = 30) => {
      const queue = [{ f: fiber, d: 0 }];
      while (queue.length > 0) {
        const { f, d } = queue.shift();
        if (!f || d > maxD) continue;
        if (f.memoizedProps?.[name] !== undefined) return f.memoizedProps[name];
        if (f.child) queue.push({ f: f.child, d: d + 1 });
        if (f.sibling && d > 0) queue.push({ f: f.sibling, d });
      }
    };

    const resolveArtifactName = (input) =>
      input.file_name || input.filename || input.title || "artifact";

    // ── Page metadata ──────────────────────────────────────────────────
    const chatTitle =
      document.title.replace(/ - Claude$/, "").trim() || "Untitled Chat";
    const chatUrl = window.location.href;
    const chatId = chatUrl.match(/\/chat\/([a-f0-9-]+)/)?.[1] || "unknown";
    const safeTitle = chatTitle
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .substring(0, 60);
    const exportTime = new Date().toISOString();

    console.log(`[v4] Chat: "${chatTitle}" | ID: ${chatId} | URL: ${chatUrl}`);

    // ── Extract turns from React fiber ─────────────────────────────────
    setStatus("🔍 Extracting conversation data...");

    const scrollContainer = document.querySelector(
      '[data-autoscroll-container="true"]',
    );
    const turnEls = scrollContainer
      ? Array.from(
          scrollContainer.querySelectorAll("div[data-test-render-count]"),
        )
      : [];

    const turns = [];
    const artifactFileMap = new Map();
    const allImages = [];
    let skippedNoFiber = 0;
    let skippedNoMessage = 0;

    console.log(
      `[v4] scrollContainer: ${!!scrollContainer}, turnEls: ${turnEls.length}`,
    );

    for (const el of turnEls) {
      const fiber = getFiber(el);
      if (!fiber) {
        skippedNoFiber++;
        console.log(
          `[v4] Turn skipped — no fiber on element`,
          el.className?.substring(0, 60),
        );
        continue;
      }

      const message = findPropDown(fiber, "message", 30);
      if (!message) {
        skippedNoMessage++;
        console.log(`[v4] Turn skipped — no message prop in fiber subtree`);
        continue;
      }

      // Files
      const files = [];
      el.querySelectorAll('[data-testid="file-thumbnail"]').forEach((ft) => {
        const label =
          ft.querySelector("button[aria-label]")?.getAttribute("aria-label") ||
          "";
        const parts = label.split(",").map((s) => s.trim());
        files.push({
          filename: parts[0] || "unknown",
          ext: parts[1] || "",
          size: parts[2] || "",
        });
      });

      // Images — collect during extraction so index stays aligned with turns
      const turnImages = [];
      el.querySelectorAll('img[src*="/files/"]').forEach((img) => {
        const alt = img.getAttribute("alt") || "image";
        const src = img.getAttribute("src") || "";
        const safeName = alt.replace(/[^a-zA-Z0-9_.-]/g, "_").substring(0, 80);
        turnImages.push({ alt, src, safeName });
        allImages.push({ alt, src, safeName });
      });

      // Artifacts — extract metadata from DOM cells + content from fiber
      const artifacts = [];
      const artifactCells = el.querySelectorAll(".artifact-block-cell");
      artifactCells.forEach((cell) => {
        const title =
          cell.querySelector(".line-clamp-1")?.textContent?.trim() ||
          "Untitled";
        const type =
          cell.querySelector(".text-text-400")?.textContent?.trim() || "";
        const cellFiber = getFiber(cell);
        const file = findPropUp(cellFiber, "file", 10);
        const props = findPropUp(cellFiber, "properties", 10);
        artifacts.push({
          title,
          type,
          filename: file?.name || "",
          path: file?.path || props?.id || "",
        });
      });

      // Extract artifact file content from message.content[] tool_use blocks
      const contentBlocks = message.content || [];
      for (const block of contentBlocks) {
        if (block.type !== "tool_use" || !block.input) continue;
        const fileText = block.input.file_text || block.input.content;
        if (!fileText) continue;

        const fileName =
          resolveArtifactName(block.input) !== "artifact"
            ? resolveArtifactName(block.input)
            : (artifacts.length > 0
                ? artifacts[artifacts.length - 1].filename
                : "") || `artifact_${artifactFileMap.size + 1}.txt`;

        const safeFileName = fileName
          .replace(/.*\//, "")
          .replace(/[^a-zA-Z0-9_.-]/g, "_")
          .substring(0, 120);

        artifactFileMap.set(safeFileName, {
          title:
            block.input.title ||
            artifacts[artifacts.length - 1]?.title ||
            safeFileName,
          fileName,
          safeFileName,
          content: fileText,
          toolName: block.name || "unknown",
        });
      }

      const ts = message.created_at
        ? new Date(message.created_at).toLocaleString("en-AU", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : null;
      const uiTs =
        el.querySelector("span.text-text-500.text-xs")?.textContent?.trim() ||
        null;

      const role =
        message.sender === "human"
          ? "user"
          : message.sender === "assistant"
            ? "assistant"
            : message.sender;

      console.log(
        `[v4] Turn ${turns.length + 1}: ${role} | ` +
          `content blocks: ${contentBlocks.length} | ` +
          `files: ${files.length} | ` +
          `images: ${turnImages.length} | ` +
          `artifacts: ${artifacts.length} | ` +
          `artifact files extracted: ${contentBlocks.filter((b) => b.type === "tool_use" && b.input && (b.input.file_text || b.input.content)).length}`,
      );

      turns.push({
        role,
        content: contentBlocks,
        text: message.text || "",
        timestamp: ts,
        uiTimestamp: uiTs,
        files,
        artifacts,
        images: turnImages,
        uuid: message.uuid,
      });
    }

    const allArtifactFiles = Array.from(artifactFileMap.values());

    console.log(
      `[v4] Extraction complete:\n` +
        `  Turns: ${turns.length} (${turns.filter((t) => t.role === "user").length} user, ${turns.filter((t) => t.role === "assistant").length} assistant)\n` +
        `  Skipped: ${skippedNoFiber} no-fiber, ${skippedNoMessage} no-message\n` +
        `  Artifacts: ${allArtifactFiles.length} files (${allArtifactFiles.reduce((s, a) => s + a.content.length, 0)} chars total)\n` +
        `  Images: ${allImages.length}\n` +
        `  Uploaded files: ${turns.reduce((s, t) => s + t.files.length, 0)}`,
    );

    setStatus(`📦 ${turns.length} turns extracted. Building markdown...`);

    // ── Build markdown ─────────────────────────────────────────────────
    const md = [];
    const allArtifacts = [];
    const seenArt = new Set();

    md.push(`# ${chatTitle}\n`);
    md.push(`> **Source:** ${chatUrl}`);
    md.push(`> **Exported:** ${exportTime}`);
    md.push(`> **Turns:** ${turns.length}\n`);
    md.push("---\n");

    for (let i = 0; i < turns.length; i++) {
      const t = turns[i];
      if (i > 0 && i % 10 === 0) setStatus(`📦 Markdown: ${i}/${turns.length}`);

      if (t.role === "user") {
        md.push(
          `## 👤 User${t.uiTimestamp ? " — " + t.uiTimestamp : t.timestamp ? " — " + t.timestamp : ""}\n`,
        );

        if (t.files.length > 0) {
          md.push("**Attached files:**");
          t.files.forEach((f) =>
            md.push(
              `- 📎 \`${f.filename}\`${f.size ? " (" + f.size + ")" : ""}`,
            ),
          );
          md.push("");
        }

        for (const img of t.images) {
          md.push(`![${img.alt}](images/${img.safeName}.jpg)\n`);
        }

        if (t.text) {
          md.push(t.text.trim() + "\n");
        } else {
          t.content
            .filter((b) => b.type === "text" && b.text)
            .forEach((b) => md.push(b.text.trim() + "\n"));
        }
      } else if (t.role === "assistant") {
        md.push(`## 🤖 Claude${t.timestamp ? " — " + t.timestamp : ""}\n`);

        for (const block of t.content) {
          switch (block.type) {
            case "text":
              if (block.text?.trim()) md.push(block.text.trim() + "\n");
              break;

            case "tool_use":
              md.push(
                `<details><summary>🔧 ${block.message || block.name || "Tool use"}</summary>\n`,
              );
              if (block.input) {
                const fileText = block.input.file_text || block.input.content;
                if (fileText) {
                  const name = resolveArtifactName(block.input);
                  md.push(
                    `Artifact file: \`artifacts/${name.replace(/.*\//, "")}\`\n`,
                  );
                } else {
                  const s =
                    typeof block.input === "string"
                      ? block.input
                      : JSON.stringify(block.input, null, 2);
                  if (s.length < 500) md.push("```json\n" + s + "\n```\n");
                }
              }
              md.push("</details>\n");
              break;

            case "tool_result":
              md.push(
                `<details><summary>📋 ${block.message || block.name || "Result"}</summary>\n`,
              );
              if (Array.isArray(block.content)) {
                block.content.forEach((item) => {
                  if (item.title) md.push(`**${item.title}**`);
                  if (item.url) md.push(`URL: ${item.url}`);
                  md.push("");
                });
              }
              md.push("</details>\n");
              break;

            default:
              if (block.text?.trim()) md.push(block.text.trim() + "\n");
              if (block.message) md.push(`> *${block.message}*\n`);
              break;
          }
        }

        for (const art of t.artifacts) {
          if (!seenArt.has(art.title)) {
            seenArt.add(art.title);
            allArtifacts.push(art);
          }
          md.push(
            `> 📄 **Artifact:** ${art.title}${art.type ? " (" + art.type + ")" : ""}`,
          );
          if (art.filename) md.push(`> File: \`artifacts/${art.filename}\``);
          md.push("");
        }
      }
      md.push("---\n");
    }

    if (allArtifacts.length > 0) {
      md.push("## 📑 Artifacts Index\n");
      allArtifacts.forEach((a, i) => {
        md.push(
          `${i + 1}. **${a.title}**${a.type ? " — " + a.type : ""}${a.filename ? " → `artifacts/" + a.filename + "`" : ""}`,
        );
      });
      md.push("");
    }

    const finalMd =
      md
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim() + "\n";

    // ── Build manifest.json ────────────────────────────────────────────
    const manifest = {
      chatTitle,
      chatUrl,
      chatId,
      exportTime,
      exporterVersion: "v4",
      totalTurns: turns.length,
      artifacts: allArtifactFiles.map((a) => ({
        title: a.title,
        fileName: a.fileName,
        exportPath: "artifacts/" + a.safeFileName,
        toolName: a.toolName,
        contentLength: a.content.length,
      })),
      images: allImages.map((img) => ({
        alt: img.alt,
        src: img.src,
      })),
      uploadedFiles: turns.flatMap((t) => t.files),
    };

    // ── Write transcript + manifest ────────────────────────────────────
    setStatus("📝 Writing transcript...");
    await writeFile("transcript.md", finalMd);
    console.log(`[v4] transcript.md written (${finalMd.length} chars)`);
    await writeFile("manifest.json", JSON.stringify(manifest, null, 2));
    console.log(`[v4] manifest.json written`);

    // ── Write artifact files from fiber content ────────────────────────
    if (allArtifactFiles.length > 0) {
      setStatus(
        `📄 Writing ${allArtifactFiles.length} artifact(s) from React state...`,
      );
      for (let i = 0; i < allArtifactFiles.length; i++) {
        const art = allArtifactFiles[i];
        setStatus(
          `📄 Artifact ${i + 1}/${allArtifactFiles.length}: ${art.title}`,
        );
        await writeFile("artifacts/" + art.safeFileName, art.content);
        console.log(
          `[v4] Artifact written: ${art.safeFileName} (${art.content.length} chars, tool: ${art.toolName})`,
        );
      }
    }

    // ── Download images (parallel with concurrency limit) ──────────────
    if (allImages.length > 0) {
      setStatus(`🖼️ Downloading ${allImages.length} image(s)...`);
      const concurrency = 5;
      for (let i = 0; i < allImages.length; i += concurrency) {
        const batch = allImages.slice(i, i + concurrency);
        await Promise.all(
          batch.map(async (img) => {
            try {
              const resp = await fetch(img.src, { credentials: "include" });
              const blob = await resp.blob();
              const ext = blob.type.includes("png")
                ? ".png"
                : blob.type.includes("gif")
                  ? ".gif"
                  : ".jpg";
              await writeFile("images/" + img.safeName + ext, blob);
            } catch (e) {
              console.warn("Image failed:", e);
            }
          }),
        );
      }
    }

    // ── Finalize ───────────────────────────────────────────────────────
    await finalizeZip(`${safeTitle}.zip`);

    const method = useFolder ? "📂 Folder" : "📦 ZIP";
    setStatus(
      [
        `✅ Export complete! (${method})`,
        ``,
        `📝 Transcript: ${turns.length} turns`,
        `📄 Artifacts: ${allArtifactFiles.length} files (extracted from React state)`,
        `🖼️ Images: ${allImages.length}`,
        `📎 Uploaded files referenced: ${manifest.uploadedFiles.length}`,
      ].join("\n"),
    );

    await sleep(8000);
  } catch (err) {
    console.error("Export failed:", err);
    setStatus("❌ " + err.message + "\n\nCheck console for details.");
    await sleep(10000);
  } finally {
    overlay.remove();
  }
})();
