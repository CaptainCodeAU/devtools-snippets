// =============================================================================
// AI Studio Library/Index Page DOM Inspector — DevTools Snippet
// =============================================================================
// Run this on: https://aistudio.google.com/library  (or /prompts if redirected)
// Downloads a .txt report of the page structure for all prompt/chat entries.
// =============================================================================

(async () => {
  'use strict';

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const downloadFile = (content, filename) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', top: '16px', right: '16px', zIndex: '999999',
    background: '#1a1a2e', color: '#e0e0e0', padding: '16px 24px',
    borderRadius: '12px', fontFamily: 'system-ui, sans-serif', fontSize: '14px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)', minWidth: '300px',
    border: '1px solid #333'
  });
  overlay.textContent = '🔍 Inspecting library page...';
  document.body.appendChild(overlay);

  const lines = [];
  const log = (...args) => { const l = args.join(' '); lines.push(l); console.log(l); };

  const describeEl = (el, maxText = 100) => {
    const tag = el.tagName.toLowerCase();
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0, 5).join('.') : '';
    const id = el.id ? '#' + el.id : '';
    const role = el.getAttribute('role') ? ' [role=' + el.getAttribute('role') + ']' : '';
    const href = el.getAttribute('href') ? ' [href="' + el.getAttribute('href').substring(0, 80) + '"]' : '';
    const ariaLabel = el.getAttribute('aria-label')
      ? ' [aria-label="' + el.getAttribute('aria-label').substring(0, 60) + '"]' : '';
    const dataAttrs = Array.from(el.attributes)
      .filter(a => a.name.startsWith('data-'))
      .map(a => ' [' + a.name + '="' + a.value.substring(0, 60) + '"]')
      .join('');
    const text = (el.textContent || '').trim().substring(0, maxText).replace(/\n/g, '\\n');
    const textStr = text ? ' text="' + text + (text.length >= maxText ? '…' : '') + '"' : '';
    return '<' + tag + id + cls + role + href + ariaLabel + dataAttrs + '>' + textStr;
  };

  const dumpTree = (el, indent = 0, maxDepth = 8) => {
    if (indent > maxDepth) { log('  '.repeat(indent) + '... (depth limit)'); return; }
    const pad = '  '.repeat(indent);

    if (el.nodeType === Node.TEXT_NODE) {
      const t = el.textContent.trim();
      if (t) log(pad + '#text "' + t.substring(0, 100).replace(/\n/g, '\\n') + '"');
      return;
    }
    if (el.nodeType !== Node.ELEMENT_NODE) return;

    const tag = el.tagName.toLowerCase();
    const childCount = el.children.length;
    log(pad + describeEl(el, 80) + (childCount > 0 ? ' [' + childCount + ' ch]' : ''));

    Array.from(el.childNodes).forEach(child => dumpTree(child, indent + 1, maxDepth));
  };

  try {
    log('═══════════════════════════════════════════════════════════════');
    log('  AI STUDIO LIBRARY PAGE — DOM INSPECTION REPORT');
    log('  URL: ' + window.location.href);
    log('  Time: ' + new Date().toISOString());
    log('═══════════════════════════════════════════════════════════════');
    log('');

    // ── Section 1: All custom elements ───────────────────────────────────
    log('── SECTION 1: ALL CUSTOM ELEMENTS ON PAGE ──');
    const customTags = {};
    document.querySelectorAll('*').forEach(el => {
      const tag = el.tagName.toLowerCase();
      if (tag.includes('-')) customTags[tag] = (customTags[tag] || 0) + 1;
    });
    Object.entries(customTags).sort((a, b) => b[1] - a[1])
      .forEach(([tag, count]) => log('  ' + tag + ' × ' + count));
    log('');

    // ── Section 2: Likely list container candidates ──────────────────────
    log('── SECTION 2: POTENTIAL LIST/GRID CONTAINERS ──');
    const listSelectors = [
      // Common patterns for listing pages
      '[class*="library"]', '[class*="prompt-list"]', '[class*="prompt-grid"]',
      '[class*="card-list"]', '[class*="card-grid"]', '[class*="history"]',
      '[class*="recent"]', '[class*="saved"]', '[class*="file-list"]',
      'ms-prompt-list', 'ms-library', 'ms-prompt-history',
      'ms-prompt-history-v3', 'ms-nav-items-v3',
      '[role="list"]', '[role="listbox"]', '[role="grid"]',
      'table', 'mat-table', 'mat-list', 'mat-nav-list',
      'cdk-virtual-scroll-viewport',
    ];
    listSelectors.forEach(sel => {
      const found = document.querySelectorAll(sel);
      if (found.length > 0) {
        log('  "' + sel + '" → ' + found.length + ' match(es)');
        found.forEach((f, fi) => {
          if (fi < 3) log('    [' + fi + '] ' + describeEl(f, 60));
        });
      }
    });
    log('');

    // ── Section 3: Likely prompt/chat entry candidates ───────────────────
    log('── SECTION 3: POTENTIAL PROMPT/CHAT ENTRY ELEMENTS ──');
    const entrySelectors = [
      '[class*="prompt-card"]', '[class*="prompt-item"]', '[class*="prompt-row"]',
      '[class*="chat-card"]', '[class*="chat-item"]', '[class*="chat-row"]',
      '[class*="library-item"]', '[class*="library-card"]', '[class*="library-row"]',
      '[class*="history-item"]', '[class*="history-card"]', '[class*="history-row"]',
      '[class*="file-item"]', '[class*="file-card"]', '[class*="file-row"]',
      'ms-prompt-card', 'ms-library-card', 'ms-history-item',
      '[role="listitem"]', '[role="row"]', '[role="option"]',
      'a[href*="/prompts/"]', 'a[href*="/prompt/"]',
      'mat-card', 'mat-list-item',
    ];
    entrySelectors.forEach(sel => {
      const found = document.querySelectorAll(sel);
      if (found.length > 0) {
        log('  "' + sel + '" → ' + found.length + ' match(es)');
        found.forEach((f, fi) => {
          if (fi < 5) log('    [' + fi + '] ' + describeEl(f, 80));
        });
      }
    });
    log('');

    // ── Section 4: All <a> links containing /prompts/ ────────────────────
    log('── SECTION 4: ALL LINKS TO PROMPTS ──');
    const promptLinks = document.querySelectorAll('a[href*="/prompts/"]');
    log('  Total prompt links: ' + promptLinks.length);
    promptLinks.forEach((a, i) => {
      if (i < 20) {
        const href = a.getAttribute('href') || '';
        const text = (a.textContent || '').trim().substring(0, 80).replace(/\n/g, '\\n');
        log('  [' + i + '] href="' + href + '" text="' + text + '"');
        log('       parent: ' + describeEl(a.parentElement, 60));
      }
    });
    if (promptLinks.length > 20) log('  ... (' + (promptLinks.length - 20) + ' more)');
    log('');

    // ── Section 5: Scrollable area detection ─────────────────────────────
    log('── SECTION 5: SCROLLABLE AREAS ──');
    document.querySelectorAll('*').forEach(el => {
      if (el.scrollHeight > el.clientHeight + 50) {
        const s = getComputedStyle(el);
        if (/(auto|scroll)/.test(s.overflow + s.overflowY)) {
          const tag = el.tagName.toLowerCase();
          const cls = el.className && typeof el.className === 'string'
            ? el.className.trim().substring(0, 60) : '';
          log('  <' + tag + '> class="' + cls + '" scrollH=' + el.scrollHeight +
            ' clientH=' + el.clientHeight);
        }
      }
    });
    log('');

    // ── Section 6: Full tree dump of the main content area ───────────────
    log('── SECTION 6: MAIN CONTENT AREA TREE (depth=5) ──');
    // Try to find the main content container
    const mainCandidates = [
      'main', '[role="main"]', '.main-content', '.library-content',
      'ms-library', 'ms-prompt-list', 'ms-prompt-history-v3',
      '.prompt-list-container', '.library-container',
    ];
    let mainEl = null;
    for (const sel of mainCandidates) {
      mainEl = document.querySelector(sel);
      if (mainEl) { log('  Found main via: "' + sel + '"'); break; }
    }
    if (!mainEl) {
      // Fallback: use the <router-outlet> sibling
      const outlet = document.querySelector('router-outlet');
      if (outlet && outlet.nextElementSibling) {
        mainEl = outlet.nextElementSibling;
        log('  Found main via router-outlet sibling');
      }
    }
    if (mainEl) {
      log('');
      dumpTree(mainEl, 0, 5);
    } else {
      log('  Could not find main content area');
    }
    log('');

    // ── Section 7: Tree dump of first few prompt entries ─────────────────
    log('── SECTION 7: DETAILED DUMP OF FIRST 3 PROMPT ENTRIES (depth=6) ──');

    // Try several strategies to find prompt entries
    const entries = document.querySelectorAll(
      'a[href*="/prompts/"], [role="listitem"], [class*="prompt-card"], ' +
      '[class*="prompt-item"], [class*="library-item"], mat-list-item, mat-card'
    );

    // Deduplicate (some entries might be nested inside each other)
    const seen = new Set();
    const uniqueEntries = [];
    entries.forEach(e => {
      if (!seen.has(e)) {
        seen.add(e);
        uniqueEntries.push(e);
      }
    });

    log('  Found ' + uniqueEntries.length + ' candidate entries');
    log('');

    uniqueEntries.slice(0, 3).forEach((entry, i) => {
      log('▼▼▼ ENTRY ' + i + ' ▼▼▼');
      dumpTree(entry, 0, 6);
      log('▲▲▲ END ENTRY ' + i + ' ▲▲▲');
      log('');
    });

    // ── Section 8: Page metadata ─────────────────────────────────────────
    log('── SECTION 8: PAGE METADATA ──');
    log('  document.title = "' + document.title + '"');
    log('  Total elements on page: ' + document.querySelectorAll('*').length);
    log('  Body direct children: ' + document.body.children.length);
    Array.from(document.body.children).forEach(c => {
      log('    ' + describeEl(c, 50));
    });

    log('');
    log('═══════════════════════════════════════════════════════════════');
    log('  DONE');
    log('═══════════════════════════════════════════════════════════════');

    downloadFile(lines.join('\n'), 'library_dom_report_' + Date.now() + '.txt');
    overlay.textContent = '✅ Done! Report downloaded & logged to console.';
    await sleep(3000);
  } catch (err) {
    log('FATAL: ' + err.message);
    log(err.stack);
    downloadFile(lines.join('\n'), 'library_dom_report_ERROR.txt');
    overlay.textContent = '❌ ' + err.message;
    await sleep(4000);
  } finally {
    overlay.remove();
  }
})();
