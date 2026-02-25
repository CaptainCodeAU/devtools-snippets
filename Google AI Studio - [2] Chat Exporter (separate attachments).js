// =============================================================================
// Google AI Studio Chat Exporter — DevTools Snippet v6
// =============================================================================
// - Converts rendered HTML back to proper Markdown
// - Handles ms-cmark-node wrappers for lists, tables, inline code
// - Extracts base64 images as separate files, references by filename
// - Per-turn scrolling to defeat virtual scrolling
// - CSP/TrustedTypes safe
// =============================================================================

(async () => {
    'use strict';

    const CONFIG = {
      scrollDelayMs: 400,
      exportFormat: 'both',     // 'markdown', 'json', or 'both'
      includeThinking: true,
      includeSystemPrompt: true,
      extractImages: true,      // save base64 images as separate files
    };

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const sanitizeFilename = str =>
      str.replace(/[^a-z0-9_\-\s]/gi, '').replace(/\s+/g, '_').substring(0, 80);

    const downloadFile = (content, filename, mimeType = 'text/plain') => {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    const downloadBlob = (blob, filename) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    // ── CSP-safe status overlay ────────────────────────────────────────────────
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', top: '16px', right: '16px', zIndex: '999999',
      background: '#1a1a2e', color: '#e0e0e0', padding: '16px 24px',
      borderRadius: '12px', fontFamily: 'system-ui, sans-serif', fontSize: '14px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)', minWidth: '300px',
      border: '1px solid #333'
    });
    const hdr = document.createElement('div');
    Object.assign(hdr.style, { fontWeight: '600', marginBottom: '8px', color: '#7c9cff' });
    hdr.textContent = '📦 AI Studio Exporter v6';
    const statusEl = document.createElement('div');
    statusEl.textContent = 'Initializing...';
    const progressEl = document.createElement('div');
    Object.assign(progressEl.style, { marginTop: '6px', fontSize: '12px', color: '#888' });
    overlay.appendChild(hdr);
    overlay.appendChild(statusEl);
    overlay.appendChild(progressEl);
    document.body.appendChild(overlay);

    const setStatus = (msg, detail = '') => {
      statusEl.textContent = msg;
      progressEl.textContent = detail;
      console.log('[Exporter] ' + msg + (detail ? ' — ' + detail : ''));
    };

    // ══════════════════════════════════════════════════════════════════════════
    // ── Image collector ─────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    // Stores { originalSrc, filename, mimeType, base64data } for deferred download
    const collectedImages = [];
    let imageCounter = 0;

    const base64ToBlob = (b64, mimeType) => {
      const byteChars = atob(b64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      return new Blob([byteArr], { type: mimeType });
    };

    const getImageFilename = (src, alt) => {
      // Try to derive a meaningful name from the alt text
      let name = (alt || '').replace(/[^a-z0-9_\-\s.]/gi, '').replace(/\s+/g, '_').substring(0, 60);
      if (!name || name === 'image') name = 'image_' + (++imageCounter);
      else imageCounter++;

      // Determine extension from mime or src
      let ext = 'png';
      if (src.includes('data:image/jpeg') || src.includes('data:image/jpg')) ext = 'jpg';
      else if (src.includes('data:image/gif')) ext = 'gif';
      else if (src.includes('data:image/webp')) ext = 'webp';
      else if (src.includes('data:image/svg')) ext = 'svg';

      // Avoid duplicate extensions
      if (!name.endsWith('.' + ext)) name += '.' + ext;
      return name;
    };

    // ══════════════════════════════════════════════════════════════════════════
    // ── HTML-to-Markdown converter ──────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    const htmlToMarkdown = (rootEl) => {
      const root = rootEl.cloneNode(true);

      // Remove UI chrome
      root.querySelectorAll(
        'ms-chat-turn-options, button, mat-icon, ' +
        '[aria-label="Copy"], [aria-label="Edit"], ' +
        '.action-buttons, .feedback-buttons, [class*="thumb"], ' +
        '[class*="copy-button"], .overflow-menu, .edit-button, ' +
        '.turn-role-label, .role-label'
      ).forEach(n => n.remove());

      const convert = (node) => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const tag = node.tagName.toLowerCase();

        // ── Transparent wrappers ──
        if (tag === 'ms-cmark-node' || tag === 'ms-text-chunk' || tag === 'ms-prompt-chunk') {
          return Array.from(node.childNodes).map(convert).join('');
        }

        const children = () => Array.from(node.childNodes).map(convert).join('');

        // ── Headings h1–h6 ──
        if (tag === 'h1' || tag === 'h2' || tag === 'h3' ||
            tag === 'h4' || tag === 'h5' || tag === 'h6') {
          const level = parseInt(tag.charAt(1));
          return '\n\n' + '#'.repeat(level) + ' ' + children().trim() + '\n\n';
        }

        // ── Paragraphs ──
        if (tag === 'p') {
          const text = children().trim();
          return text ? '\n\n' + text + '\n\n' : '';
        }

        if (tag === 'br') return '\n';
        if (tag === 'hr') return '\n\n---\n\n';

        // ── Blockquotes ──
        if (tag === 'blockquote') {
          return '\n\n' + children().trim().split('\n').map(l => '> ' + l).join('\n') + '\n\n';
        }

        // ── Code blocks ──
        if (tag === 'pre') {
          const codeEl = node.querySelector('code');
          const codeText = codeEl ? codeEl.textContent : node.textContent;
          const langClass = (codeEl || node).className.match(/language-(\w+)/);
          const lang = langClass ? langClass[1] :
            (node.getAttribute('data-lang') || node.getAttribute('language') || '');
          return '\n\n```' + lang + '\n' + codeText.trimEnd() + '\n```\n\n';
        }

        // ── Unordered lists (handles ms-cmark-node wrappers) ──
        if (tag === 'ul') {
          const items = node.querySelectorAll(':scope > li, :scope > ms-cmark-node > li');
          const result = Array.from(items).map(li => {
            const c = convert(li).trim();
            const lines = c.split('\n');
            return '- ' + lines[0] + (lines.length > 1 ? '\n' + lines.slice(1).map(l => '  ' + l).join('\n') : '');
          });
          return '\n\n' + result.join('\n') + '\n\n';
        }

        // ── Ordered lists ──
        if (tag === 'ol') {
          const start = parseInt(node.getAttribute('start') || '1');
          const items = node.querySelectorAll(':scope > li, :scope > ms-cmark-node > li');
          const result = Array.from(items).map((li, i) => {
            const c = convert(li).trim();
            const num = (start + i) + '. ';
            const pad = ' '.repeat(num.length);
            const lines = c.split('\n');
            return num + lines[0] + (lines.length > 1 ? '\n' + lines.slice(1).map(l => pad + l).join('\n') : '');
          });
          return '\n\n' + result.join('\n') + '\n\n';
        }

        if (tag === 'li') return children();

        // ── Tables (handles ms-cmark-node wrappers) ──
        if (tag === 'table') {
          const rows = [];
          node.querySelectorAll('tr').forEach(tr => {
            const cells = tr.querySelectorAll('td, th');
            rows.push(Array.from(cells).map(cell =>
              convert(cell).trim().replace(/\|/g, '\\|').replace(/\n+/g, ' ')
            ));
          });
          if (rows.length === 0) return children();
          const colCount = Math.max(...rows.map(r => r.length));
          const pad = row => { while (row.length < colCount) row.push(''); return row; };
          const mdRows = rows.map(r => '| ' + pad(r).join(' | ') + ' |');
          if (mdRows.length > 0) mdRows.splice(1, 0, '| ' + Array(colCount).fill('---').join(' | ') + ' |');
          return '\n\n' + mdRows.join('\n') + '\n\n';
        }

        if (tag === 'td' || tag === 'th' || tag === 'tr' ||
            tag === 'thead' || tag === 'tbody' || tag === 'tfoot') return children();

        // ── Bold ──
        if (tag === 'strong' || tag === 'b') {
          const t = children().trim();
          return t ? '**' + t + '**' : '';
        }

        // ── Italic ──
        if (tag === 'em' || tag === 'i') {
          const t = children().trim();
          return t ? '*' + t + '*' : '';
        }

        // ── Strikethrough ──
        if (tag === 's' || tag === 'del' || tag === 'strike') {
          return '~~' + children().trim() + '~~';
        }

        // ── Inline code: <code> or <span class="inline-code"> ──
        if (tag === 'code') {
          if (node.parentElement && node.parentElement.tagName.toLowerCase() === 'pre') return node.textContent;
          return '`' + node.textContent + '`';
        }
        if (tag === 'span' && node.classList.contains('inline-code')) {
          return '`' + node.textContent + '`';
        }

        // ── Links ──
        if (tag === 'a') {
          const href = node.getAttribute('href') || '';
          const text = children().trim();
          return href && text ? '[' + text + '](' + href + ')' : text;
        }

        // ── Images ──
        if (tag === 'img') {
          const alt = node.getAttribute('alt') || 'image';
          const src = node.getAttribute('src') || '';

          // Thinking spinner → local reference
          if (src.includes('watermark/watermark.png') || node.classList.contains('thinking-progress-icon')) {
            return '![Thinking](watermark.png)';
          }

          // Base64 embedded image → extract to separate file
          if (CONFIG.extractImages && src.startsWith('data:image/')) {
            const filename = getImageFilename(src, alt);
            const commaIdx = src.indexOf(',');
            if (commaIdx !== -1) {
              const mimeMatch = src.match(/^data:(image\/[^;]+)/);
              const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
              const b64 = src.substring(commaIdx + 1);
              collectedImages.push({ filename, mimeType, base64data: b64 });
            }
            return '![' + alt + '](' + filename + ')';
          }

          if (src) return '![' + alt + '](' + src + ')';
          return '';
        }

        // ── Containers — pass through ──
        if (tag === 'div' || tag === 'section' || tag === 'article' ||
            tag === 'main' || tag === 'span' || tag === 'figure' ||
            tag === 'figcaption' || tag === 'details' || tag === 'summary') {
          return children();
        }

        return children();
      };

      let md = convert(root);
      md = md.replace(/\n{3,}/g, '\n\n');
      return md.trim();
    };

    // ══════════════════════════════════════════════════════════════════════════
    // ── Turn extraction ─────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    const findScroller = () => {
      const auto = document.querySelector('ms-autoscroll-container');
      if (auto && auto.scrollHeight > auto.clientHeight) return auto;
      const ft = document.querySelector('ms-chat-turn');
      if (ft) {
        let el = ft.parentElement;
        while (el && el !== document.body) {
          const s = getComputedStyle(el);
          if (/(auto|scroll)/.test(s.overflow + s.overflowY) && el.scrollHeight > el.clientHeight) return el;
          el = el.parentElement;
        }
      }
      return document.documentElement;
    };

    const getTitle = () => {
      const el = document.querySelector('span.title-input, [aria-label="prompt title"]');
      if (el) { const v = (el.value || el.textContent || '').trim(); if (v) return v; }
      return document.title.replace(/ [-|] Google AI Studio.*/, '').trim() || 'AI_Studio_Export';
    };

    const getSystemPrompt = () => {
      if (!CONFIG.includeSystemPrompt) return '';
      for (const sel of [
        'ms-system-instructions-panel textarea',
        'textarea[aria-label*="system" i]',
      ]) {
        const el = document.querySelector(sel);
        if (el && el.value && el.value.trim()) return el.value.trim();
      }
      return '';
    };

    const extractSingleTurn = (turn) => {
      // ── Role ──
      let role = 'unknown';
      const rc = turn.querySelector('[data-turn-role]');
      if (rc) {
        const r = rc.getAttribute('data-turn-role').toLowerCase();
        if (r === 'user') role = 'user'; else if (r === 'model') role = 'model';
      }
      if (role === 'unknown') {
        const c = turn.querySelector('.chat-turn-container');
        if (c) { if (c.classList.contains('user')) role = 'user'; else if (c.classList.contains('model')) role = 'model'; }
      }

      // ── Thinking ──
      let thinking = '';
      if (CONFIG.includeThinking) {
        const thoughtChunk = turn.querySelector('ms-thought-chunk');
        if (thoughtChunk) {
          const tp = thoughtChunk.querySelector('mat-expansion-panel.thought-panel');
          if (tp) {
            const cr = tp.querySelector('ms-cmark-node.cmark-node');
            if (cr) thinking = htmlToMarkdown(cr);
            else {
              const body = tp.querySelector('.mat-expansion-panel-body');
              if (body) thinking = htmlToMarkdown(body);
            }
          }
        }
      }

      // ── Main text content ──
      let content = '';
      const textChunkContainer = turn.querySelector('ms-prompt-chunk.text-chunk');
      if (textChunkContainer) {
        const allTC = textChunkContainer.querySelectorAll('ms-text-chunk');
        for (const tc of allTC) {
          if (tc.closest('ms-thought-chunk')) continue;
          const cr = tc.querySelector('ms-cmark-node.cmark-node');
          if (cr) { content = htmlToMarkdown(cr); break; }
        }
      }
      if (!content) {
        const tc = turn.querySelector('.turn-content');
        if (tc) content = htmlToMarkdown(tc);
      }
      if (!content) content = htmlToMarkdown(turn);

      content = content.replace(/^\s*(User|Model)\s*\n/, '').trim();

      // ── Collect images from ALL ms-image-chunk elements in this turn ──
      // These live in ms-prompt-chunk (without .text-chunk) → ms-image-chunk → img
      const imageChunks = turn.querySelectorAll('ms-image-chunk img.loaded-image, ms-image-chunk img[src]');
      imageChunks.forEach(img => {
        const src = img.getAttribute('src') || '';
        const alt = img.getAttribute('alt') || 'image';

        // Thinking spinner — skip
        if (src.includes('watermark/watermark.png') || img.classList.contains('thinking-progress-icon')) return;

        if (CONFIG.extractImages && src.startsWith('data:image/')) {
          const filename = getImageFilename(src, alt);
          const commaIdx = src.indexOf(',');
          if (commaIdx !== -1) {
            const mimeMatch = src.match(/^data:(image\/[^;]+)/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
            const b64 = src.substring(commaIdx + 1);
            collectedImages.push({ filename, mimeType, base64data: b64 });
          }
          content += (content ? '\n\n' : '') + '![' + alt + '](' + filename + ')';
        } else if (src.startsWith('blob:')) {
          // Blob URLs — attempt to fetch and convert
          const filename = getImageFilename('data:image/png', alt);
          collectedImages.push({ filename, mimeType: 'image/png', blobUrl: src });
          content += (content ? '\n\n' : '') + '![' + alt + '](' + filename + ')';
        } else if (src && !src.includes('watermark')) {
          content += (content ? '\n\n' : '') + '![' + alt + '](' + src + ')';
        }
      });

      return { role, content, thinking: thinking || undefined };
    };

    // ══════════════════════════════════════════════════════════════════════════
    // ── Main ────────────────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════
    try {
      // ── Page validation ──────────────────────────────────────────────────
      const hostname = window.location.hostname;
      const pathname = window.location.pathname;
      const onAIStudio = hostname.includes('aistudio.google.com');
      const promptMatch = pathname.match(/^\/prompts\/([a-zA-Z0-9_\-]+)$/);
      const onPrompt = onAIStudio && promptMatch && promptMatch[1] !== 'new_chat';
      const onLibrary = onAIStudio && pathname === '/library';

      // Helper: build a CSP-safe dialog
      const showDialog = (titleText, messageText, buttons) => {
        overlay.remove();

        const backdrop = document.createElement('div');
        Object.assign(backdrop.style, {
          position: 'fixed', inset: '0', zIndex: '999998',
          background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        });

        const dialog = document.createElement('div');
        Object.assign(dialog.style, {
          background: '#1a1a2e', color: '#e0e0e0', padding: '28px 32px',
          borderRadius: '14px', fontFamily: 'system-ui, sans-serif', fontSize: '15px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxWidth: '440px',
          border: '1px solid #333', textAlign: 'center',
        });

        const hdrEl = document.createElement('div');
        Object.assign(hdrEl.style, { fontWeight: '600', fontSize: '17px', marginBottom: '12px', color: '#7c9cff' });
        hdrEl.textContent = titleText;

        const msgEl = document.createElement('div');
        Object.assign(msgEl.style, { marginBottom: '14px', lineHeight: '1.5' });
        msgEl.textContent = messageText;

        const pathEl = document.createElement('div');
        Object.assign(pathEl.style, { fontSize: '12px', color: '#888', marginBottom: '18px', wordBreak: 'break-all' });
        pathEl.textContent = 'Current: ' + window.location.href;

        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, { display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' });

        buttons.forEach(({ text, primary, action }) => {
          const btn = document.createElement('button');
          btn.textContent = text;
          Object.assign(btn.style, {
            padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            fontSize: '14px', fontWeight: '500',
            background: primary ? '#7c9cff' : '#333',
            color: primary ? '#1a1a2e' : '#ccc',
          });
          btn.addEventListener('click', () => { backdrop.remove(); if (action) action(); });
          btnRow.appendChild(btn);
        });

        dialog.appendChild(hdrEl);
        dialog.appendChild(msgEl);
        dialog.appendChild(pathEl);
        dialog.appendChild(btnRow);
        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
      };

      if (!onAIStudio) {
        showDialog(
          '📦 AI Studio Exporter',
          'This script only works on Google AI Studio. Please navigate to aistudio.google.com and open a chat conversation first.',
          [
            { text: 'Go to AI Studio', primary: true, action: () => { window.location.href = 'https://aistudio.google.com/library'; } },
            { text: 'Cancel', primary: false },
          ]
        );
        return;
      }

      if (onLibrary) {
        showDialog(
          '📦 AI Studio Exporter',
          'You\'re on the Library page. To export a conversation, click on one of your chats in the list below to open it, then run this script again.',
          [
            { text: 'Got it', primary: true },
          ]
        );
        return;
      }

      if (!onPrompt) {
        showDialog(
          '📦 AI Studio Exporter',
          'This page doesn\'t look like a chat conversation. You need to open a specific chat in Google AI Studio first. Would you like to go to your Library to pick one?',
          [
            { text: 'Go to Library', primary: true, action: () => { window.location.href = 'https://aistudio.google.com/library'; } },
            { text: 'Cancel', primary: false },
          ]
        );
        return;
      }

      const title = getTitle();
      setStatus('Exporting: ' + title);
      const scroller = findScroller();

      // Phase 1: Scroll to load all turns
      setStatus('Scrolling to load all turns...');
      scroller.scrollTop = 0; await sleep(300);
      let lastH = -1, stable = 0;
      for (let i = 0; i < 200; i++) {
        scroller.scrollTop = scroller.scrollHeight; await sleep(200);
        if (scroller.scrollHeight === lastH) { if (++stable >= 4) break; }
        else stable = 0;
        lastH = scroller.scrollHeight;
      }

      const totalTurns = document.querySelectorAll('ms-chat-turn').length;
      setStatus('Found ' + totalTurns + ' turns. Extracting...');

      // Phase 2: Per-turn extraction
      const messages = [];
      for (let i = 0; i < totalTurns; i++) {
        let turn = document.querySelectorAll('ms-chat-turn')[i];
        if (!turn) continue;
        turn.scrollIntoView({ behavior: 'instant', block: 'center' });
        await sleep(CONFIG.scrollDelayMs);

        turn = document.querySelectorAll('ms-chat-turn')[i];
        if (!turn) continue;

        // Expand thinking
        turn.querySelectorAll('mat-expansion-panel.thought-panel').forEach(tp => {
          if (!tp.classList.contains('mat-expanded')) {
            const h = tp.querySelector('mat-expansion-panel-header');
            if (h) try { h.click(); } catch (e) {}
          }
        });
        await sleep(200);

        turn = document.querySelectorAll('ms-chat-turn')[i];
        const data = extractSingleTurn(turn);
        data.turnIndex = i;

        setStatus('Extracting...', 'Turn ' + (i + 1) + '/' + totalTurns +
          ' (' + data.role + ', ' + data.content.length + ' chars)');

        if (data.content || data.thinking) messages.push(data);
        else console.warn('[Exporter] Turn ' + i + ' — empty');
      }

      if (messages.length === 0) {
        setStatus('⚠️ No content!'); await sleep(4000); overlay.remove(); return;
      }

      // Phase 3: System prompt
      const systemPrompt = getSystemPrompt();

      // Phase 4: Download
      setStatus('Generating files...');
      const safeName = sanitizeFilename(title) || 'export';
      const ts = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const base = safeName + '_' + ts;

      // Markdown
      if (CONFIG.exportFormat === 'markdown' || CONFIG.exportFormat === 'both') {
        const md = [];
        md.push('# ' + title);
        md.push('');
        md.push('> Exported from Google AI Studio on ' + new Date().toISOString());
        md.push('> Source: ' + window.location.href);
        md.push('');
        if (systemPrompt) {
          md.push('## System Instructions');
          md.push('');
          md.push('```');
          md.push(systemPrompt);
          md.push('```');
          md.push('');
        }
        md.push('---');
        md.push('');
        messages.forEach(msg => {
          md.push(msg.role === 'user' ? '## 👤 User' : '## 🤖 Model');
          md.push('');
          if (msg.thinking) {
            md.push('<details>');
            md.push('<summary>💭 Thinking / Reasoning</summary>');
            md.push('');
            md.push(msg.thinking);
            md.push('');
            md.push('</details>');
            md.push('');
          }
          md.push(msg.content);
          md.push('');
          md.push('---');
          md.push('');
        });
        downloadFile(md.join('\n'), base + '.md', 'text/markdown');
      }

      // JSON
      if (CONFIG.exportFormat === 'json' || CONFIG.exportFormat === 'both') {
        downloadFile(JSON.stringify({
          title,
          exported_at: new Date().toISOString(),
          source: window.location.href,
          system_instruction: systemPrompt || undefined,
          turn_count: messages.length,
          images: collectedImages.length > 0
            ? collectedImages.map(img => img.filename)
            : undefined,
          messages: messages.map(m => ({
            role: m.role, content: m.content,
            ...(m.thinking ? { thinking: m.thinking } : {}),
          }))
        }, null, 2), base + '.json', 'application/json');
      }

      // Phase 5: Download extracted images
      if (collectedImages.length > 0) {
        setStatus('Downloading ' + collectedImages.length + ' images...');
        for (let i = 0; i < collectedImages.length; i++) {
          const img = collectedImages[i];
          setStatus('Saving image...', (i + 1) + '/' + collectedImages.length + ': ' + img.filename);
          try {
            let blob;
            if (img.base64data) {
              blob = base64ToBlob(img.base64data, img.mimeType);
            } else if (img.blobUrl) {
              // Fetch the blob URL (works for same-origin blob URLs)
              try {
                const resp = await fetch(img.blobUrl);
                blob = await resp.blob();
              } catch (e) {
                console.warn('[Exporter] Could not fetch blob URL for: ' + img.filename, e);
                continue;
              }
            }
            if (blob) {
              downloadBlob(blob, img.filename);
              await sleep(300); // gap between downloads to avoid browser throttling
            }
          } catch (e) {
            console.warn('[Exporter] Failed to save image: ' + img.filename, e);
          }
        }
      }

      setStatus(
        '✅ Done! ' + messages.length + '/' + totalTurns + ' turns' +
          (collectedImages.length > 0 ? ', ' + collectedImages.length + ' images' : '') + ' exported.',
        base + '.*'
      );
      await sleep(5000);

    } catch (err) {
      setStatus('❌ ' + err.message);
      console.error('[Exporter]', err);
      await sleep(5000);
    } finally {
      overlay.remove();
    }
  })();
