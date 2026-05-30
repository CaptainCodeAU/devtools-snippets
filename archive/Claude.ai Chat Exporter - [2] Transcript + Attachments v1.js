// =============================================================================
// Claude.ai Chat Exporter — Markdown Transcript + Attachments
// =============================================================================
// Run on any https://claude.ai/chat/<id> page.
//
// Strategy:
//   1. Tries File System Access API → writes everything to a named folder
//   2. Falls back to JSZip → downloads a single .zip file
//
// Exports:
//   - Full conversation as structured Markdown
//   - All artifact files (clicked from Download buttons)
//   - Any images found in the chat
// =============================================================================

(async () => {
  "use strict";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── UI overlay ───────────────────────────────────────────────────────
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
    minWidth: "360px",
    border: "1px solid #333",
    lineHeight: "1.6",
    whiteSpace: "pre-line",
  });
  const setStatus = (msg) => {
    overlay.textContent = msg;
    console.log(msg);
  };
  setStatus("📦 Exporting chat transcript...");
  document.body.appendChild(overlay);

  // ── Detect storage strategy ──────────────────────────────────────────
  let folderHandle = null;
  let useFolder = false;
  let zip = null;

  try {
    if (window.showDirectoryPicker) {
      setStatus("📂 Pick a parent folder for the export...");
      const parentHandle = await window.showDirectoryPicker({
        mode: "readwrite",
      });
      const chatTitle =
        document.title.replace(/ - Claude$/, "").trim() || "Untitled_Chat";
      const safeFolderName = chatTitle
        .replace(/[^a-zA-Z0-9 _-]/g, "_")
        .substring(0, 80);
      folderHandle = await parentHandle.getDirectoryHandle(safeFolderName, {
        create: true,
      });
      useFolder = true;
      setStatus(`📂 Writing to folder: ${safeFolderName}/`);
    }
  } catch (e) {
    if (e.name === "AbortError") {
      // User cancelled the picker — fall back to ZIP
      console.log("Folder picker cancelled, falling back to ZIP.");
    } else {
      console.warn("File System Access API unavailable or failed:", e.message);
    }
    useFolder = false;
  }

  if (!useFolder) {
    setStatus("📦 Loading JSZip library...");
    // Dynamically load JSZip
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load JSZip"));
      document.head.appendChild(s);
    });
    zip = new JSZip();
    setStatus("📦 Preparing ZIP export...");
  }

  // ── Write helpers ────────────────────────────────────────────────────
  const writeTextFile = async (filename, content) => {
    if (useFolder) {
      const fh = await folderHandle.getFileHandle(filename, {
        create: true,
      });
      const writable = await fh.createWritable();
      await writable.write(content);
      await writable.close();
    } else {
      zip.file(filename, content);
    }
  };

  const writeBlobFile = async (filename, blob) => {
    if (useFolder) {
      const fh = await folderHandle.getFileHandle(filename, {
        create: true,
      });
      const writable = await fh.createWritable();
      await writable.write(blob);
      await writable.close();
    } else {
      zip.file(filename, blob);
    }
  };

  const finalizeDownload = async (zipFilename) => {
    if (!useFolder && zip) {
      setStatus("📦 Generating ZIP file...");
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = zipFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  try {
    // ── Gather page metadata ───────────────────────────────────────────
    const chatTitle =
      document.title.replace(/ - Claude$/, "").trim() || "Untitled Chat";
    const chatUrl = window.location.href;
    const chatId = chatUrl.match(/\/chat\/([a-f0-9-]+)/)?.[1] || "unknown";
    const exportTime = new Date().toISOString();
    const safeTitle = chatTitle
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .substring(0, 60);

    // ── Find all turn wrappers ─────────────────────────────────────────
    const scrollContainer = document.querySelector(
      '[data-autoscroll-container="true"]',
    );
    const allTurns = scrollContainer
      ? Array.from(
          scrollContainer.querySelectorAll("div[data-test-render-count]"),
        )
      : [];

    setStatus(`📦 Found ${allTurns.length} turns. Processing...`);

    // ── nodeToMd: convert DOM → Markdown ───────────────────────────────
    const nodeToMd = (node, depth = 0) => {
      if (!node) return "";
      if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
      if (node.nodeType !== Node.ELEMENT_NODE) return "";

      const tag = node.tagName.toLowerCase();
      const cls = typeof node.className === "string" ? node.className : "";

      // Skip non-content elements
      if (
        tag === "svg" ||
        tag === "button" ||
        tag === "iframe" ||
        tag === "canvas"
      )
        return "";
      if (
        node.getAttribute("role") === "group" &&
        node.getAttribute("aria-label")?.includes("Message actions")
      )
        return "";
      if (cls.includes("sr-only")) return "";
      // Skip artifact block cells (handled separately)
      if (cls.includes("artifact-block-cell")) return "";
      // Skip file thumbnails (handled separately)
      if (node.getAttribute("data-testid") === "file-thumbnail") return "";
      // Skip the file wrapper area in user turns
      if (
        cls.includes("gap-2") &&
        cls.includes("flex-wrap") &&
        cls.includes("justify-end") &&
        node.querySelector('[data-testid="file-thumbnail"]')
      )
        return "";

      // Code blocks
      if (tag === "pre") {
        const codeEl = node.querySelector("code");
        const raw = codeEl ? codeEl.textContent : node.textContent;
        const langClass = (codeEl?.className || "").match(/language-(\w+)/);
        // Check for language label in header
        const headerEl = node
          .closest('[class*="code-block"]')
          ?.querySelector('[class*="header"] span');
        const lang = langClass?.[1] || headerEl?.textContent?.trim() || "";
        return "\n```" + lang + "\n" + raw.trim() + "\n```\n";
      }

      if (tag === "code") return "`" + (node.textContent || "") + "`";
      if (tag === "strong" || tag === "b") {
        return "**" + childrenToMd(node, depth) + "**";
      }
      if (tag === "em" || tag === "i") {
        return "*" + childrenToMd(node, depth) + "*";
      }
      if (tag === "a") {
        const href = node.getAttribute("href") || "";
        const text = node.textContent || href;
        return "[" + text + "](" + href + ")";
      }
      if (tag === "img") {
        const alt = node.getAttribute("alt") || "image";
        const src = node.getAttribute("src") || "";
        return "![" + alt + "](" + src + ")";
      }
      if (/^h[1-6]$/.test(tag)) {
        const level = parseInt(tag[1]);
        // Bump heading levels to avoid clashing with our ## User / ## Claude
        const adjusted = Math.min(level + 2, 6);
        return (
          "\n" +
          "#".repeat(adjusted) +
          " " +
          childrenToMd(node, depth).trim() +
          "\n"
        );
      }
      if (tag === "ol" || tag === "ul") {
        const items = Array.from(node.children).filter(
          (c) => c.tagName?.toLowerCase() === "li",
        );
        return (
          "\n" +
          items
            .map((li, i) => {
              const prefix = tag === "ol" ? `${i + 1}. ` : "- ";
              const content = childrenToMd(li, depth + 1).trim();
              // Handle nested lists — indent continuation lines
              const lines = content.split("\n");
              const indented = lines.map((l, li2) =>
                li2 === 0 ? l : "  ".repeat(depth + 1) + l,
              );
              return prefix + indented.join("\n");
            })
            .join("\n") +
          "\n"
        );
      }
      if (tag === "p") return "\n" + childrenToMd(node, depth).trim() + "\n";
      if (tag === "blockquote") {
        const inner = childrenToMd(node, depth).trim();
        return (
          "\n" +
          inner
            .split("\n")
            .map((l) => "> " + l)
            .join("\n") +
          "\n"
        );
      }
      if (tag === "br") return "\n";
      if (tag === "hr") return "\n---\n";

      // Tables
      if (tag === "table") {
        const rows = Array.from(node.querySelectorAll("tr"));
        if (rows.length === 0) return "";
        const toRow = (tr) =>
          Array.from(tr.querySelectorAll("th, td")).map((c) =>
            c.textContent.trim(),
          );
        const allRows = rows.map(toRow);
        const maxCols = Math.max(...allRows.map((r) => r.length));
        const pad = (r) => {
          while (r.length < maxCols) r.push("");
          return r;
        };
        const header = pad(allRows[0]);
        const sep = header.map(() => "---");
        const body = allRows.slice(1).map(pad);
        const fmt = (r) => "| " + r.join(" | ") + " |";
        return (
          "\n" +
          fmt(header) +
          "\n" +
          fmt(sep) +
          "\n" +
          body.map(fmt).join("\n") +
          "\n"
        );
      }

      return childrenToMd(node, depth);
    };

    const childrenToMd = (node, depth) =>
      Array.from(node.childNodes)
        .map((c) => nodeToMd(c, depth))
        .join("");

    // ── cleanMd ────────────────────────────────────────────────────────
    const cleanMd = (text) =>
      text
        .replace(/\n{3,}/g, "\n\n")
        .split("\n")
        .map((l) => l.trimEnd())
        .join("\n")
        .trim();

    // ── extractToolLabel ───────────────────────────────────────────────
    const extractToolLabel = (block) => {
      const btn = block.querySelector("button span.truncate");
      return btn?.textContent?.trim() || null;
    };

    // ── extractArtifactInfo ────────────────────────────────────────────
    const extractArtifactInfo = (block) => {
      const parent = block.closest('[role="button"][aria-label]');
      if (parent) {
        const title = (parent.getAttribute("aria-label") || "").replace(
          /^Open artifact:\s*/,
          "",
        );
        const typeEl = block.querySelector(".text-text-400");
        return { title, type: typeEl?.textContent?.trim() || "" };
      }
      const titleEl = block.querySelector(".line-clamp-1");
      const typeEl = block.querySelector(".text-text-400");
      return {
        title: titleEl?.textContent?.trim() || "Untitled artifact",
        type: typeEl?.textContent?.trim() || "",
      };
    };

    // ── extractFiles ───────────────────────────────────────────────────
    const extractFiles = (turnEl) => {
      const thumbnails = turnEl.querySelectorAll(
        '[data-testid="file-thumbnail"]',
      );
      return Array.from(thumbnails).map((ft) => {
        const btn = ft.querySelector("button[aria-label]");
        const label = btn?.getAttribute("aria-label") || "";
        const parts = label.split(",").map((s) => s.trim());
        return {
          filename:
            parts[0] ||
            ft.querySelector("h3")?.textContent?.trim() ||
            "unknown",
          ext: parts[1] || "",
          size: parts[2] || "",
        };
      });
    };

    // ── extractTimestamp ────────────────────────────────────────────────
    const extractTimestamp = (turnEl) => {
      const span = turnEl.querySelector("span.text-text-500.text-xs");
      return span?.textContent?.trim() || null;
    };

    // ── Build the markdown ─────────────────────────────────────────────
    const md = [];
    let turnNum = 0;
    let artifactCount = 0;
    const artifactList = [];

    md.push(`# ${chatTitle}`);
    md.push("");
    md.push(`> **Exported from:** ${chatUrl}`);
    md.push(`> **Export time:** ${exportTime}`);
    md.push(`> **Total turns:** ${allTurns.length}`);
    md.push("");
    md.push("---");
    md.push("");

    for (const turn of allTurns) {
      turnNum++;
      const hasUserMsg = !!turn.querySelector('[data-testid="user-message"]');
      const hasResponse = !!turn.querySelector(".font-claude-response");

      if (hasUserMsg) {
        const timestamp = extractTimestamp(turn);
        const files = extractFiles(turn);
        const userMsgEl = turn.querySelector('[data-testid="user-message"]');

        md.push(`## 👤 User${timestamp ? " — " + timestamp : ""}`);
        md.push("");

        if (files.length > 0) {
          md.push("**Attached files:**");
          for (const f of files) {
            md.push(
              `- 📎 \`${f.filename}\`${f.size ? " (" + f.size + ")" : ""}`,
            );
          }
          md.push("");
        }

        const imgs = turn.querySelectorAll('img[src*="/files/"]');
        if (imgs.length > 0) {
          for (const img of imgs) {
            const alt = img.getAttribute("alt") || "Uploaded image";
            const src = img.getAttribute("src") || "";
            const safeName = alt
              .replace(/[^a-zA-Z0-9_.-]/g, "_")
              .substring(0, 80);
            md.push(`![${alt}](images/${safeName})`);
            md.push("");
          }
        }

        if (userMsgEl) {
          md.push(cleanMd(nodeToMd(userMsgEl)));
        }
        md.push("");
      } else if (hasResponse) {
        md.push("## 🤖 Claude");
        md.push("");

        const responseEl = turn.querySelector(".font-claude-response");
        if (!responseEl) continue;

        for (const block of responseEl.children) {
          const toolLabel = extractToolLabel(block);
          const hasGridPattern =
            block.querySelector(".grid.grid-rows-\\[auto_auto\\]") ||
            block.classList.contains("grid");

          if (toolLabel && hasGridPattern) {
            md.push(`<details><summary>🔧 ${toolLabel}</summary>`);
            md.push("");
            const markdownEl = block.querySelector(".standard-markdown");
            if (markdownEl) md.push(cleanMd(nodeToMd(markdownEl)));
            md.push("");
            md.push("</details>");
            md.push("");

            const artifactCell = block.querySelector(".artifact-block-cell");
            if (artifactCell) {
              const info = extractArtifactInfo(artifactCell);
              artifactCount++;
              artifactList.push(info);
              md.push(
                `> 📄 **Artifact:** ${info.title}${info.type ? " (" + info.type + ")" : ""}`,
              );
              md.push("");
            }
            continue;
          }

          const artifactCell = block.querySelector(".artifact-block-cell");
          if (artifactCell) {
            const info = extractArtifactInfo(artifactCell);
            artifactCount++;
            artifactList.push(info);
            md.push(
              `> 📄 **Artifact:** ${info.title}${info.type ? " (" + info.type + ")" : ""}`,
            );
            md.push("");

            // Also check for markdown content alongside the artifact
            const markdownEl = block.querySelector(".standard-markdown");
            if (markdownEl) {
              const content = cleanMd(nodeToMd(markdownEl));
              if (content) md.push(content + "\n");
            }
            continue;
          }

          const markdownEl = block.querySelector(".standard-markdown") || block;
          const content = nodeToMd(markdownEl);
          if (content.trim()) md.push(cleanMd(content));
        }
        md.push("");
      }

      md.push("---");
      md.push("");

      if (turnNum % 10 === 0) {
        setStatus(`📦 Processed ${turnNum}/${allTurns.length} turns...`);
      }
    }

    // ── Artifact index ─────────────────────────────────────────────────
    if (artifactList.length > 0) {
      md.push("## 📑 Artifacts Index");
      md.push("");
      artifactList.forEach((a, i) => {
        md.push(`${i + 1}. **${a.title}**${a.type ? " — " + a.type : ""}`);
      });
      md.push("");
    }

    const finalMd = md.join("\n");

    // ── Write transcript ───────────────────────────────────────────────
    setStatus("📝 Writing transcript...");
    await writeTextFile("transcript.md", finalMd);

    // ── Download & write images ────────────────────────────────────────
    const chatImages = document.querySelectorAll('img[src*="/files/"]');
    if (chatImages.length > 0) {
      setStatus(`🖼️ Downloading ${chatImages.length} image(s)...`);
      // Create images subfolder if using FS API
      let imgFolder = folderHandle;
      if (useFolder) {
        imgFolder = await folderHandle.getDirectoryHandle("images", {
          create: true,
        });
      }
      for (const img of chatImages) {
        try {
          const src = img.getAttribute("src");
          const alt = img.getAttribute("alt") || "image";
          const safeName = alt
            .replace(/[^a-zA-Z0-9_.-]/g, "_")
            .substring(0, 80);
          const resp = await fetch(src);
          const blob = await resp.blob();
          const ext = blob.type.includes("png")
            ? ".png"
            : blob.type.includes("gif")
              ? ".gif"
              : ".jpg";
          const filename = safeName + ext;
          if (useFolder) {
            const fh = await imgFolder.getFileHandle(filename, {
              create: true,
            });
            const writable = await fh.createWritable();
            await writable.write(blob);
            await writable.close();
          } else {
            zip.file("images/" + filename, blob);
          }
          await sleep(200);
        } catch (e) {
          console.warn("Failed to download image:", e);
        }
      }
    }

    // ── Download artifacts ─────────────────────────────────────────────
    // Collect artifact download buttons
    const artifactDownloadBtns = document.querySelectorAll(
      '.artifact-block-cell button[aria-label^="Download"]',
    );
    const seenTitles = new Set();
    const uniqueBtns = [];
    artifactDownloadBtns.forEach((btn) => {
      const cell = btn.closest(".artifact-block-cell");
      const titleEl = cell?.querySelector(".line-clamp-1");
      const title = titleEl?.textContent?.trim() || "";
      if (!seenTitles.has(title)) {
        seenTitles.add(title);
        uniqueBtns.push({ btn, title });
      }
    });

    if (uniqueBtns.length > 0) {
      if (useFolder) {
        // With FS API: intercept downloads by monkeypatching <a>.click
        const artifactsFolder = await folderHandle.getDirectoryHandle(
          "artifacts",
          { create: true },
        );
        setStatus(`📥 Downloading ${uniqueBtns.length} artifacts to folder...`);

        // Intercept the download by overriding the anchor click mechanism
        const originalCreateElement = document.createElement.bind(document);
        const interceptedBlobs = [];

        // Strategy: override URL.createObjectURL temporarily to capture blobs
        const origCreateObjectURL = URL.createObjectURL.bind(URL);
        const capturedDownloads = [];
        let intercepting = false;

        URL.createObjectURL = function (blob) {
          const url = origCreateObjectURL(blob);
          if (intercepting) {
            capturedDownloads.push({ blob, url });
          }
          return url;
        };

        // Also intercept anchor clicks
        const origAnchorClick = HTMLAnchorElement.prototype.click;
        let lastDownloadName = "";
        HTMLAnchorElement.prototype.click = function () {
          if (intercepting && this.download) {
            lastDownloadName = this.download;
            // Don't actually trigger the download
            return;
          }
          return origAnchorClick.call(this);
        };

        for (let i = 0; i < uniqueBtns.length; i++) {
          const { btn, title } = uniqueBtns[i];
          setStatus(`📥 Artifact ${i + 1}/${uniqueBtns.length}: ${title}`);

          capturedDownloads.length = 0;
          lastDownloadName = "";
          intercepting = true;

          btn.click();
          await sleep(600);

          intercepting = false;

          if (capturedDownloads.length > 0 && lastDownloadName) {
            const { blob } = capturedDownloads[capturedDownloads.length - 1];
            const safeName = lastDownloadName.replace(/[^a-zA-Z0-9_.-]/g, "_");
            try {
              const fh = await artifactsFolder.getFileHandle(safeName, {
                create: true,
              });
              const writable = await fh.createWritable();
              await writable.write(blob);
              await writable.close();
            } catch (e) {
              console.warn(`Failed to write artifact "${safeName}":`, e);
            }
          } else {
            console.warn(`Could not intercept download for artifact: ${title}`);
          }

          // Clean up object URLs
          capturedDownloads.forEach((d) => URL.revokeObjectURL(d.url));
        }

        // Restore originals
        URL.createObjectURL = origCreateObjectURL;
        HTMLAnchorElement.prototype.click = origAnchorClick;
      } else {
        // ZIP mode: same interception strategy, but write to zip
        setStatus(`📥 Capturing ${uniqueBtns.length} artifacts for ZIP...`);

        const origCreateObjectURL = URL.createObjectURL.bind(URL);
        const capturedDownloads = [];
        let intercepting = false;

        URL.createObjectURL = function (blob) {
          const url = origCreateObjectURL(blob);
          if (intercepting) capturedDownloads.push({ blob, url });
          return url;
        };

        const origAnchorClick = HTMLAnchorElement.prototype.click;
        let lastDownloadName = "";
        HTMLAnchorElement.prototype.click = function () {
          if (intercepting && this.download) {
            lastDownloadName = this.download;
            return;
          }
          return origAnchorClick.call(this);
        };

        for (let i = 0; i < uniqueBtns.length; i++) {
          const { btn, title } = uniqueBtns[i];
          setStatus(`📥 Artifact ${i + 1}/${uniqueBtns.length}: ${title}`);

          capturedDownloads.length = 0;
          lastDownloadName = "";
          intercepting = true;

          btn.click();
          await sleep(600);

          intercepting = false;

          if (capturedDownloads.length > 0 && lastDownloadName) {
            const { blob } = capturedDownloads[capturedDownloads.length - 1];
            const safeName = lastDownloadName.replace(/[^a-zA-Z0-9_.-]/g, "_");
            zip.file("artifacts/" + safeName, blob);
          } else {
            console.warn(`Could not intercept artifact: ${title}`);
          }

          capturedDownloads.forEach((d) => URL.revokeObjectURL(d.url));
        }

        URL.createObjectURL = origCreateObjectURL;
        HTMLAnchorElement.prototype.click = origAnchorClick;
      }
    }

    // ── Finalize ───────────────────────────────────────────────────────
    await finalizeDownload(`${safeTitle}.zip`);

    const method = useFolder ? "📂 Folder" : "📦 ZIP";
    const summary = [
      `✅ Export complete! (${method})`,
      `📝 Transcript: ${allTurns.length} turns`,
      `📄 Artifacts: ${uniqueBtns.length} files`,
      `🖼️ Images: ${chatImages.length}`,
      `📎 Referenced uploads: ${document.querySelectorAll('[data-testid="file-thumbnail"]').length}`,
    ].join("\n");
    setStatus(summary);
    console.log(summary);

    await sleep(6000);
  } catch (err) {
    console.error("Export failed:", err);
    setStatus("❌ " + err.message + "\n\nCheck console for details.");
    await sleep(8000);
  } finally {
    overlay.remove();
  }
})();
