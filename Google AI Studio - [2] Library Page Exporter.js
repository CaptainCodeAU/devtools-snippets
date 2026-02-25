// =============================================================================
// AI Studio Library Exporter — DevTools Snippet
// =============================================================================
// Run on: https://aistudio.google.com/library
// Exports all prompts/chats listed on the page as JSON and/or CSV.
// Scrolls the table to capture all entries if virtualized.
// =============================================================================

(async () => {
    'use strict';

    const CONFIG = {
      exportFormat: 'all', // 'json', 'csv', 'markdown', or 'all'
      scrollDelayMs: 300,
    };

    const sleep = ms => new Promise(r => setTimeout(r, ms));

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

    // ── CSP-safe overlay ───────────────────────────────────────────────────────
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
    hdr.textContent = '📚 Library Exporter';
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
      console.log('[LibExporter] ' + msg + (detail ? ' — ' + detail : ''));
    };

    try {
      // ── Verify page ──────────────────────────────────────────────────────
      const onAIStudio = window.location.hostname.includes('aistudio.google.com');
      const onLibrary = onAIStudio && window.location.pathname === '/library';

      if (!onAIStudio) {
        setStatus('⚠️ Not on Google AI Studio!');
        await sleep(3000); overlay.remove(); return;
      }

      if (!onLibrary) {
        overlay.remove(); // hide the status overlay, use a dialog instead

        // Build a CSP-safe dialog
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
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxWidth: '420px',
          border: '1px solid #333', textAlign: 'center',
        });

        const title = document.createElement('div');
        Object.assign(title.style, { fontWeight: '600', fontSize: '17px', marginBottom: '12px', color: '#7c9cff' });
        title.textContent = '📚 Library Exporter';

        const msg = document.createElement('div');
        Object.assign(msg.style, { marginBottom: '20px', lineHeight: '1.5' });
        msg.textContent = 'This script needs to run on the Library page. You are currently on a different page. Would you like to go to the Library page now?';

        const currentPage = document.createElement('div');
        Object.assign(currentPage.style, { fontSize: '12px', color: '#888', marginBottom: '18px', wordBreak: 'break-all' });
        currentPage.textContent = 'Current: ' + window.location.pathname;

        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, { display: 'flex', gap: '12px', justifyContent: 'center' });

        const makeBtn = (text, primary) => {
          const btn = document.createElement('button');
          btn.textContent = text;
          Object.assign(btn.style, {
            padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            fontSize: '14px', fontWeight: '500',
            background: primary ? '#7c9cff' : '#333',
            color: primary ? '#1a1a2e' : '#ccc',
          });
          return btn;
        };

        const goBtn = makeBtn('Go to Library', true);
        const cancelBtn = makeBtn('Cancel', false);

        goBtn.addEventListener('click', () => {
          window.location.href = 'https://aistudio.google.com/library';
        });
        cancelBtn.addEventListener('click', () => {
          backdrop.remove();
        });

        btnRow.appendChild(goBtn);
        btnRow.appendChild(cancelBtn);
        dialog.appendChild(title);
        dialog.appendChild(msg);
        dialog.appendChild(currentPage);
        dialog.appendChild(btnRow);
        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        // Also close on backdrop click
        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) backdrop.remove();
        });

        return; // stop execution
      }

      setStatus('Scanning library table...');

      // ── Scroll the table to load all rows ────────────────────────────────
      const tableWrapper = document.querySelector('div.lib-table-wrapper') ||
        document.querySelector('ms-library-table');

      if (tableWrapper && tableWrapper.scrollHeight > tableWrapper.clientHeight) {
        setStatus('Scrolling table to load all entries...');
        let lastH = -1, stable = 0;
        for (let i = 0; i < 100; i++) {
          tableWrapper.scrollTop = tableWrapper.scrollHeight;
          await sleep(CONFIG.scrollDelayMs);
          if (tableWrapper.scrollHeight === lastH) { if (++stable >= 4) break; }
          else stable = 0;
          lastH = tableWrapper.scrollHeight;
        }
        // Scroll back to top
        tableWrapper.scrollTop = 0;
        await sleep(300);
      }

      // ── Strategy 1: Extract from <table> rows ────────────────────────────
      const entries = [];
      const seenUrls = new Set();

      const tableRows = document.querySelectorAll(
        'table.library-table tr.mat-mdc-row, table.library-table tr.cdk-row'
      );

      if (tableRows.length > 0) {
        setStatus('Extracting from table...', tableRows.length + ' rows');

        tableRows.forEach((tr, idx) => {
          const cells = tr.querySelectorAll('td');
          if (cells.length < 3) return;

          // Column order: Name, Description, Type, Updated
          // Name cell contains a link
          const nameCell = tr.querySelector('td.cdk-column-name, td.mat-column-name');
          const descCell = tr.querySelector('td.cdk-column-description, td.mat-column-description');
          const typeCell = tr.querySelector('td.cdk-column-type, td.mat-column-type');
          const updatedCell = tr.querySelector('td.cdk-column-updated, td.mat-column-updated');

          const link = nameCell ? nameCell.querySelector('a[href*="/prompts/"]') : null;
          const href = link ? link.getAttribute('href') : '';
          const name = link ? link.textContent.trim() : (nameCell ? nameCell.textContent.trim() : '');
          const description = descCell ? descCell.textContent.trim() : '';
          const type = typeCell ? typeCell.textContent.trim() : '';
          const updated = updatedCell ? updatedCell.textContent.trim().replace('more_vert', '').trim() : '';

          // Get the type icon text (chat_bubble, etc.)
          const typeIcon = tr.querySelector('td .material-symbols-outlined, td mat-icon');
          const typeIconText = typeIcon ? typeIcon.textContent.trim() : '';

          const fullUrl = href ? 'https://aistudio.google.com' + href : '';

          if (name && fullUrl && !seenUrls.has(fullUrl)) {
            seenUrls.add(fullUrl);
            entries.push({
              name,
              description,
              type: type || typeIconText,
              updated,
              url: fullUrl,
              promptId: href.replace('/prompts/', ''),
            });
          }
        });
      }

      // ── Strategy 2: Fallback — extract from sidebar links ────────────────
      if (entries.length === 0) {
        setStatus('Table empty, trying sidebar links...');
        const sidebarLinks = document.querySelectorAll('a.prompt-link[href*="/prompts/"]');
        sidebarLinks.forEach(a => {
          const href = a.getAttribute('href') || '';
          const name = a.textContent.trim();
          const fullUrl = 'https://aistudio.google.com' + href;
          if (name && !seenUrls.has(fullUrl) && !href.includes('new_chat')) {
            seenUrls.add(fullUrl);
            entries.push({
              name,
              description: '',
              type: '',
              updated: '',
              url: fullUrl,
              promptId: href.replace('/prompts/', ''),
            });
          }
        });
      }

      if (entries.length === 0) {
        setStatus('⚠️ No entries found!');
        await sleep(4000); overlay.remove(); return;
      }

      setStatus('Extracted ' + entries.length + ' entries. Generating files...');

      const ts = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const base = 'ai_studio_library_' + ts;

      // ── JSON export ──────────────────────────────────────────────────────
      if (CONFIG.exportFormat === 'json' || CONFIG.exportFormat === 'all') {
        const jsonData = {
          exported_at: new Date().toISOString(),
          source: window.location.href,
          total_entries: entries.length,
          entries,
        };
        downloadFile(JSON.stringify(jsonData, null, 2), base + '.json', 'application/json');
      }

      // ── CSV export ───────────────────────────────────────────────────────
      if (CONFIG.exportFormat === 'csv' || CONFIG.exportFormat === 'all') {
        const escapeCsv = val => {
          const s = String(val || '');
          if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return '"' + s.replace(/"/g, '""') + '"';
          }
          return s;
        };

        const csvLines = ['Name,Description,Type,Updated,URL,Prompt ID'];
        entries.forEach(e => {
          csvLines.push([
            escapeCsv(e.name),
            escapeCsv(e.description),
            escapeCsv(e.type),
            escapeCsv(e.updated),
            escapeCsv(e.url),
            escapeCsv(e.promptId),
          ].join(','));
        });
        downloadFile(csvLines.join('\n'), base + '.csv', 'text/csv');
      }

      // ── Markdown export ──────────────────────────────────────────────────
      if (CONFIG.exportFormat === 'markdown' || CONFIG.exportFormat === 'all') {
        const md = [];
        md.push('# Google AI Studio — Library');
        md.push('');
        md.push('> Exported on ' + new Date().toISOString());
        md.push('> Total entries: ' + entries.length);
        md.push('');
        md.push('---');
        md.push('');

        // Summary table
        md.push('| # | Name | Type | Updated |');
        md.push('| --- | --- | --- | --- |');
        entries.forEach((e, i) => {
          const name = '[' + e.name.replace(/\|/g, '\\|') + '](' + e.url + ')';
          md.push('| ' + (i + 1) + ' | ' + name + ' | ' + e.type + ' | ' + e.updated + ' |');
        });
        md.push('');
        md.push('---');
        md.push('');

        // Detailed list
        md.push('## Entries');
        md.push('');
        entries.forEach((e, i) => {
          md.push('### ' + (i + 1) + '. ' + e.name);
          md.push('');
          if (e.description) md.push('> ' + e.description);
          if (e.description) md.push('');
          md.push('- **Type:** ' + (e.type || 'N/A'));
          md.push('- **Updated:** ' + (e.updated || 'N/A'));
          md.push('- **URL:** [Open in AI Studio](' + e.url + ')');
          md.push('- **Prompt ID:** `' + e.promptId + '`');
          md.push('');
          md.push('---');
          md.push('');
        });

        downloadFile(md.join('\n'), base + '.md', 'text/markdown');
      }

      // ── Summary to console ───────────────────────────────────────────────
      console.table(entries.map(e => ({ name: e.name, type: e.type, updated: e.updated, url: e.url })));

      setStatus('✅ Done! ' + entries.length + ' entries exported.', base + '.*');
      await sleep(5000);

    } catch (err) {
      setStatus('❌ ' + err.message);
      console.error('[LibExporter]', err);
      await sleep(5000);
    } finally {
      overlay.remove();
    }
  })();
