// =============================================================================
// Final probe: Try known API patterns to download an artifact by filepath
// =============================================================================
// We know: orgUuid, conversationUuid, filepath
// Try several URL patterns and see which returns the actual file content.
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

  log("🔬 Artifact Download URL Discovery\n");

  const orgUuid = "1adadf5e-859d-4404-bbc5-cb702e1b0756";
  const convUuid = "bc65739a-08b6-4aae-ac9f-9dd07b587429";
  const filepath = "/mnt/user-data/outputs/voice-library-comparison.md";
  const filename = "voice-library-comparison.md";

  // Build candidate URLs
  const candidates = [
    // Pattern from the onClick: K({ filepath, orgUuid, conversationUuid })
    // Likely server action, but maybe there's a REST endpoint too
    `/api/${orgUuid}/chat/${convUuid}/files/${encodeURIComponent(filepath)}`,
    `/api/${orgUuid}/chat/${convUuid}/artifact/${encodeURIComponent(filepath)}`,
    `/api/${orgUuid}/chat/${convUuid}/download?path=${encodeURIComponent(filepath)}`,
    `/api/${orgUuid}/conversations/${convUuid}/files/${encodeURIComponent(filepath)}`,
    `/api/${orgUuid}/conversations/${convUuid}/download?path=${encodeURIComponent(filepath)}`,
    // Maybe simpler patterns
    `/api/files/${encodeURIComponent(filepath)}?org=${orgUuid}&conversation=${convUuid}`,
    `/api/${orgUuid}/files?path=${encodeURIComponent(filepath)}&conversation=${convUuid}`,
    // Artifact-specific endpoints
    `/api/${orgUuid}/chat/${convUuid}/artifacts/${encodeURIComponent(filename)}`,
    `/api/${orgUuid}/artifacts/${encodeURIComponent(filepath)}`,
    // The pattern from the image src: /api/{orgUuid}/files/{fileId}/preview
    // Maybe without a fileId, using path instead
    `/api/${orgUuid}/files/by-path?path=${encodeURIComponent(filepath)}&conversation=${convUuid}`,
    // Next.js RSC action endpoint — try POSTing to the page itself
  ];

  log(`Testing ${candidates.length} URL patterns...\n`);

  for (let i = 0; i < candidates.length; i++) {
    const url = candidates[i];
    log(`[${i + 1}] GET ${url}`);
    try {
      const resp = await fetch(url, {
        credentials: "include",
        headers: { Accept: "*/*" },
      });
      const status = resp.status;
      const contentType = resp.headers.get("content-type") || "(none)";
      const contentLength = resp.headers.get("content-length") || "?";
      const contentDisp = resp.headers.get("content-disposition") || "(none)";

      log(
        `    → ${status} | type=${contentType} | len=${contentLength} | disp=${contentDisp}`,
      );

      if (status === 200) {
        const text = await resp.text();
        const preview = text.substring(0, 200).replace(/\n/g, "\\n");
        log(`    ✅ BODY (${text.length} chars): "${preview}…"`);
        log(`    🎉 THIS URL PATTERN WORKS!`);
      } else if (status === 404 || status === 403 || status === 401) {
        // Expected for wrong patterns, skip body
        log(`    ❌ ${status}`);
      } else {
        const text = await resp.text();
        log(`    BODY: "${text.substring(0, 150)}"`);
      }
    } catch (e) {
      log(`    ❌ Error: ${e.message}`);
    }
    log("");
  }

  // ── Strategy 2: Try to find the RSC action endpoint ──────────────────
  log("═══ STRATEGY 2: RSC Action endpoint discovery ═══\n");

  // Next.js server actions are POSTed to the current page URL with special headers
  const rscPayload = JSON.stringify({
    filepath: filepath,
    orgUuid: orgUuid,
    conversationUuid: convUuid,
    isShared: false,
    source: "wiggle_card_download_button",
  });

  const rscCandidates = [
    // Try POSTing to the page URL (standard Next.js server action pattern)
    { url: window.location.pathname, headers: { "Next-Action": "true" } },
    {
      url: window.location.pathname,
      headers: { "Next-Router-State-Tree": "true" },
    },
    // Try POSTing to an API endpoint
    { url: `/api/artifact/download`, headers: {} },
    { url: `/api/download`, headers: {} },
  ];

  for (let i = 0; i < rscCandidates.length; i++) {
    const { url, headers } = rscCandidates[i];
    log(`[RSC ${i + 1}] POST ${url} (headers: ${JSON.stringify(headers)})`);
    try {
      const resp = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: rscPayload,
      });
      const status = resp.status;
      const contentType = resp.headers.get("content-type") || "(none)";
      log(`    → ${status} | type=${contentType}`);
      const text = await resp.text();
      log(
        `    BODY (${text.length} chars): "${text.substring(0, 300).replace(/\n/g, "\\n")}…"`,
      );
    } catch (e) {
      log(`    ❌ Error: ${e.message}`);
    }
    log("");
  }

  // ── Strategy 3: Check if there's a content property in the fiber ─────
  log("═══ STRATEGY 3: Check fiber for inline content ═══\n");

  const getFiber = (el) => {
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    return key ? el[key] : null;
  };

  // Walk up from the artifact cell and look for a `content` or `text` prop
  // at EVERY level, searching deeply in objects
  const firstCell = document.querySelector(".artifact-block-cell");
  if (firstCell) {
    const fiber = getFiber(firstCell);
    let current = fiber;
    let depth = 0;

    const deepSearch = (obj, path, maxD, visited = new WeakSet()) => {
      if (!obj || typeof obj !== "object" || maxD <= 0 || visited.has(obj))
        return [];
      visited.add(obj);
      const results = [];

      const keys = Object.keys(obj);
      for (const key of keys) {
        const val = obj[key];
        const p = `${path}.${key}`;

        // Look for the actual markdown content string
        if (
          typeof val === "string" &&
          val.length > 500 &&
          (val.includes("# ") || val.includes("```") || val.includes("---"))
        ) {
          results.push({
            path: p,
            length: val.length,
            preview: val.substring(0, 150),
          });
        }

        if (val && typeof val === "object") {
          results.push(...deepSearch(val, p, maxD - 1, visited));
        }
      }
      return results;
    };

    while (current && depth < 50) {
      // Check props
      if (current.memoizedProps) {
        const results = deepSearch(
          current.memoizedProps,
          `fiber[${depth}].props`,
          10,
        );
        for (const r of results) {
          log(`📄 ${r.path} (${r.length} chars)`);
          log(`   "${r.preview.replace(/\n/g, "\\n")}…"\n`);
        }
      }

      // Check hooks chain
      let hookState = current.memoizedState;
      let hookIdx = 0;
      while (hookState && hookIdx < 25) {
        const ms = hookState.memoizedState;
        if (ms && typeof ms === "object") {
          const results = deepSearch(
            ms,
            `fiber[${depth}].hook[${hookIdx}]`,
            10,
          );
          for (const r of results) {
            log(`📄 ${r.path} (${r.length} chars)`);
            log(`   "${r.preview.replace(/\n/g, "\\n")}…"\n`);
          }
        }
        hookState = hookState.next;
        hookIdx++;
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
  a.download = `artifact_url_probe_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  overlay.style.cursor = "pointer";
  overlay.addEventListener("click", () => overlay.remove());
  await new Promise((r) => setTimeout(r, 8000));
  overlay.remove();
})();
