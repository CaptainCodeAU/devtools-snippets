// =============================================================================
// Claude.ai Chat Exporter v5 — Config UI + Enhanced Extraction
// =============================================================================
// Run on any https://claude.ai/chat/<id> page.
//
// Exports:
//   1. transcript.md        — full conversation in structured Markdown
//   2. artifacts/            — artifact files from fiber state + antArtifact regex
//   3. images/               — chat images fetched and saved
//   4. manifest.json         — machine-readable index of all exported content
//   5. conversation.api.json — API-compatible messages format (optional)
//   6. conversation.html     — self-contained HTML viewer (optional)
//
// Strategy:
//   1. Show config popup → user picks options → submit
//   2. Try File System Access API → folder, or JSZip → ZIP (configurable)
//   3. Artifact content from React fiber + antArtifact regex (complementary)
//   4. Model info from Claude internal API (best-effort)
//
// Config:
//   Edit the CONFIG object below to change persistent defaults.
//   The popup lets you override per-run without editing the file.
// =============================================================================

(async () => {
  "use strict";

  // ── Persistent Defaults (edit these for your preferences) ─────────────
  const CONFIG = {
    // Output Formats
    extractArtifacts: true,
    downloadImages: true,
    manifest: true,
    apiFormat: false,
    htmlOutput: true,
    // Processing
    stripSystemReminders: true,
    antArtifactRegex: true,
    imageConcurrency: 5,
    // Export Behavior
    skipPreviouslyExported: false,
    storageMethod: "auto", // "auto" | "folder" | "zip"
  };

  // ── DOM Selectors (update here when Claude changes their UI) ──────────
  const SELECTORS = {
    scrollContainer: '[data-autoscroll-container="true"]',
    turnWrapper: "div[data-test-render-count]",
    fileThumbnail: '[data-testid="file-thumbnail"]',
    artifactCell: ".artifact-block-cell",
    artifactTitle: ".line-clamp-1",
    artifactType: ".text-text-400",
    chatImage: 'img[src*="/files/"]',
    uiTimestamp: "span.text-text-500.text-xs",
  };

  // ── System Reminder Tags ─────────────────────────────────────────────
  const SYSTEM_REMINDER_TAGS = [
    "long_conversation_reminder",
    "userPreferences",
    "automated_reminder_from_anthropic",
    "system-reminder",
    "anthropic_reminder",
  ];
  const REMINDER_REGEXES = SYSTEM_REMINDER_TAGS.map(
    (tag) => new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, "gi"),
  );

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── Config Popup ──────────────────────────────────────────────────────
  function showConfigPopup(defaults) {
    return new Promise((resolve, reject) => {
      const cfg = structuredClone(defaults);

      const backdrop = document.createElement("div");
      Object.assign(backdrop.style, {
        position: "fixed",
        inset: "0",
        background: "rgba(0,0,0,0.5)",
        zIndex: "999998",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      });

      const modal = document.createElement("div");
      Object.assign(modal.style, {
        background: "#1a1a2e",
        color: "#e0e0e0",
        borderRadius: "12px",
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        width: "480px",
        maxHeight: "80vh",
        overflowY: "auto",
        padding: "24px",
        border: "1px solid #333",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        lineHeight: "1.6",
      });

      const title = document.createElement("h2");
      Object.assign(title.style, {
        margin: "0 0 16px 0",
        fontSize: "18px",
        color: "#8a8aff",
        borderBottom: "1px solid #333",
        paddingBottom: "12px",
      });
      title.textContent = "Claude Chat Exporter v5";
      modal.appendChild(title);

      // ── Control Builders ──────────────────────────────────────────────
      function createFieldset(legendText) {
        const fs = document.createElement("fieldset");
        Object.assign(fs.style, {
          border: "1px solid #444",
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "16px",
        });
        const legend = document.createElement("legend");
        Object.assign(legend.style, {
          color: "#8a8aff",
          fontWeight: "bold",
          padding: "0 8px",
          fontSize: "13px",
        });
        legend.textContent = legendText;
        fs.appendChild(legend);
        return fs;
      }

      function addCheckbox(parent, key, label, disabled = false) {
        const lbl = document.createElement("label");
        Object.assign(lbl.style, {
          display: "flex",
          alignItems: "center",
          gap: "8px",
          margin: "6px 0",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? "0.5" : "1",
        });
        const inp = document.createElement("input");
        inp.type = "checkbox";
        inp.checked = disabled ? true : cfg[key];
        inp.disabled = disabled;
        Object.assign(inp.style, { accentColor: "#4a6cf7" });
        if (!disabled) {
          inp.addEventListener("change", () => {
            cfg[key] = inp.checked;
          });
        }
        lbl.appendChild(inp);
        lbl.appendChild(document.createTextNode(label));
        parent.appendChild(lbl);
      }

      function addNumberInput(parent, key, label, min, max) {
        const row = document.createElement("div");
        Object.assign(row.style, {
          display: "flex",
          alignItems: "center",
          gap: "8px",
          margin: "6px 0",
        });
        const lbl = document.createElement("span");
        lbl.textContent = label;
        const inp = document.createElement("input");
        inp.type = "number";
        inp.value = cfg[key];
        inp.min = min;
        inp.max = max;
        Object.assign(inp.style, {
          width: "60px",
          background: "#111",
          color: "#e0e0e0",
          border: "1px solid #555",
          borderRadius: "4px",
          padding: "4px 8px",
          fontSize: "14px",
        });
        inp.addEventListener("change", () => {
          cfg[key] = Math.max(min, Math.min(max, parseInt(inp.value) || min));
          inp.value = cfg[key];
        });
        row.appendChild(lbl);
        row.appendChild(inp);
        parent.appendChild(row);
      }

      function addRadioGroup(parent, key, options) {
        for (const [value, label] of options) {
          const lbl = document.createElement("label");
          Object.assign(lbl.style, {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            margin: "6px 0",
            cursor: "pointer",
          });
          const inp = document.createElement("input");
          inp.type = "radio";
          inp.name = key;
          inp.value = value;
          inp.checked = cfg[key] === value;
          Object.assign(inp.style, { accentColor: "#4a6cf7" });
          inp.addEventListener("change", () => {
            if (inp.checked) cfg[key] = value;
          });
          lbl.appendChild(inp);
          lbl.appendChild(document.createTextNode(label));
          parent.appendChild(lbl);
        }
      }

      // ── Build Form ────────────────────────────────────────────────────
      const fsOutput = createFieldset("Output Formats");
      addCheckbox(fsOutput, "transcript", "Transcript (markdown)", true);
      addCheckbox(fsOutput, "extractArtifacts", "Artifacts extraction");
      addCheckbox(fsOutput, "downloadImages", "Images download");
      addCheckbox(fsOutput, "manifest", "Manifest (JSON)");
      addCheckbox(fsOutput, "apiFormat", "API-compatible format");
      addCheckbox(fsOutput, "htmlOutput", "HTML output");
      modal.appendChild(fsOutput);

      const fsProcessing = createFieldset("Processing");
      addCheckbox(
        fsProcessing,
        "stripSystemReminders",
        "Strip system reminders",
      );
      addCheckbox(
        fsProcessing,
        "antArtifactRegex",
        "antArtifact regex extraction",
      );
      addNumberInput(
        fsProcessing,
        "imageConcurrency",
        "Image concurrency:",
        1,
        20,
      );
      modal.appendChild(fsProcessing);

      const fsBehavior = createFieldset("Export Behavior");
      addCheckbox(
        fsBehavior,
        "skipPreviouslyExported",
        "Skip previously exported",
      );
      addRadioGroup(fsBehavior, "storageMethod", [
        ["auto", "Auto (folder → ZIP fallback)"],
        ["folder", "Force folder"],
        ["zip", "Force ZIP"],
      ]);
      modal.appendChild(fsBehavior);

      // ── Buttons ───────────────────────────────────────────────────────
      const btnRow = document.createElement("div");
      Object.assign(btnRow.style, {
        display: "flex",
        justifyContent: "flex-end",
        gap: "12px",
        marginTop: "20px",
        borderTop: "1px solid #333",
        paddingTop: "16px",
      });

      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Cancel";
      Object.assign(cancelBtn.style, {
        background: "transparent",
        border: "1px solid #555",
        color: "#e0e0e0",
        padding: "8px 20px",
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "14px",
      });

      const exportBtn = document.createElement("button");
      exportBtn.textContent = "Export";
      Object.assign(exportBtn.style, {
        background: "#4a6cf7",
        border: "none",
        color: "white",
        padding: "8px 24px",
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "bold",
      });

      const doExport = () => {
        backdrop.remove();
        document.removeEventListener("keydown", keyHandler);
        resolve(cfg);
      };
      const doCancel = () => {
        backdrop.remove();
        document.removeEventListener("keydown", keyHandler);
        reject(new Error("Cancelled"));
      };

      exportBtn.addEventListener("click", doExport);
      cancelBtn.addEventListener("click", doCancel);

      const keyHandler = (e) => {
        if (e.key === "Escape") doCancel();
        if (e.key === "Enter" && e.target.tagName !== "INPUT") doExport();
      };
      document.addEventListener("keydown", keyHandler);

      btnRow.appendChild(cancelBtn);
      btnRow.appendChild(exportBtn);
      modal.appendChild(btnRow);

      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);
      exportBtn.focus();
    });
  }

  // ── Helper Functions ──────────────────────────────────────────────────

  function stripReminders(text) {
    if (!text) return text;
    let out = text;
    for (const re of REMINDER_REGEXES) {
      re.lastIndex = 0;
      out = out.replace(re, "");
    }
    return out.trim();
  }

  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function markdownToHtml(md) {
    if (!md) return "";
    let html = escHtml(md);

    const codeBlocks = [];
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push(
        `<pre><code class="${lang ? "language-" + lang : ""}">${code.trim()}</code></pre>`,
      );
      return `%%CODEBLOCK_${idx}%%`;
    });

    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
      if (/^(https?:\/\/|\/)/i.test(url))
        return `<a href="${url}" target="_blank">${text}</a>`;
      return `${text} (${url})`;
    });
    html = html.replace(/^#{4}\s+(.+)$/gm, "<h5>$1</h5>");
    html = html.replace(/^#{3}\s+(.+)$/gm, "<h4>$1</h4>");
    html = html.replace(/^#{2}\s+(.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^#{1}\s+(.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^[-*]\s+(.+)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);

    html = html
      .split(/\n{2,}/)
      .map((p) => {
        const t = p.trim();
        if (!t) return "";
        if (
          t.startsWith("<h") ||
          t.startsWith("<pre") ||
          t.startsWith("<ul") ||
          t.startsWith("%%CODEBLOCK")
        )
          return t;
        return `<p>${t.replace(/\n/g, "<br>")}</p>`;
      })
      .join("\n");

    for (let i = 0; i < codeBlocks.length; i++) {
      html = html.replace(`%%CODEBLOCK_${i}%%`, codeBlocks[i]);
    }

    return html;
  }

  async function fetchConversationData(chatId) {
    try {
      const orgId = document.cookie.match(/lastActiveOrg=([^;]+)/)?.[1];
      if (!orgId || !chatId) return null;
      const resp = await fetch(
        `/api/organizations/${orgId}/chat_conversations/${chatId}?tree=true&rendering_mode=messages&render_all_tools=true`,
        {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        },
      );
      if (!resp.ok) {
        console.warn(`[v5] API fetch failed: ${resp.status}`);
        return null;
      }
      return await resp.json();
    } catch (e) {
      console.warn("[v5] API fetch error:", e.message);
      return null;
    }
  }

  function buildApiJson(turns, model) {
    const messages = turns
      .filter((t) => t.role === "user" || t.role === "assistant")
      .map((t) => ({
        role: t.role,
        content:
          t.text?.trim() ||
          t.content
            .filter((b) => b.type === "text" && b.text)
            .map((b) => b.text)
            .join("\n\n"),
      }))
      .filter((m) => m.content.trim());
    return JSON.stringify(
      { model: model || "unknown", max_tokens: 8096, messages },
      null,
      2,
    );
  }

  const resolveArtifactName = (input) =>
    input.file_name || input.filename || input.title || "artifact";

  function buildHtml(turns, chatTitle, chatUrl, exportTime, allArtifactFiles) {
    const lines = [];
    lines.push(`<!DOCTYPE html>`);
    lines.push(`<html lang="en"><head><meta charset="utf-8">`);
    lines.push(
      `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    );
    lines.push(`<title>${escHtml(chatTitle)}</title>`);
    lines.push(
      `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">`,
    );
    lines.push(
      `<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"><\/script>`,
    );
    lines.push(`<style>
  body { background:#1a1a2e; color:#e0e0e0; font-family:system-ui,sans-serif; max-width:900px; margin:0 auto; padding:24px; line-height:1.7; }
  h1 { color:#8a8aff; border-bottom:1px solid #333; padding-bottom:12px; }
  .turn { margin:24px 0; padding:16px 20px; border-radius:10px; border:1px solid #333; }
  .user { background:#1e2a3a; border-left:3px solid #4a9eff; }
  .assistant { background:#1a2e1a; border-left:3px solid #4aff7f; }
  .role { font-weight:bold; font-size:0.85em; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; }
  .user .role { color:#4a9eff; }
  .assistant .role { color:#4aff7f; }
  .timestamp { color:#888; font-size:0.8em; margin-left:12px; font-weight:normal; text-transform:none; letter-spacing:normal; }
  details { margin:8px 0; background:#111; border-radius:6px; padding:8px 12px; }
  summary { cursor:pointer; font-weight:bold; color:#c0c0ff; }
  .tool-use { border-left:2px solid #ff9f43; padding-left:12px; }
  .tool-result { border-left:2px solid #43ff9f; padding-left:12px; }
  pre { background:#0d1117; padding:16px; border-radius:8px; overflow-x:auto; }
  code { font-family:'Fira Code',monospace; font-size:0.9em; }
  p code { background:#2d2d3d; padding:2px 6px; border-radius:3px; }
  a { color:#6ea8fe; }
  img { max-width:100%; border-radius:8px; margin:8px 0; }
  .meta { color:#888; font-size:0.85em; border-bottom:1px solid #333; padding-bottom:12px; margin-bottom:24px; }
  .artifact-ref { background:#2a2a4a; border:1px solid #444; border-radius:6px; padding:8px 12px; margin:8px 0; font-size:0.9em; }
  ul { padding-left:24px; }
  li { margin:4px 0; }
</style></head><body>`);

    lines.push(`<h1>${escHtml(chatTitle)}</h1>`);
    lines.push(
      `<div class="meta">Source: <a href="${escHtml(chatUrl)}">${escHtml(chatUrl)}</a><br>Exported: ${escHtml(exportTime)}<br>Turns: ${turns.length}</div>`,
    );

    for (const turn of turns) {
      const cls = turn.role === "user" ? "user" : "assistant";
      const icon = turn.role === "user" ? "User" : "Claude";
      const ts = turn.timestamp || turn.uiTimestamp || "";
      lines.push(`<div class="turn ${cls}">`);
      lines.push(
        `<div class="role">${escHtml(icon)}<span class="timestamp">${escHtml(ts)}</span></div>`,
      );

      if (turn.role === "user") {
        if (turn.files && turn.files.length > 0) {
          lines.push(`<p><strong>Attached files:</strong></p><ul>`);
          turn.files.forEach((f) => {
            lines.push(
              `<li>${escHtml(f.filename)}${f.size ? " (" + escHtml(f.size) + ")" : ""}</li>`,
            );
          });
          lines.push(`</ul>`);
        }
        for (const img of turn.images || []) {
          lines.push(
            `<img src="images/${escHtml(img.safeName)}${img.ext || ".jpg"}" alt="${escHtml(img.alt)}">`,
          );
        }
        const text =
          turn.text ||
          turn.content
            .filter((b) => b.type === "text" && b.text)
            .map((b) => b.text)
            .join("\n\n");
        if (text?.trim())
          lines.push(`<div>${markdownToHtml(text.trim())}</div>`);
      } else {
        for (const block of turn.content) {
          switch (block.type) {
            case "text":
              if (block.text?.trim())
                lines.push(`<div>${markdownToHtml(block.text.trim())}</div>`);
              break;
            case "thinking":
              lines.push(
                `<details><summary>Thinking</summary><pre>${escHtml(block.thinking || "")}</pre></details>`,
              );
              break;
            case "tool_use":
              lines.push(
                `<details class="tool-use"><summary>${escHtml(block.name || "Tool use")}</summary>`,
              );
              if (block.input) {
                const ft = block.input.file_text || block.input.content;
                if (ft) {
                  lines.push(
                    `<p>Artifact: <code>${escHtml(resolveArtifactName(block.input))}</code></p>`,
                  );
                } else {
                  const s =
                    typeof block.input === "string"
                      ? block.input
                      : JSON.stringify(block.input, null, 2);
                  lines.push(`<pre><code>${escHtml(s)}</code></pre>`);
                }
              }
              lines.push(`</details>`);
              break;
            case "tool_result":
              lines.push(
                `<details class="tool-result"><summary>${escHtml(block.name || "Result")}</summary>`,
              );
              {
                let hasContent = false;
                if (block.display_content) {
                  lines.push(
                    `<div>${markdownToHtml(block.display_content)}</div>`,
                  );
                  hasContent = true;
                }
                if (Array.isArray(block.content)) {
                  block.content.forEach((item) => {
                    if (item.type === "text" && item.text) {
                      lines.push(`<pre>${escHtml(item.text)}</pre>`);
                      hasContent = true;
                    } else if (typeof item === "string") {
                      lines.push(`<pre>${escHtml(item)}</pre>`);
                      hasContent = true;
                    } else if (item.title || item.url) {
                      if (item.title)
                        lines.push(
                          `<p><strong>${escHtml(item.title)}</strong></p>`,
                        );
                      if (item.url)
                        lines.push(
                          `<p>URL: <a href="${escHtml(item.url)}">${escHtml(item.url)}</a></p>`,
                        );
                      hasContent = true;
                    }
                  });
                } else if (typeof block.content === "string") {
                  lines.push(`<pre>${escHtml(block.content)}</pre>`);
                  hasContent = true;
                }
                if (!hasContent && block.text) {
                  lines.push(`<pre>${escHtml(block.text)}</pre>`);
                  hasContent = true;
                }
                if (!hasContent) {
                  const raw = block.content || block.input;
                  if (raw && typeof raw === "object") {
                    const s = JSON.stringify(raw, null, 2);
                    if (s.length > 2)
                      lines.push(`<pre><code>${escHtml(s)}</code></pre>`);
                  }
                }
              }
              lines.push(`</details>`);
              break;
            default:
              if (block.text?.trim())
                lines.push(`<div>${markdownToHtml(block.text.trim())}</div>`);
              if (block.message)
                lines.push(`<p><em>${escHtml(block.message)}</em></p>`);
              break;
          }
        }

        for (const art of turn.artifacts || []) {
          lines.push(`<div class="artifact-ref">`);
          lines.push(
            `<strong>${escHtml(art.title)}</strong>${art.type ? " <em>(" + escHtml(art.type) + ")</em>" : ""}`,
          );
          if (art.filename)
            lines.push(
              ` &mdash; <code>artifacts/${escHtml(art.filename)}</code>`,
            );
          lines.push(`</div>`);
        }
      }
      lines.push(`</div>`);
    }

    lines.push(`<script>hljs.highlightAll();<\/script>`);
    lines.push(`</body></html>`);
    return lines.join("\n");
  }

  // ── Main Flow ─────────────────────────────────────────────────────────

  let cfg;
  try {
    cfg = await showConfigPopup(CONFIG);
  } catch (e) {
    console.log("[v5] Export cancelled by user");
    return;
  }

  console.log("[v5] Config:", JSON.stringify(cfg, null, 2));

  // ── Page info (hoisted for use across resume check, storage, and export) ──
  const chatUrl = window.location.href;
  const chatId = chatUrl.match(/\/chat\/([a-f0-9-]+)/)?.[1] || "unknown";
  const chatTitle =
    document.title.replace(/ - Claude$/, "").trim() || "Untitled Chat";
  const safeTitle = chatTitle.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 60);

  if (cfg.skipPreviouslyExported && chatId !== "unknown") {
    const history = JSON.parse(
      localStorage.getItem("claude_export_history") || "{}",
    );
    if (history[chatId]) {
      const prev = history[chatId].exportedAt;
      const skipConfirmed = await new Promise((resolve) => {
        const banner = document.createElement("div");
        Object.assign(banner.style, {
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
        });
        banner.textContent = `This chat was exported on ${new Date(prev).toLocaleString()}. Export again?`;

        const btnRow = document.createElement("div");
        Object.assign(btnRow.style, {
          display: "flex",
          gap: "12px",
          marginTop: "12px",
          justifyContent: "flex-end",
        });
        const yesBtn = document.createElement("button");
        yesBtn.textContent = "Yes, export again";
        Object.assign(yesBtn.style, {
          background: "#4a6cf7",
          border: "none",
          color: "white",
          padding: "6px 16px",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "13px",
        });
        const noBtn = document.createElement("button");
        noBtn.textContent = "Skip";
        Object.assign(noBtn.style, {
          background: "transparent",
          border: "1px solid #555",
          color: "#e0e0e0",
          padding: "6px 16px",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "13px",
        });
        yesBtn.addEventListener("click", () => {
          banner.remove();
          resolve(false);
        });
        noBtn.addEventListener("click", () => {
          banner.remove();
          resolve(true);
        });
        btnRow.appendChild(noBtn);
        btnRow.appendChild(yesBtn);
        banner.appendChild(btnRow);
        document.body.appendChild(banner);
      });
      if (skipConfirmed) {
        console.log("[v5] Skipped — previously exported");
        return;
      }
    }
  }

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
    if (cfg.storageMethod === "auto" || cfg.storageMethod === "folder") {
      try {
        if (window.showDirectoryPicker) {
          setStatus("📂 Pick a parent folder for the export...");
          const parentHandle = await window.showDirectoryPicker({
            mode: "readwrite",
          });
          const safeName = chatTitle
            .replace(/[^a-zA-Z0-9 _-]/g, "_")
            .substring(0, 80);
          folderHandle = await parentHandle.getDirectoryHandle(safeName, {
            create: true,
          });
          useFolder = true;
          setStatus(`📂 Writing to: ${safeName}/`);
        } else if (cfg.storageMethod === "folder") {
          throw new Error(
            "File System Access API not available in this browser",
          );
        }
      } catch (e) {
        if (cfg.storageMethod === "folder") throw e;
        if (e.name !== "AbortError")
          console.warn("[v5] FS API failed:", e.message);
      }
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
      `[v5] Storage: ${useFolder ? "File System Access API (folder)" : "JSZip (ZIP download)"}`,
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

    // ── Fetch API data (best-effort) ──────────────────────────────────
    setStatus("🔍 Fetching conversation metadata...");
    const conversationData = await fetchConversationData(chatId);
    const apiModel = conversationData?.model || null;
    console.log(
      `[v5] API fetch: ${conversationData ? "success" : "failed/skipped"}, model: ${apiModel || "unknown"}`,
    );

    // ── React fiber helpers ──────────────────────────────────────────
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

    const findPropUp = (fiber, name, maxD = 50) => {
      let c = fiber,
        d = 0;
      while (c && d < maxD) {
        if (c.memoizedProps?.[name] !== undefined) return c.memoizedProps[name];
        c = c.return;
        d++;
      }
    };

    const findPropDown = (fiber, name, maxD = 30) => {
      const queue = [{ f: fiber, d: 0 }];
      let qi = 0;
      while (qi < queue.length) {
        const { f, d } = queue[qi++];
        if (!f || d > maxD) continue;
        if (f.memoizedProps?.[name] !== undefined) return f.memoizedProps[name];
        if (f.child) queue.push({ f: f.child, d: d + 1 });
        if (f.sibling && d > 0) queue.push({ f: f.sibling, d });
      }
    };

    // ── Page metadata ──────────────────────────────────────────────────
    const exportTime = new Date().toISOString();

    console.log(`[v5] Chat: "${chatTitle}" | ID: ${chatId} | URL: ${chatUrl}`);

    // ── Extract turns from React fiber ─────────────────────────────────
    setStatus("🔍 Extracting conversation data...");

    const scrollContainer = document.querySelector(SELECTORS.scrollContainer);
    const turnEls = scrollContainer
      ? Array.from(scrollContainer.querySelectorAll(SELECTORS.turnWrapper))
      : [];

    const turns = [];
    const artifactFileMap = new Map();
    const allImages = [];
    let skippedNoFiber = 0;
    let skippedNoMessage = 0;

    console.log(
      `[v5] scrollContainer: ${!!scrollContainer}, turnEls: ${turnEls.length}`,
    );

    for (const el of turnEls) {
      const fiber = getFiber(el);
      if (!fiber) {
        skippedNoFiber++;
        console.log(
          `[v5] Turn skipped — no fiber on element`,
          el.className?.substring(0, 60),
        );
        continue;
      }

      const message = findPropDown(fiber, "message", 30);
      if (!message) {
        skippedNoMessage++;
        console.log(`[v5] Turn skipped — no message prop in fiber subtree`);
        continue;
      }

      // Files
      const files = [];
      el.querySelectorAll(SELECTORS.fileThumbnail).forEach((ft) => {
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

      // Images
      const turnImages = [];
      el.querySelectorAll(SELECTORS.chatImage).forEach((img) => {
        const alt = img.getAttribute("alt") || "image";
        const src = img.getAttribute("src") || "";
        const safeName = alt.replace(/[^a-zA-Z0-9_.-]/g, "_").substring(0, 80);
        turnImages.push({ alt, src, safeName });
        allImages.push({ alt, src, safeName });
      });

      // Artifacts — DOM metadata + fiber content
      const artifacts = [];
      const artifactCells = el.querySelectorAll(SELECTORS.artifactCell);
      artifactCells.forEach((cell) => {
        const title =
          cell.querySelector(SELECTORS.artifactTitle)?.textContent?.trim() ||
          "Untitled";
        const type =
          cell.querySelector(SELECTORS.artifactType)?.textContent?.trim() || "";
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
      if (cfg.extractArtifacts) {
        for (const block of contentBlocks) {
          if (block.type !== "tool_use" || !block.input) continue;
          const fileText = block.input.file_text || block.input.content;
          if (!fileText) continue;

          const resolved = resolveArtifactName(block.input);
          const fileName =
            resolved !== "artifact"
              ? resolved
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
      }

      const ts = message.created_at
        ? new Date(message.created_at).toLocaleString("en-AU", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : null;
      const uiTs =
        el.querySelector(SELECTORS.uiTimestamp)?.textContent?.trim() || null;

      const ROLE_MAP = { human: "user", assistant: "assistant" };
      const role = ROLE_MAP[message.sender] || message.sender;

      console.log(
        `[v5] Turn ${turns.length + 1}: ${role} | ` +
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

    // ── Post-extraction: Strip system reminders ────────────────────────
    if (cfg.stripSystemReminders) {
      let stripped = 0;
      for (const turn of turns) {
        if (turn.role !== "user") continue;
        const before = turn.text;
        turn.text = stripReminders(turn.text);
        for (const block of turn.content) {
          if (block.type === "text" && block.text) {
            block.text = stripReminders(block.text);
          }
        }
        if (turn.text !== before) stripped++;
      }
      console.log(
        `[v5] Stripped system reminders from ${stripped} user turn(s)`,
      );
    }

    // ── Post-extraction: antArtifact regex ─────────────────────────────
    if (cfg.antArtifactRegex && cfg.extractArtifacts) {
      const ARTIFACT_RE = /<antArtifact\s+([^>]*?)>([\s\S]*?)<\/antArtifact>/gi;
      const ATTR_RE = /(\w+)="([^"]*)"/g;
      const EXT_MAP = {
        "application/vnd.ant.code": null,
        "application/vnd.ant.react": "jsx",
        "application/vnd.ant.html": "html",
        "application/vnd.ant.mermaid": "mermaid",
        "application/vnd.ant.svg": "svg",
        "image/svg+xml": "svg",
        "text/html": "html",
        "text/markdown": "md",
      };
      const LANG_EXT = {
        python: "py",
        javascript: "js",
        typescript: "ts",
        ruby: "rb",
        rust: "rs",
        golang: "go",
        go: "go",
        java: "java",
        cpp: "cpp",
        "c++": "cpp",
        csharp: "cs",
        "c#": "cs",
        swift: "swift",
        kotlin: "kt",
        php: "php",
        shell: "sh",
        bash: "sh",
        sql: "sql",
        css: "css",
        scss: "scss",
        yaml: "yaml",
        json: "json",
        xml: "xml",
        toml: "toml",
      };

      let regexCount = 0;
      for (const turn of turns) {
        if (turn.role !== "assistant") continue;
        for (const block of turn.content) {
          if (block.type !== "text" || !block.text) continue;
          ARTIFACT_RE.lastIndex = 0;
          let m;
          while ((m = ARTIFACT_RE.exec(block.text)) !== null) {
            const attrs = {};
            let am;
            ATTR_RE.lastIndex = 0;
            while ((am = ATTR_RE.exec(m[1])) !== null) attrs[am[1]] = am[2];

            const identifier =
              attrs.identifier || `regex_artifact_${regexCount + 1}`;
            const type = attrs.type || "text/plain";
            const lang = attrs.language || "";
            const mappedExt = EXT_MAP[type];
            const ext =
              mappedExt === null
                ? LANG_EXT[lang.toLowerCase()] || lang || "txt"
                : mappedExt || "txt";

            const safeFileName = (identifier + "." + ext)
              .replace(/[^a-zA-Z0-9_.-]/g, "_")
              .substring(0, 120);

            if (!artifactFileMap.has(safeFileName)) {
              artifactFileMap.set(safeFileName, {
                title: attrs.title || identifier,
                fileName: identifier + "." + ext,
                safeFileName,
                content: m[2],
                toolName: "antArtifact-regex",
              });
              regexCount++;
            }
          }
        }
      }
      console.log(`[v5] Regex extracted ${regexCount} additional artifact(s)`);
    }

    const allArtifactFiles = Array.from(artifactFileMap.values());

    console.log(
      `[v5] Extraction complete:\n` +
        `  Turns: ${turns.length} (${turns.filter((t) => t.role === "user").length} user, ${turns.filter((t) => t.role === "assistant").length} assistant)\n` +
        `  Skipped: ${skippedNoFiber} no-fiber, ${skippedNoMessage} no-message\n` +
        `  Artifacts: ${allArtifactFiles.length} files (${allArtifactFiles.reduce((s, a) => s + a.content.length, 0)} chars total)\n` +
        `  Images: ${allImages.length}\n` +
        `  Uploaded files: ${turns.reduce((s, t) => s + t.files.length, 0)}`,
    );

    setStatus(`📦 ${turns.length} turns extracted. Building outputs...`);

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
          `## 👤 User${t.timestamp ? " — " + t.timestamp : t.uiTimestamp ? " — " + t.uiTimestamp : ""}\n`,
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
          md.push(
            `![${img.alt}](images/${img.safeName}${img.ext || ".jpg"})\n`,
          );
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

            case "tool_result": {
              md.push(
                `<details><summary>📋 ${block.message || block.name || "Result"}</summary>\n`,
              );
              let mdHasContent = false;
              if (block.display_content) {
                md.push(block.display_content + "\n");
                mdHasContent = true;
              }
              if (Array.isArray(block.content)) {
                block.content.forEach((item) => {
                  if (item.type === "text" && item.text) {
                    md.push("```\n" + item.text + "\n```\n");
                    mdHasContent = true;
                  } else if (typeof item === "string") {
                    md.push("```\n" + item + "\n```\n");
                    mdHasContent = true;
                  } else if (item.title || item.url) {
                    if (item.title) md.push(`**${item.title}**`);
                    if (item.url) md.push(`URL: ${item.url}`);
                    md.push("");
                    mdHasContent = true;
                  }
                });
              } else if (typeof block.content === "string") {
                md.push("```\n" + block.content + "\n```\n");
                mdHasContent = true;
              }
              if (!mdHasContent && block.text) {
                md.push("```\n" + block.text + "\n```\n");
                mdHasContent = true;
              }
              if (!mdHasContent) {
                const raw = block.content || block.input;
                if (raw && typeof raw === "object") {
                  const s = JSON.stringify(raw, null, 2);
                  if (s.length > 2) md.push("```json\n" + s + "\n```\n");
                }
              }
              md.push("</details>\n");
              break;
            }

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
    const outputsList = ["transcript.md"];
    if (cfg.manifest) outputsList.push("manifest.json");
    if (cfg.extractArtifacts && allArtifactFiles.length > 0)
      outputsList.push(
        ...allArtifactFiles.map((a) => "artifacts/" + a.safeFileName),
      );
    if (cfg.downloadImages && allImages.length > 0)
      outputsList.push(...allImages.map((img) => "images/" + img.safeName));
    if (cfg.apiFormat) outputsList.push("conversation.api.json");
    if (cfg.htmlOutput) outputsList.push("conversation.html");

    const manifest = {
      chatTitle,
      chatUrl,
      chatId,
      exportTime,
      exporterVersion: "v5",
      model: apiModel || "unknown",
      config: {
        extractArtifacts: cfg.extractArtifacts,
        downloadImages: cfg.downloadImages,
        apiFormat: cfg.apiFormat,
        htmlOutput: cfg.htmlOutput,
        stripSystemReminders: cfg.stripSystemReminders,
        antArtifactRegex: cfg.antArtifactRegex,
        storageMethod: useFolder ? "folder" : "zip",
      },
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
      outputs: outputsList,
    };

    // ── Write transcript + manifest ────────────────────────────────────
    setStatus("📝 Writing transcript...");
    await writeFile("transcript.md", finalMd);
    console.log(`[v5] transcript.md written (${finalMd.length} chars)`);

    if (cfg.manifest) {
      await writeFile("manifest.json", JSON.stringify(manifest, null, 2));
      console.log(`[v5] manifest.json written`);
    }

    // ── Write artifact files ───────────────────────────────────────────
    if (cfg.extractArtifacts && allArtifactFiles.length > 0) {
      setStatus(`📄 Writing ${allArtifactFiles.length} artifact(s)...`);
      for (let i = 0; i < allArtifactFiles.length; i++) {
        const art = allArtifactFiles[i];
        setStatus(
          `📄 Artifact ${i + 1}/${allArtifactFiles.length}: ${art.title}`,
        );
        await writeFile("artifacts/" + art.safeFileName, art.content);
        console.log(
          `[v5] Artifact written: ${art.safeFileName} (${art.content.length} chars, tool: ${art.toolName})`,
        );
      }
    }

    // ── Download images ────────────────────────────────────────────────
    if (cfg.downloadImages && allImages.length > 0) {
      setStatus(`🖼️ Downloading ${allImages.length} image(s)...`);
      const concurrency = cfg.imageConcurrency;
      for (let i = 0; i < allImages.length; i += concurrency) {
        const batch = allImages.slice(i, i + concurrency);
        await Promise.all(
          batch.map(async (img) => {
            try {
              const resp = await fetch(img.src, { credentials: "include" });
              if (!resp.ok) {
                console.warn(`[v5] Image ${resp.status}: ${img.safeName}`);
                return;
              }
              const blob = await resp.blob();
              const ext = blob.type.includes("png")
                ? ".png"
                : blob.type.includes("gif")
                  ? ".gif"
                  : ".jpg";
              img.ext = ext;
              await writeFile("images/" + img.safeName + ext, blob);
            } catch (e) {
              console.warn("[v5] Image failed:", e);
            }
          }),
        );
      }
    }

    // ── Write API format ───────────────────────────────────────────────
    if (cfg.apiFormat) {
      setStatus("📋 Writing API format...");
      const apiJsonStr = buildApiJson(turns, apiModel);
      await writeFile("conversation.api.json", apiJsonStr);
      console.log(
        `[v5] conversation.api.json written (${apiJsonStr.length} chars)`,
      );
    }

    // ── Write HTML output ──────────────────────────────────────────────
    if (cfg.htmlOutput) {
      setStatus("📄 Writing HTML output...");
      const htmlStr = buildHtml(
        turns,
        chatTitle,
        chatUrl,
        exportTime,
        allArtifactFiles,
      );
      await writeFile("conversation.html", htmlStr);
      console.log(`[v5] conversation.html written (${htmlStr.length} chars)`);
    }

    // ── Update export history ──────────────────────────────────────────
    if (cfg.skipPreviouslyExported && chatId !== "unknown") {
      const history = JSON.parse(
        localStorage.getItem("claude_export_history") || "{}",
      );
      history[chatId] = {
        exportedAt: exportTime,
        title: chatTitle,
      };
      localStorage.setItem("claude_export_history", JSON.stringify(history));
      console.log(`[v5] Export history updated for ${chatId}`);
    }

    // ── Finalize ───────────────────────────────────────────────────────
    await finalizeZip(`${safeTitle}.zip`);

    const method = useFolder ? "📂 Folder" : "📦 ZIP";
    setStatus(
      [
        `✅ Export complete! (${method})`,
        ``,
        `📝 Transcript: ${turns.length} turns`,
        `📄 Artifacts: ${allArtifactFiles.length} files`,
        `🖼️ Images: ${allImages.length}`,
        `📎 Uploaded files referenced: ${manifest.uploadedFiles.length}`,
        cfg.apiFormat ? `📋 API format: conversation.api.json` : "",
        cfg.htmlOutput ? `📄 HTML: conversation.html` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );

    await sleep(8000);
  } catch (err) {
    console.error("[v5] Export failed:", err);
    setStatus("❌ " + err.message + "\n\nCheck console for details.");
    await sleep(10000);
  } finally {
    overlay.remove();
  }
})();
