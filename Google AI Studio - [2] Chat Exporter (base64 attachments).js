// =============================================================================
// Google AI Studio Chat Exporter — DevTools Snippet v5
// =============================================================================
// Fixed: lists, tables, inline code — handles ms-cmark-node wrappers
// CSP/TrustedTypes safe. Per-turn scrolling for virtual scroll.
// =============================================================================

(async () => {
    'use strict';

    const CONFIG = {
      scrollDelayMs: 400,
      exportFormat: 'both',     // 'markdown', 'json', or 'both'
      includeThinking: true,
      includeSystemPrompt: true,
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
    hdr.textContent = '📦 AI Studio Exporter v5';
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
    // ── HTML-to-Markdown converter ──────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════
    //
    // AI Studio DOM pattern:
    //   <ul> → <ms-cmark-node> → <li> → <ms-cmark-node> → <p> → <ms-cmark-node> → text
    //   <table> → <ms-cmark-node> → <tr> → <ms-cmark-node> → <td> → ...
    //   Inline code uses <span class="inline-code"> not <code>
    //
    // Strategy: ms-cmark-node is always transparent (pass-through).
    // All standard HTML tags are converted normally.

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
        // Text node
        if (node.nodeType === Node.TEXT_NODE) {
          return node.textContent || '';
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const tag = node.tagName.toLowerCase();

        // ── Transparent wrappers: ms-cmark-node, div.table-container ──
        if (tag === 'ms-cmark-node' || tag === 'ms-text-chunk' || tag === 'ms-prompt-chunk') {
          return Array.from(node.childNodes).map(convert).join('');
        }

        const children = () => Array.from(node.childNodes).map(convert).join('');

        // ── Headings (h1 through h6) ──
        if (tag === 'h1' || tag === 'h2' || tag === 'h3' ||
            tag === 'h4' || tag === 'h5' || tag === 'h6') {
          const level = parseInt(tag.charAt(1));
          return '\n\n' + '#'.repeat(level) + ' ' + children().trim() + '\n\n';
        }

        // ── Paragraphs ──
        if (tag === 'p') {
          const text = children().trim();
          if (!text) return '';
          return '\n\n' + text + '\n\n';
        }

        // ── Line breaks ──
        if (tag === 'br') return '\n';

        // ── Horizontal rules ──
        if (tag === 'hr') return '\n\n---\n\n';

        // ── Blockquotes ──
        if (tag === 'blockquote') {
          const lines = children().trim().split('\n');
          return '\n\n' + lines.map(l => '> ' + l).join('\n') + '\n\n';
        }

        // ── Code blocks: <pre> ──
        if (tag === 'pre') {
          const codeEl = node.querySelector('code');
          const codeText = codeEl ? codeEl.textContent : node.textContent;
          const langClass = (codeEl || node).className.match(/language-(\w+)/);
          const lang = langClass ? langClass[1] :
            (node.getAttribute('data-lang') || node.getAttribute('language') || '');
          return '\n\n```' + lang + '\n' + codeText.trimEnd() + '\n```\n\n';
        }

        // ── Unordered lists ──
        // Children may be <li> directly OR wrapped in <ms-cmark-node>
        if (tag === 'ul') {
          const items = node.querySelectorAll(':scope > li, :scope > ms-cmark-node > li');
          const result = Array.from(items).map(li => {
            const content = convert(li).trim();
            // Indent continuation lines for nested content
            const lines = content.split('\n');
            return '- ' + lines[0] + (lines.length > 1 ? '\n' + lines.slice(1).map(l => '  ' + l).join('\n') : '');
          });
          return '\n\n' + result.join('\n') + '\n\n';
        }

        // ── Ordered lists ──
        if (tag === 'ol') {
          const start = parseInt(node.getAttribute('start') || '1');
          const items = node.querySelectorAll(':scope > li, :scope > ms-cmark-node > li');
          const result = Array.from(items).map((li, i) => {
            const content = convert(li).trim();
            const num = (start + i) + '. ';
            const pad = ' '.repeat(num.length);
            const lines = content.split('\n');
            return num + lines[0] + (lines.length > 1 ? '\n' + lines.slice(1).map(l => pad + l).join('\n') : '');
          });
          return '\n\n' + result.join('\n') + '\n\n';
        }

        // ── List items ──
        if (tag === 'li') {
          return children();
        }

        // ── Tables ──
        if (tag === 'table') {
          const rows = [];
          // Find <tr> elements — may be nested inside ms-cmark-node
          const trEls = node.querySelectorAll('tr');
          trEls.forEach(tr => {
            const cells = tr.querySelectorAll('td, th');
            const rowData = Array.from(cells).map(cell =>
              convert(cell).trim().replace(/\|/g, '\\|').replace(/\n+/g, ' ')
            );
            rows.push(rowData);
          });
          if (rows.length === 0) return children();

          const colCount = Math.max(...rows.map(r => r.length));
          const pad = row => { while (row.length < colCount) row.push(''); return row; };
          const mdRows = rows.map(r => '| ' + pad(r).join(' | ') + ' |');
          if (mdRows.length > 0) {
            mdRows.splice(1, 0, '| ' + Array(colCount).fill('---').join(' | ') + ' |');
          }
          return '\n\n' + mdRows.join('\n') + '\n\n';
        }

        // Table cells — just return content
        if (tag === 'td' || tag === 'th') return children();
        if (tag === 'tr') return children();
        if (tag === 'thead' || tag === 'tbody' || tag === 'tfoot') return children();

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
          if (node.parentElement && node.parentElement.tagName.toLowerCase() === 'pre') {
            return node.textContent;
          }
          return '`' + node.textContent + '`';
        }

        // AI Studio uses <span class="inline-code"> for inline code
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
          // Replace the Gemini thinking spinner with a local copy
          if (src.includes('watermark/watermark.png') || node.classList.contains('thinking-progress-icon')) {
            return '![Thinking](watermark.png)';
          }
          if (src) return '![' + alt + '](' + src + ')';
          return '';
        }

        // ── Containers / generic elements — pass through ──
        if (tag === 'div' || tag === 'section' || tag === 'article' ||
            tag === 'main' || tag === 'span' || tag === 'figure' ||
            tag === 'figcaption' || tag === 'details' || tag === 'summary') {
          return children();
        }

        // Default: pass through children
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
      const firstTurn = document.querySelector('ms-chat-turn');
      if (firstTurn) {
        let el = firstTurn.parentElement;
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
        // Thinking content lives inside: ms-thought-chunk → mat-accordion →
        //   mat-expansion-panel.thought-panel → ... → ms-text-chunk → ms-cmark-node.cmark-node
        const thoughtChunk = turn.querySelector('ms-thought-chunk');
        if (thoughtChunk) {
          const thoughtPanel = thoughtChunk.querySelector('mat-expansion-panel.thought-panel');
          if (thoughtPanel) {
            const cmarkRoot = thoughtPanel.querySelector('ms-cmark-node.cmark-node');
            if (cmarkRoot) {
              thinking = htmlToMarkdown(cmarkRoot);
            } else {
              const body = thoughtPanel.querySelector('.mat-expansion-panel-body');
              if (body) thinking = htmlToMarkdown(body);
            }
          }
        }
      }

      // ── Main content ──
      let content = '';

      // The main content is the ms-text-chunk that is a DIRECT child of text-chunk,
      // NOT the one inside ms-thought-chunk.
      const textChunkContainer = turn.querySelector('ms-prompt-chunk.text-chunk');
      if (textChunkContainer) {
        // Get all ms-text-chunk children, but skip the one inside ms-thought-chunk
        const allTextChunks = textChunkContainer.querySelectorAll(':scope > ms-text-chunk');
        for (const tc of allTextChunks) {
          const cmarkRoot = tc.querySelector('ms-cmark-node.cmark-node');
          if (cmarkRoot) {
            content = htmlToMarkdown(cmarkRoot);
            break;
          }
        }
        // If no direct ms-text-chunk found (maybe thinking is in the way),
        // look for ms-text-chunk that is NOT inside ms-thought-chunk
        if (!content) {
          const allTC = textChunkContainer.querySelectorAll('ms-text-chunk');
          for (const tc of allTC) {
            if (tc.closest('ms-thought-chunk')) continue; // skip thinking
            const cmarkRoot = tc.querySelector('ms-cmark-node.cmark-node');
            if (cmarkRoot) { content = htmlToMarkdown(cmarkRoot); break; }
          }
        }
      }

      // Fallback
      if (!content) {
        const turnContent = turn.querySelector('.turn-content');
        if (turnContent) content = htmlToMarkdown(turnContent);
      }
      if (!content) content = htmlToMarkdown(turn);

      // Clean role prefix
      content = content.replace(/^\s*(User|Model)\s*\n/, '').trim();

      return { role, content, thinking: thinking || undefined };
    };

    // ══════════════════════════════════════════════════════════════════════════
    // ── Main ────────────────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════
    try {
      if (!window.location.hostname.includes('aistudio.google.com')) {
        setStatus('⚠️ Not on Google AI Studio!');
        await sleep(3000); overlay.remove(); return;
      }

      const title = getTitle();
      setStatus('Exporting: ' + title);
      const scroller = findScroller();

      // Phase 1: Scroll to load all turns
      setStatus('Scrolling to load all turns...');
      scroller.scrollTop = 0;
      await sleep(300);
      let lastH = -1, stable = 0;
      for (let i = 0; i < 200; i++) {
        scroller.scrollTop = scroller.scrollHeight;
        await sleep(200);
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

        // Expand thinking panels
        turn.querySelectorAll('mat-expansion-panel.thought-panel').forEach(tp => {
          if (!tp.classList.contains('mat-expanded')) {
            const h = tp.querySelector('mat-expansion-panel-header');
            if (h) try { h.click(); } catch (e) {}
          }
        });
        await sleep(200);

        // Re-query after expansion
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

      if (CONFIG.exportFormat === 'json' || CONFIG.exportFormat === 'both') {
        downloadFile(JSON.stringify({
          title,
          exported_at: new Date().toISOString(),
          source: window.location.href,
          system_instruction: systemPrompt || undefined,
          turn_count: messages.length,
          messages: messages.map(m => ({
            role: m.role, content: m.content,
            ...(m.thinking ? { thinking: m.thinking } : {}),
          }))
        }, null, 2), base + '.json', 'application/json');
      }

      setStatus('✅ Done! ' + messages.length + '/' + totalTurns + ' turns exported.', base + '.*');
      await sleep(5000);
    } catch (err) {
      setStatus('❌ ' + err.message);
      console.error('[Exporter]', err);
      await sleep(5000);
    } finally {
      overlay.remove();
    }
  })();
