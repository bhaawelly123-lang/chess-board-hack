// SPDX-License-Identifier: GPL-3.0-only
(() => {
  'use strict';

  const FILES = 'abcdefgh';
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  const NAMES = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  const GLYPHS = Object.fromEntries(Array.from('♔♕♖♗♘♙♚♛♜♝♞♟', (v, i) => [v, 'KQRBNPkqrbnp'[i]]));
  const KNOWN = 'cg-board,wc-chess-board,chess-board,#board-single,.board-b72b1';
  const HINT = '[fen],[data-fen],[data-chessboard],.chessboard,.chess-board,.board,[role="grid"],[id$="-board"]';
  const BOARD_HINTS = KNOWN + ',' + HINT;
  const FIRST_SQUARE = '[data-square="a1"],[square="a1"],[class~="square-a1"],[aria-label*="a1" i],[data-key="a1"]';
  const SQUARES = '[data-square],[data-key],[square],[class*="square-"],[role="gridcell"],[aria-label],[alt]';
  const PIECES = 'piece,.piece,[data-piece],img,[aria-label],[alt],[role="gridcell"],[data-square],[square],[class*="square-"]';
  const parent = node => node?.parentElement || node?.getRootNode()?.host || null;
  const attr = (el, name) => el.getAttribute(name) || '';
  const names = el => Array.from(el.classList);
  const color = value => ({ white: 'w', black: 'b', w: 'w', b: 'b' })[String(value).toLowerCase()];
  const colored = (role, side) => side === 'w' ? role.toUpperCase() : role.toLowerCase();
  const squarePattern = /^[a-h][1-8]$/;

  // Index each document or open shadow tree once. Subsequent lookups visit
  // only board candidates and shadow hosts, even on busy non-chess pages.
  const indexes = new WeakMap();
  function index(scope) {
    let state = indexes.get(scope);
    if (!state) {
      state = { candidates: new Set(), corners: new Set(), hosts: new Set(), probed: 0 };
      function remember(el) {
        if (el.hasAttribute('data-chess-arrows-ui')) {
          state.candidates.delete(el); state.corners.delete(el); state.hosts.delete(el);
          return;
        }
        for (const [set, selector] of [[state.candidates, BOARD_HINTS], [state.corners, FIRST_SQUARE]]) {
          if (el.matches(selector)) set.add(el); else set.delete(el);
        }
        if (el.shadowRoot || el.localName.includes('-')) state.hosts.add(el);
      }
      function scan(node) {
        if (node.nodeType === 1) remember(node);
        for (const el of node.querySelectorAll('*')) remember(el);
      }
      state.update = records => {
        for (const record of records) {
          if (record.type === 'attributes') remember(record.target);
          else for (const node of record.addedNodes) if (node.nodeType === 1) scan(node);
        }
      };
      state.observer = new MutationObserver(state.update);
      state.observer.observe(scope, { subtree: true, childList: true, attributes: true,
        attributeFilter: ['class','id','role','fen','data-fen','data-chessboard','data-square','square','data-key','aria-label','data-chess-arrows-ui'] });
      scan(scope);
      state.probed = Date.now();
      indexes.set(scope, state);
    }
    state.update(state.observer.takeRecords());
    // Attaching a shadow root to an existing ordinary div produces no DOM
    // mutation. Custom elements are already tracked; refresh rarer native hosts.
    if (Date.now() - state.probed > 60000) {
      for (const el of scope.querySelectorAll('*')) if (el.shadowRoot && !el.hasAttribute('data-chess-arrows-ui')) state.hosts.add(el);
      state.probed = Date.now();
    }
    return state;
  }
  function indexed(scope, name) {
    const tree = scope.getRootNode();
    const set = index(tree)[name];
    const found = [];
    for (const node of set) {
      if (node.getRootNode() !== tree) set.delete(node);
      else if (scope === tree || scope.contains(node)) found.push(node);
    }
    return found;
  }
  function roots(root) {
    const found = [root];
    for (let i = 0; i < found.length; i++) {
      for (const node of indexed(found[i], 'hosts')) {
        if (node.shadowRoot) found.push(node.shadowRoot);
      }
    }
    return found;
  }

  function drawn(el) {
    if (el.matches('body,html,input,textarea,option,select,script,pre,code,[hidden]')) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 32 && r.height >= 32 && Math.abs(1 - r.width / r.height) < 0.18 &&
      getComputedStyle(el).visibility !== 'hidden';
  }

  function square(el) {
    for (const key of ['data-square', 'square', 'data-key']) {
      const value = attr(el, key).toLowerCase();
      if (squarePattern.test(value)) return value;
    }
    for (const c of names(el)) {
      let m = /^square-([1-8])([1-8])$/.exec(c);
      if (m) return FILES[Number(m[1]) - 1] + m[2];
      m = /^square-([a-h][1-8])$/.exec(c);
      if (m) return m[1];
    }
    const label = attr(el, 'aria-label') || attr(el, 'alt');
    return label.match(/\b([a-h][1-8])\b/i)?.[1].toLowerCase();
  }

  function findBoards(root = document) {
    const marked = new Set();
    for (const scope of roots(root)) {
      for (const el of indexed(scope, 'candidates')) {
        if (!drawn(el)) continue;
        if (el.matches(KNOWN) || readBoard(el)) marked.add(el);
      }
      // An unlabelled widget can still expose 64 named squares in row wrappers.
      for (const first of indexed(scope, 'corners')) {
        if (square(first) !== 'a1') continue;
        for (let el = first.parentElement; el && !el.matches('body,html'); el = el.parentElement) {
          if (marked.has(el)) break;
          if (!drawn(el)) continue;
          const coords = new Set(Array.from(el.querySelectorAll(SQUARES), square).filter(Boolean));
          if (coords.size === 64 && readBoard(el)) { marked.add(el); break; }
        }
      }
    }
    // A FEN wrapper sometimes contains the actual board. Prefer the innermost grid.
    const outer = new Set();
    for (const el of marked) for (let p = parent(el); p; p = parent(p)) if (marked.has(p)) outer.add(p);
    return Array.from(marked).filter(el => !outer.has(el));
  }

  function metadataNodes(board) {
    const nodes = [board];
    const rect = board.getBoundingClientRect();
    for (let p = parent(board); p && !p.matches('html,body'); p = parent(p)) {
      const other = p.getBoundingClientRect();
      const close = ['left', 'top', 'width', 'height'].every(k => Math.abs(rect[k] - other[k]) <= 8);
      if (!close && !p.matches('cg-container,.cg-wrap')) break;
      nodes.push(p);
    }
    return nodes;
  }

  function orientation(board) {
    for (const node of metadataNodes(board)) {
      const side = color(attr(node, 'orientation') || attr(node, 'data-orientation') || attr(node, 'data-board-orientation'));
      if (side) return side === 'w' ? 'white' : 'black';
      if (node.matches('.flipped,.board-flipped,.orientation-black,[flipped]:not([flipped="false"]),[data-flipped="true"]')) return 'black';
      if (node.matches('.orientation-white')) return 'white';
    }
    const rect = board.getBoundingClientRect();
    for (const scope of roots(board)) {
      for (const corner of scope.querySelectorAll('[data-square="a1"],[data-square="h8"],.square-a1,.square-h8,[aria-label*="a1" i],[aria-label*="h8" i]')) {
        const key = square(corner);
        if (key !== 'a1' && key !== 'h8') continue;
        const cell = corner.getBoundingClientRect();
        const x = (cell.left + cell.width / 2 - rect.left) / rect.width;
        const y = (cell.top + cell.height / 2 - rect.top) / rect.height;
        if (!cell.width || !cell.height) continue;
        if (x < .2 && y > .8) return key === 'a1' ? 'white' : 'black';
        if (x > .8 && y < .2) return key === 'a1' ? 'black' : 'white';
      }
    }
    return 'white';
  }

  function pieceOf(el) {
    const code = attr(el, 'data-piece');
    const declaredSide = color(attr(el, 'data-color') || attr(el, 'data-piece-color'));
    if (/^[prnbqk]$/i.test(code)) return declaredSide ? colored(code, declaredSide) : code;
    const classes = names(el);
    const filename = attr(el, 'src').split(/[?#]/)[0].split('/').pop().replace(/\.(svg|png|gif|webp)$/i, '');
    const tokens = [code, ...classes, attr(el, 'alt'), filename];
    for (const t of tokens) {
      const m = /^([wb])([prnbqk])$/i.exec(t);
      if (m) return colored(m[2], m[1].toLowerCase());
    }
    const label = [code, ...classes, attr(el, 'aria-label'), attr(el, 'alt'), filename].join(' ').toLowerCase().split(/[^a-z]+/);
    const side = declaredSide || color(label.find(t => t === 'white' || t === 'black'));
    const name = label.find(t => Object.hasOwn(NAMES, t));
    if (name && side) return colored(NAMES[name], side);
    const glyph = [...attr(el, 'aria-label')].find(c => GLYPHS[c]);
    if (glyph) return GLYPHS[glyph];
    if (el.children.length === 0 || square(el)) {
      const glyphs = el.textContent.match(/[♔-♟]/gu);
      if (glyphs?.length === 1) return GLYPHS[glyphs[0]];
    }
  }

  // Chessground places absolutely positioned pieces using pixel or percentage
  // transforms. Their rendered centers work in both modes, including when zoomed.
  function physicalSquare(node, rect, flipped) {
    const r = node.getBoundingClientRect();
    if (!r.width || !r.height || !rect.width || !rect.height) return null;
    const x = (r.left + r.width / 2 - rect.left) * 8 / rect.width - .5;
    const y = (r.top + r.height / 2 - rect.top) * 8 / rect.height - .5;
    const col = Math.round(x), row = Math.round(y);
    if (Math.abs(x - col) > .22 || Math.abs(y - row) > .22 || col < 0 || col > 7 || row < 0 || row > 7) return null;
    return FILES[flipped ? 7 - col : col] + (flipped ? row + 1 : 8 - row);
  }

  function pieceMap(board, scopes, rect, flipped) {
    const map = new Map();
    for (const scope of scopes) {
      for (const el of scope.querySelectorAll(PIECES)) {
        if (el.matches('.ghost,.fading,.captured')) continue;
        if (el.matches('piece.anim,piece.dragging,.piece.dragging')) return null;
        const symbol = pieceOf(el);
        if (!symbol) {
          if ((el.matches('piece,.piece') || attr(el, 'data-piece')) &&
              !['none', 'empty'].includes(attr(el, 'data-piece').toLowerCase())) return null;
          continue;
        }
        let key = square(el);
        for (let p = parent(el); !key && p && p !== board; p = parent(p)) key = square(p);
        if (!key && el.localName === 'piece' && board.localName === 'cg-board') key = physicalSquare(el, rect, flipped);
        if (!key || (map.has(key) && map.get(key) !== symbol)) return null;
        map.set(key, symbol);
      }
    }
    return map;
  }

  function placement(map) {
    const rows = [];
    for (let rank = 8; rank >= 1; rank--) {
      const row = Array.from(FILES, file => map.get(file + rank) || '.').join('');
      rows.push(row.replace(/\.+/g, empties => String(empties.length)));
    }
    return rows.join('/');
  }

  function validPlacement(value) {
    const rows = value.split('/');
    return rows.length === 8 && rows.every(row => /^[prnbqkPRNBQK1-8]+$/.test(row) &&
      !/\d\d/.test(row) && row.replace(/[1-8]/g, v => '.'.repeat(Number(v))).length === 8) &&
      !/[pP]/.test(rows[0] + rows[7]) && (value.match(/K/g) || []).length === 1 &&
      (value.match(/k/g) || []).length === 1;
  }

  function checkedSides(position) {
    const cells = position.replaceAll('/', '').replace(/[1-8]/g, n => '.'.repeat(Number(n)));
    const checked = new Set();
    for (const side of ['w', 'b']) {
      const king = cells.indexOf(colored('k', side));
      const kx = king % 8, ky = Math.floor(king / 8);
      for (let i = 0; i < 64; i++) {
        const p = cells[i], enemy = p !== '.' && p !== colored(p, side);
        if (!enemy) continue;
        const dx = kx - i % 8, dy = ky - Math.floor(i / 8);
        const ax = Math.abs(dx), ay = Math.abs(dy), role = p.toLowerCase();
        let attacks = false;
        if (role === 'p') attacks = ax === 1 && dy === (p === 'P' ? -1 : 1);
        if (role === 'n') attacks = ax * ay === 2;
        if (role === 'k') attacks = Math.max(ax, ay) === 1;
        const line = (role === 'b' || role === 'q') && ax === ay ||
                     (role === 'r' || role === 'q') && (!ax || !ay);
        if (line) {
          const stride = Math.sign(dx) + 8 * Math.sign(dy);
          let at = i + stride;
          while (at !== king && cells[at] === '.') at += stride;
          attacks = at === king;
        }
        if (attacks) { checked.add(side); break; }
      }
    }
    return checked;
  }

  function readFen(raw) {
    if (!raw || raw.length > 160) return null;
    const parts = raw.trim().split(/\s+/);
    if (![1, 2, 4, 6].includes(parts.length) || !validPlacement(parts[0])) return null;
    if (parts.length > 1 && !/^[wb]$/.test(parts[1])) return null;
    if (parts.length >= 4 && (!/^(-|K?Q?k?q?)$/.test(parts[2]) || !/^(-|[a-h][36])$/.test(parts[3]))) return null;
    if (parts.length === 6 && (!/^\d{1,6}$/.test(parts[4]) || !/^[1-9]\d{0,5}$/.test(parts[5]))) return null;
    return parts;
  }

  function lastMove(board, scopes, rect, flipped, pieces) {
    const explicit = scopes.flatMap(scope => [...scope.querySelectorAll('square.last-move,.last-move[data-square],.highlight.last-move')]);
    let marks = explicit;
    if (!marks.length && board.matches('wc-chess-board,#board-single,chess-board')) {
      marks = scopes.flatMap(scope => [...scope.querySelectorAll('.highlight')]);
      // Selected squares and custom annotations share the highlight class.
      // Accept only one matching pair with a possible move between the cells.
      if (marks.some(el => !names(el).every(c => c === 'highlight' || /^square-[1-8][1-8]$/.test(c)))) return null;
      if (scopes.some(scope => scope.querySelector('.selected,.dragging,[aria-selected="true"]'))) return null;
      if (marks.length === 2 && getComputedStyle(marks[0]).backgroundColor !== getComputedStyle(marks[1]).backgroundColor) return null;
    }
    if (marks.length !== 2) return null;
    const keys = marks.map(mark => square(mark) || (board.localName === 'cg-board' && physicalSquare(mark, rect, flipped)));
    if (!keys.every(Boolean) || keys[0] === keys[1]) return null;
    const dest = keys.find(key => pieces.has(key)), from = keys.find(key => !pieces.has(key));
    if (!dest || !from) return null;
    const moved = pieces.get(dest), role = moved.toLowerCase();
    const dx = Math.abs(FILES.indexOf(dest[0]) - FILES.indexOf(from[0]));
    const dy = Number(dest[1]) - Number(from[1]), ay = Math.abs(dy);
    if (!explicit.length) {
      const forward = moved === 'P' ? 1 : -1;
      const possible = {
        p: (dx <= 1 && dy === forward) || (!dx && dy === 2 * forward && from[1] === (forward === 1 ? '2' : '7')),
        n: dx * ay === 2, b: dx === ay, r: !dx || !ay, q: !dx || !ay || dx === ay,
        k: Math.max(dx, ay) === 1 || (dx === 2 && !ay && from[0] === 'e')
      }[role];
      if (!possible) return null;
    }
    return { from, dest, moved };
  }

  const analysisLinks = new WeakMap();
  function startingFenFromLink(board, placement, turn) {
    const url = new URL(board.ownerDocument.URL);
    if (!url.pathname.startsWith('/analysis')) return null;
    let raw;
    if (/(^|\.)chess\.com$/.test(url.hostname) && board.matches('wc-chess-board,#board-single')) raw = url.searchParams.get('fen');
    if (url.hostname === 'lichess.org' && board.matches('cg-board')) {
      try { raw = decodeURIComponent(url.pathname.replace(/^\/analysis\/(standard\/)?/, '')).replaceAll('_', ' '); }
      catch { return null; }
    }
    if (!raw) return null;
    const parsed = globalThis.ChessArrowsPosition.parseFen(raw);
    if (!parsed) return null;
    let seed = analysisLinks.get(board);
    if (seed?.fen !== parsed.fen) { seed = {fen:parsed.fen,matched:false,expired:false}; analysisLinks.set(board,seed); }
    if (parsed.fen.split(' ')[0] !== placement || (turn && parsed.turn !== turn)) {
      if (seed.matched) seed.expired = true;
      return null;
    }
    if (seed.expired) return null;
    seed.matched = true;
    return {fen:parsed.fen,turnKnown:true,completeState:true};
  }

  function readBoard(board) {
    const meta = metadataNodes(board);
    let parts = null;
    for (const node of meta) {
      const raw = attr(node, 'fen') || attr(node, 'data-fen') || (node.localName === 'chess-board' && attr(node, 'position'));
      if (raw && (parts = readFen(raw))) break;
    }
    if (parts?.length >= 4) {
      if (checkedSides(parts[0]).has(parts[1] === 'w' ? 'b' : 'w')) return null;
      return { fen: (parts.length === 4 ? [...parts, '0', '1'] : parts).join(' '), turnKnown: true, completeState: true };
    }
    let side = parts?.[1];
    for (const node of meta) {
      side ||= color(attr(node, 'data-turn') || attr(node, 'turn') || attr(node, 'data-side-to-move') || attr(node, 'data-turn-color'));
      const ply = attr(node, 'data-ply');
      if (!side && /^\d{1,5}$/.test(ply)) side = Number(ply) % 2 ? 'b' : 'w';
    }
    const rect = board.getBoundingClientRect();
    const flipped = orientation(board) === 'black';
    const scopes = roots(board);
    let position = parts?.[0];
    let ep = '-';
    if (!position) {
      const pieces = pieceMap(board, scopes, rect, flipped);
      if (!pieces) return null;
      position = placement(pieces);
      if (!validPlacement(position)) return null;
      const move = lastMove(board, scopes, rect, flipped, pieces);
      if (move) {
        const { from, dest, moved } = move;
        const next = moved === moved.toUpperCase() ? 'b' : 'w';
        if (!side || side === next) {
          side = next;
          if (moved === 'P' && from === dest[0] + '2' && dest[1] === '4') ep = dest[0] + '3';
          if (moved === 'p' && from === dest[0] + '7' && dest[1] === '5') ep = dest[0] + '6';
        }
      }
    }
    // A checked king must take the next move. Sending a position where
    // the opponent's king can be captured is unsafe for a chess engine.
    const checked = checkedSides(position);
    if (checked.size > 1 || (side && checked.has(side === 'w' ? 'b' : 'w'))) return null;
    if (checked.size === 1) [side] = checked;
    const fromLink = startingFenFromLink(board,position,side);
    if (fromLink) return fromLink;
    if (position === START) side ||= 'w';
    const rights = position === START && side === 'w' ? 'KQkq' : '-';
    return { fen: [position, side || 'w', rights, ep, '0', '1'].join(' '), turnKnown: Boolean(side), completeState: false };
  }

  globalThis.ChessArrowsBoards = { findBoards, readBoard, orientation };
})();
