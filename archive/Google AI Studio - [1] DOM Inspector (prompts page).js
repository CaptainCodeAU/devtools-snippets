// =============================================================================
// AI Studio Prompts Page DOM Inspector — Focused on content structure
// =============================================================================
// Dumps the FULL HTML tree of ONE model turn to show exactly how
// headings, lists, paragraphs, and code blocks are nested.
// Run on the same conversation. Downloads a .txt report.
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
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)', border: '1px solid #333'
  });
  overlay.textContent = '🔍 Inspecting content structure...';
  document.body.appendChild(overlay);

  const lines = [];
  const log = (...args) => { const l = args.join(' '); lines.push(l); console.log(l); };

  // Dump the FULL HTML tree with indentation, showing tag + class + short text
  const dumpHTML = (node, indent = 0, maxDepth = 12) => {
    const pad = '  '.repeat(indent);

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (text) {
        const preview = text.substring(0, 120).replace(/\n/g, '\\n');
        log(pad + '#text "' + preview + (text.length > 120 ? '…' : '') + '"');
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (indent > maxDepth) { log(pad + '... (depth limit)'); return; }

    const tag = node.tagName.toLowerCase();
    const cls = node.className && typeof node.className === 'string'
      ? node.className.trim().split(/\s+/).slice(0, 4).join('.') : '';
    const clsStr = cls ? '.' + cls : '';
    const childCount = node.children.length;
    const attrs = [];
    if (node.getAttribute('data-turn-role')) attrs.push('data-turn-role="' + node.getAttribute('data-turn-role') + '"');
    if (node.getAttribute('data-lang')) attrs.push('data-lang="' + node.getAttribute('data-lang') + '"');
    const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';

    log(pad + '<' + tag + clsStr + attrStr + '>' + (childCount > 0 ? ' [' + childCount + ' children]' : ''));

    Array.from(node.childNodes).forEach(child => dumpHTML(child, indent + 1, maxDepth));
  };

  try {
    log('═══════════════════════════════════════════════════════════════');
    log('  CONTENT STRUCTURE INSPECTION');
    log('  Time: ' + new Date().toISOString());
    log('═══════════════════════════════════════════════════════════════');
    log('');

    // Find the last model turn (likely the big blueprint one)
    // We'll dump the second-to-last model turn (the big content one)
    const allTurns = document.querySelectorAll('ms-chat-turn');
    log('Total turns: ' + allTurns.length);

    // Find a model turn with substantial content — scroll it into view
    // Target: the last model turn (turn index = last)
    const targetIdx = allTurns.length - 1;  // last turn
    const target = allTurns[targetIdx];

    if (!target) {
      log('ERROR: No target turn found');
      downloadFile(lines.join('\n'), 'content_structure_ERROR.txt');
      overlay.remove();
      return;
    }

    target.scrollIntoView({ behavior: 'instant', block: 'center' });
    await sleep(600);

    // Re-query
    const freshTarget = document.querySelectorAll('ms-chat-turn')[targetIdx];

    log('');
    log('── TARGET TURN (index ' + targetIdx + ') ──');
    log('Turn ID: ' + freshTarget.id);
    log('');

    // Dump the FULL tree of the text-chunk area
    log('── SECTION A: ms-prompt-chunk.text-chunk subtree ──');
    const textChunk = freshTarget.querySelector('ms-prompt-chunk.text-chunk');
    if (textChunk) {
      dumpHTML(textChunk, 0, 12);
    } else {
      log('  NOT FOUND — ms-prompt-chunk.text-chunk');
      log('  Falling back to .turn-content');
      const tc = freshTarget.querySelector('.turn-content');
      if (tc) dumpHTML(tc, 0, 12);
    }

    log('');
    log('── SECTION B: thought-panel subtree (if any) ──');
    const thoughtPanel = freshTarget.querySelector('mat-expansion-panel.thought-panel');
    if (thoughtPanel) {
      // Expand it first
      if (!thoughtPanel.classList.contains('mat-expanded')) {
        const h = thoughtPanel.querySelector('mat-expansion-panel-header');
        if (h) try { h.click(); } catch(e) {}
        await sleep(400);
      }
      const freshThought = document.querySelectorAll('ms-chat-turn')[targetIdx]
        .querySelector('mat-expansion-panel.thought-panel');
      if (freshThought) dumpHTML(freshThought, 0, 10);
    } else {
      log('  No thought-panel found');
    }

    // Also dump a SECOND turn (a shorter model turn near the start)
    // to see if shorter turns have different structure
    log('');
    log('═══════════════════════════════════════════════════════════════');
    log('');

    // Find turn 1 (first model turn, should be index 1)
    if (allTurns.length > 1) {
      const earlyTarget = allTurns[1];
      earlyTarget.scrollIntoView({ behavior: 'instant', block: 'center' });
      await sleep(600);
      const freshEarly = document.querySelectorAll('ms-chat-turn')[1];

      log('── SECOND SAMPLE: TURN 1 (first model turn) ──');
      log('Turn ID: ' + freshEarly.id);
      log('');

      const tc2 = freshEarly.querySelector('ms-prompt-chunk.text-chunk');
      if (tc2) {
        dumpHTML(tc2, 0, 12);
      }

      // Also its thought panel
      const tp2 = freshEarly.querySelector('mat-expansion-panel.thought-panel');
      if (tp2) {
        log('');
        log('── TURN 1 thought-panel ──');
        if (!tp2.classList.contains('mat-expanded')) {
          const h = tp2.querySelector('mat-expansion-panel-header');
          if (h) try { h.click(); } catch(e) {}
          await sleep(400);
        }
        const freshTp2 = document.querySelectorAll('ms-chat-turn')[1]
          .querySelector('mat-expansion-panel.thought-panel');
        if (freshTp2) dumpHTML(freshTp2, 0, 10);
      }
    }

    log('');
    log('═══════════════════════════════════════════════════════════════');
    log('  DONE');
    log('═══════════════════════════════════════════════════════════════');

    downloadFile(lines.join('\n'), 'content_structure_' + Date.now() + '.txt');
    overlay.textContent = '✅ Done! Report downloaded.';
    await sleep(3000);
  } catch (err) {
    log('FATAL: ' + err.message);
    log(err.stack);
    downloadFile(lines.join('\n'), 'content_structure_ERROR.txt');
    overlay.textContent = '❌ ' + err.message;
    await sleep(4000);
  } finally {
    overlay.remove();
  }
})();
