// SPDX-License-Identifier: GPL-3.0-only
(() => {
  'use strict';
  const boards = globalThis.ChessArrowsBoards;
  const {parseFen} = globalThis.ChessArrowsPosition;
  const history = globalThis.ChessArrowsHistory.create();
  const files = 'abcdefgh';
  let candidates = [], board = null, manualRegion = null, manualFen = '';
  let host, shadow, panel, details, status, svg, line, picker, outline, fenField;
  let turnSelect, viewSelect, nextButton, cancelPick, useAuto, resizeObserver, boardObserver;
  let port, requestId = 0, lastFen = '', bestMove = '', evaluation = '';
  let quiet = false, forced = false, readTimer, drawFrame, retryTimer, picking = false;
  let turnForPlacement = '';
  const number = new Intl.NumberFormat('en', {minimumFractionDigits: 2, maximumFractionDigits: 2});

  function createUI() {
    if (host?.isConnected) return;
    host = document.createElement('div');
    host.dataset.chessArrowsUi = '';
    host.lang = 'en';
    host.dir = 'ltr';
    // Keep the arrow fixed to the viewport without touching the site's board layout.
    for (const [key, value] of Object.entries({
      all:'initial', position:'fixed', inset:'0', display:'block', 'pointer-events':'none',
      'z-index':'2147483647', width:'100%', height:'100%', overflow:'visible'
    })) host.style.setProperty(key, value, 'important');
    shadow = host.attachShadow({mode:'open'});
    shadow.innerHTML = `
      <style>
        *{box-sizing:border-box} [hidden]{display:none!important}
        svg{position:absolute;overflow:visible;pointer-events:none}
        .panel{direction:ltr;position:absolute;inset:auto 10px 10px auto;max-width:calc(100vw - 20px);
          width:max-content;color:#eef4f0;background:#17241e;border:1px solid #486454;border-radius:10px;
          padding:6px 8px;box-shadow:0 2px 12px #0004;pointer-events:auto;
          font:14px/1.45 system-ui,sans-serif;color-scheme:dark;max-height:calc(100vh - 20px);overflow:auto}
        .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
        output{max-width:48ch;overflow-wrap:anywhere}
        button,select,input{font:inherit} button,select{color:#f4fbf6;background:#294537;
          border:1px solid #648372;border-radius:5px;padding:3px 7px;cursor:pointer}
        button:hover{background:#385b48} button:focus-visible,select:focus-visible,input:focus-visible
          {outline:2px solid #a4e7b7;outline-offset:2px}
        .details{margin-top:6px;padding-top:7px;border-top:1px solid #486454;max-width:30rem}
        label{display:inline-flex;gap:4px;align-items:center} .fen{display:flex;flex:1 0 100%;margin:6px 0}
        input{min-width:0;width:100%;color:#fbfffa;background:#101b15;border:1px solid #648372;
          border-radius:4px;padding:4px;direction:ltr;text-align:left}
        .picker{position:absolute;inset:0;cursor:crosshair;pointer-events:auto;touch-action:none;background:#10201726}
        .hint{display:block;position:absolute;inset:12px auto auto 50%;transform:translateX(-50%);
          width:max-content;max-width:90vw;padding:8px 13px;border-radius:7px;background:#17241e;color:white;
          direction:ltr;font:15px/1.5 system-ui,sans-serif;pointer-events:none}
        .rect{position:absolute;border:2px solid #65ea90;background:#2bbf6624;pointer-events:none}
        .editor{padding-top:6px}.setup-board{display:grid;grid-template-columns:repeat(8,1fr);width:min(232px,65vw);
          aspect-ratio:1;margin:6px auto;border:1px solid #83988a}
        .setup-board button{position:relative;border:0;border-radius:0;padding:0;color:#18261e;line-height:1;
          font-family:"Segoe UI Symbol",sans-serif;font-size:clamp(14px,5vw,23px);cursor:crosshair}
        .setup-board .light{background:#e4eee4}.setup-board .dark{background:#99b79f}
        .setup-board button::after{content:attr(data-tile);position:absolute;bottom:0;right:1px;font:7px/1 sans-serif}
      </style>
      <svg data-arrow hidden aria-hidden="true" viewBox="0 0 800 800" preserveAspectRatio="none">
        <defs><marker id="tip" viewBox="0 0 10 10" markerWidth="3.7" markerHeight="3.7" refX="8" refY="5" orient="auto">
          <path d="M0 0 L10 5 L0 10 L2.6 5 Z" fill="#18ba66"/></marker></defs>
        <line stroke="#18ba66" stroke-opacity="0.94" stroke-width="11" stroke-linecap="round" marker-end="url(#tip)"/>
      </svg>
      <section class="panel" aria-label="Chess arrows" lang="en" dir="ltr">
        <div class="row"><output data-status></output><button type="button" data-settings aria-expanded="false">Settings</button></div>
        <div class="details" hidden>
          <div class="row">
            <label>Side to move <select name="turn"><option value="auto">Auto-detect</option><option value="w">White</option><option value="b">Black</option></select></label>
            <label>Bottom side <select name="view"><option value="auto">Auto-detect</option><option value="white">White</option><option value="black">Black</option></select></label>
            <button type="button" data-next hidden>Next board</button>
          </div>
          <label class="fen">FEN <input name="fen" spellcheck="false" autocomplete="off" aria-label="Full FEN position" placeholder="Paste a full FEN position"></label>
          <div class="row">
            <button type="button" data-apply>Analyze FEN</button><button type="button" data-pick>Select board area</button>
            <button type="button" data-edit>Set up pieces</button>
            <button type="button" data-auto hidden>Resume automatic detection</button>
            <button type="button" data-hide>Hide</button>
          </div><div class="editor" hidden></div>
        </div>
      </section>
      <div class="picker" hidden><span class="hint">Drag from one corner of the board to the opposite corner. Press Esc to cancel.</span><div class="rect" hidden></div></div>`;
    document.documentElement.append(host);
    const find = sel => shadow.querySelector(sel);
    panel = find('.panel'); details = find('.details'); status = find('[data-status]');
    svg = find('svg'); line = find('line'); picker = find('.picker'); outline = find('.rect');
    turnSelect = find('[name=turn]'); viewSelect = find('[name=view]'); fenField = find('[name=fen]');
    nextButton = find('[data-next]'); useAuto = find('[data-auto]');
    find('[data-settings]').onclick = () => openSettings(details.hidden);
    find('[data-hide]').onclick = hide;
    viewSelect.onchange = paint;
    turnSelect.onchange = () => { turnForPlacement = ''; invalidate(); updatePosition(); };
    nextButton.onclick = () => {
      manualFen = ''; manualRegion = null; fenField.value = ''; turnSelect.value = viewSelect.value = 'auto';
      selectBoard(candidates[(candidates.indexOf(board) + 1) % candidates.length]); refresh();
    };
    find('[data-apply]').onclick = applyManualFen;
    const editor = find('.editor');
    let editorUI;
    find('[data-edit]').onclick = () => {
      editor.hidden = !editor.hidden;
      if (editor.hidden) return;
      if (!editorUI) editorUI = globalThis.ChessArrowsSetup.mount(editor, fen => {
        if (!parseFen(fen)) { say('Check the piece placement, both kings, and the side to move.'); return; }
        fenField.value = fen; editor.hidden = true; applyManualFen();
      });
      editorUI.load(parseFen(fenField.value)?.fen || lastFen);
    };
    fenField.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); applyManualFen(); } };
    useAuto.onclick = () => {
      manualFen = ''; manualRegion = null; fenField.value = ''; turnSelect.value = viewSelect.value = 'auto';
      invalidate(); refresh(); updatePosition();
    };
    find('[data-pick]').onclick = startPicker;
    // Stop site shortcuts when someone types or uses the controls.
    for (const event of ['keydown','keyup','keypress','click','pointerdown','pointerup']) {
      panel.addEventListener(event, e => e.stopPropagation());
    }
    installPicker();
  }

  function openSettings(open) {
    details.hidden = !open;
    shadow.querySelector('[data-settings]').setAttribute('aria-expanded', String(open));
  }
  function say(text) { if (status && status.textContent !== text) status.textContent = text; }
  function invalidate() {
    ++requestId; lastFen = ''; bestMove = ''; evaluation = ''; paint();
  }
  function disconnect() {
    clearTimeout(retryTimer);
    const old = port; port = null;
    if (old) old.disconnect();
  }
  function hide() {
    quiet = true; forced = false; cancelPick?.(); invalidate(); disconnect(); selectBoard(null);
    if (host) host.hidden = true;
    if (host) host.style.setProperty('display','none','important');
  }
  function applyManualFen() {
    const parsed = parseFen(fenField.value);
    if (!parsed) { say('Invalid FEN. Check the position, side to move, and castling rights.'); fenField.focus(); return; }
    manualFen = parsed.fen; turnSelect.value = 'auto'; forced = true;
    invalidate(); refresh(); updatePosition();
  }

  function activeRect() {
    if (!manualRegion) return board?.isConnected ? board.getBoundingClientRect() : null;
    const {anchor, x, y, w, h} = manualRegion;
    if (!anchor.isConnected) return null;
    const box = anchor.getBoundingClientRect();
    return {left:box.left + box.width*x, top:box.top + box.height*y, width:box.width*w, height:box.height*h};
  }
  function paint() {
    if (!svg) return;
    const rect = activeRect();
    const visible = !quiet && !!bestMove && rect && rect.width > 0 && rect.height > 0;
    svg.toggleAttribute('hidden', !visible);
    if (!visible) { delete svg.dataset.move; return; }
    const view = viewSelect.value === 'auto' ? (board && !manualRegion ? boards.orientation(board) : 'white') : viewSelect.value;
    const center = square => {
      const f = files.indexOf(square[0]), r = Number(square[1]);
      return [(view === 'black' ? 7-f : f)*100+50, (view === 'black' ? r-1 : 8-r)*100+50];
    };
    for (const [idx,sq] of [[1,bestMove.slice(0,2)], [2,bestMove.slice(2,4)]]) {
      const [x,y] = center(sq); line.setAttribute('x'+idx,x); line.setAttribute('y'+idx,y);
    }
    Object.assign(svg.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
    svg.dataset.move = bestMove;
  }
  function schedulePaint() {
    if (!bestMove || drawFrame) return;
    drawFrame = requestAnimationFrame(() => { drawFrame = 0; paint(); });
  }

  function selectBoard(newBoard) {
    if (board === newBoard) return;
    boardObserver?.disconnect(); resizeObserver?.disconnect();
    history.reset();
    board = newBoard; invalidate();
    if (!board) return;
    boardObserver = new MutationObserver(scheduleRead);
    const opts = {subtree:true,childList:true,attributes:true,characterData:true};
    boardObserver.observe(board,opts);
    if (board.shadowRoot) boardObserver.observe(board.shadowRoot,opts);
    resizeObserver = new ResizeObserver(schedulePaint);
    resizeObserver.observe(board);
  }
  function scheduleRead() {
    if (quiet || manualFen || readTimer) return;
    readTimer = setTimeout(() => { readTimer = 0; updatePosition(); },160);
  }
  function refresh() {
    if (quiet || document.hidden || picking) return;
    candidates = boards.findBoards(document);
    if (manualRegion && !manualRegion.anchor.isConnected) manualRegion = null;
    if (!candidates.includes(board)) selectBoard(candidates[0] || null);
    if (!board && !forced && !manualFen && !manualRegion) {
      if (host) { panel.hidden = true; svg.setAttribute('hidden',''); }
      disconnect(); return;
    }
    createUI(); panel.hidden = false;
    nextButton.hidden = candidates.length < 2;
    if (!nextButton.hidden) nextButton.textContent = 'Next board (' + (candidates.indexOf(board)+1) + '/' + candidates.length + ')';
    useAuto.hidden = !manualFen && !manualRegion;
    updatePosition(); paint();
  }

  function enginePort() {
    if (port) return port;
    const current = chrome.runtime.connect({name:'chess-arrows-analysis'});
    port = current; current.onMessage.addListener(handleEngine);
    current.onDisconnect.addListener(() => {
      void chrome.runtime.lastError;
      if (port !== current) return;
      port = null; invalidate();
      if (!quiet && !document.hidden) {
        say('Stockfish disconnected. Reconnecting…');
        clearTimeout(retryTimer); retryTimer = setTimeout(updatePosition,1200);
      }
    });
    return current;
  }
  function updatePosition() {
    if (quiet || !host || panel.hidden || picking || document.hidden) return;
    const snapshot = !manualFen && !manualRegion && board ? boards.readBoard(board) : null;
    const reading = manualFen ? {fen:manualFen,turnKnown:true} : snapshot && history.read(snapshot);
    if (!reading) {
      if (lastFen) invalidate();
      say(manualRegion || !board ? 'Enter a FEN or set up the pieces to analyze this board.' : 'Unable to read the pieces. Open Settings to enter a FEN or set up the pieces.');
      return;
    }
    const fields = reading.fen.split(/\s+/);
    if (turnSelect.value !== 'auto' && turnForPlacement && fields[0] !== turnForPlacement) turnSelect.value = 'auto';
    turnForPlacement = turnSelect.value === 'auto' ? '' : fields[0];
    if (turnSelect.value !== 'auto') {
      if (fields[1] !== turnSelect.value) fields[3] = '-';
      fields[1] = turnSelect.value;
    } else if (!reading.turnKnown) {
      if (lastFen) invalidate();
      say('Whose turn is it? Choose White or Black in Settings.'); return;
    }
    const parsed = parseFen(fields.join(' '));
    if (!parsed) {
      if (lastFen) invalidate();
      say('Invalid position or side to move. Check Settings.'); return;
    }
    if (parsed.fen === lastFen) return;
    invalidate(); lastFen = parsed.fen; say('Stockfish is analyzing…');
    try { enginePort().postMessage({type:'analyze',fen:lastFen,requestId}); }
    catch { disconnect(); invalidate(); say('Could not start Stockfish. Reload the page.'); }
  }
  function handleEngine(msg) {
    if (!msg || msg.requestId !== requestId || quiet) return;
    if (msg.type === 'info') {
      const score = /\bscore (cp|mate) (-?\d+)/.exec(msg.text);
      if (!score) return;
      const value = Number(score[2]) * (lastFen.split(' ')[1] === 'b' ? -1 : 1);
      evaluation = score[1] === 'mate' ? ((value < 0 ? 'Black' : 'White') + ' mates in ' + Math.abs(value))
        : 'Score for White: ' + (value > 0 ? '+' : '') + number.format(value / 100);
      return;
    }
    if (msg.type === 'error') { say(msg.message || 'Analysis failed.'); return; }
    if (msg.type !== 'bestmove') return;
    bestMove = /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(msg.move) ? msg.move : '';
    const suffix = manualFen && !activeRect() ? ' · Select the board area to draw the arrow.' : '';
    say(bestMove ? ('Best move: ' + bestMove + (evaluation ? ' · ' + evaluation : '') + suffix) : 'No legal moves in this position.');
    paint();
  }

  function installPicker() {
    let start = null;
    cancelPick = () => { picking = false; start = null; picker.hidden = true; outline.hidden = true; panel.hidden = false; window.removeEventListener('keydown',escapePick,true); paint(); };
    picker.onpointerdown = e => {
      if (e.button !== 0) return;
      e.preventDefault(); start = {x:e.clientX,y:e.clientY}; picker.setPointerCapture(e.pointerId);
      Object.assign(outline.style,{left:start.x+'px',top:start.y+'px',width:'0',height:'0'}); outline.hidden = false;
    };
    picker.onpointermove = e => {
      if (!start) return;
      Object.assign(outline.style,{left:Math.min(start.x,e.clientX)+'px',top:Math.min(start.y,e.clientY)+'px',
        width:Math.abs(start.x-e.clientX)+'px',height:Math.abs(start.y-e.clientY)+'px'});
    };
    picker.onpointerup = e => {
      if (!start) return;
      const x = Math.min(start.x,e.clientX), y = Math.min(start.y,e.clientY);
      const w = Math.abs(start.x-e.clientX), h = Math.abs(start.y-e.clientY);
      cancelPick(); openSettings(true);
      if (Math.min(w,h)<32) { say('Drag from one corner of the board to the opposite corner.'); return; }
      const under = document.elementsFromPoint(x+w/2,y+h/2).filter(el => el !== host);
      // Choose a stable ancestor that contains the whole rectangle, including boards inside an iframe.
      const parents = [];
      for (let el=under[0]; el; el=el.parentElement) parents.push(el);
      const anchor = parents.find(el => {
        const b = el.getBoundingClientRect();
        return b.width>0 && b.height>0 && b.left<=x+3 && b.top<=y+3 && b.right>=x+w-3 && b.bottom>=y+h-3;
      }) || document.documentElement;
      const box = anchor.getBoundingClientRect();
      manualRegion = {anchor,x:(x-box.left)/box.width,y:(y-box.top)/box.height,w:w/box.width,h:h/box.height};
      forced = true; invalidate(); refresh();
      if (!manualFen) { say('Board area selected. Enter a FEN or set up the pieces.'); fenField.focus(); }
    };
    picker.onpointercancel = cancelPick;
  }
  function escapePick(e) {
    if (e.key === 'Escape') { e.preventDefault(); cancelPick(); }
  }
  function startPicker() {
    picking = true; panel.hidden = true; svg.setAttribute('hidden',''); picker.hidden = false;
    window.addEventListener('keydown',escapePick,true);
  }
  chrome.runtime.onMessage.addListener(msg => {
    if (msg?.type !== 'chess-arrows-toggle') return;
    if (host && !quiet && !panel.hidden && !details.hidden) { hide(); return; }
    quiet = false; forced = true; createUI(); host.hidden = false; host.style.setProperty('display','block','important');
    refresh(); openSettings(true);
  });
  window.addEventListener('scroll',schedulePaint,{capture:true,passive:true});
  window.addEventListener('resize',schedulePaint,{passive:true});
  document.addEventListener('visibilitychange',() => {
    if (document.hidden) { invalidate(); disconnect(); }
    else refresh();
  });
  window.addEventListener('pagehide',() => { invalidate(); disconnect(); });
  window.addEventListener('pageshow',refresh);
  function poll() {
    refresh();
    setTimeout(poll, board && !quiet ? 1400 : 3000);
  }
  poll();
})();
