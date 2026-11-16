// SPDX-License-Identifier: GPL-3.0-only
(() => {
  'use strict';
  const initial = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  const corners = { K: 63, Q: 56, k: 7, q: 0 };
  const opposite = side => side === 'w' ? 'b' : 'w';
  const sideOf = piece => piece === piece.toUpperCase() ? 'w' : 'b';
  const name = i => 'abcdefgh'[i % 8] + (8 - (i >> 3));
  const expand = rankText => rankText.replaceAll('/', '').replace(/[1-8]/g, n => '.'.repeat(+n)).split('');
  const compress = grid => grid.join('').match(/.{8}/g).map(row => row.replace(/\.+/g, x => x.length)).join('/');
  const valid = (placement, side) => Boolean(globalThis.ChessArrowsPosition.parseFen(placement + ' ' + side + ' - - 0 1'));

  function possibleRights(grid) {
    return Object.keys(corners).filter(right => {
      const white = right === right.toUpperCase();
      return grid[white ? 60 : 4] === (white ? 'K' : 'k') && grid[corners[right]] === (white ? 'R' : 'r');
    }).join('');
  }

  function afterMove(rights, move) {
    return [...rights].filter(right => {
      const king = right === right.toUpperCase() ? 'K' : 'k';
      return move.piece !== king && move.from !== corners[right] && move.to !== corners[right];
    }).join('');
  }

  function canCastle(prev, move, grid) {
    const {from, to, side} = move;
    const white = side === 'w', rightward = to > from;
    const right = white ? (rightward ? 'K' : 'Q') : (rightward ? 'k' : 'q');
    const rook = corners[right], step = rightward ? 1 : -1;
    if (from !== (white ? 60 : 4) || !prev.possible.includes(right)) return false;
    for (let sq = from + step; sq !== rook; sq += step) if (grid[sq] !== '.') return false;
    const other = opposite(side);
    if (!valid(prev.fields[0], other)) return false; // Cannot castle out of check.
    grid[from] = '.';
    grid[from + step] = move.piece;
    if (!valid(compress(grid), other)) return false; // Or through check.
    grid[from + step] = grid[rook];
    grid[rook] = '.';
    return true;
  }

  function matchesMove(prev, next, move) {
    const {from, to, side, piece} = move;
    const grid = prev.grid.slice();
    const occupant = grid[to];
    if (occupant !== '.' && (sideOf(occupant) === side || occupant.toLowerCase() === 'k')) return false;
    const dx = to % 8 - from % 8, dy = (to >> 3) - (from >> 3);
    const x = Math.abs(dx), y = Math.abs(dy), role = piece.toLowerCase();
    const promoted = role === 'p' && (to < 8 || to >= 56);
    if (promoted ? !'qrbn'.includes(next[to].toLowerCase()) : piece !== next[to]) return false;
    if (role === 'p') {
      const dir = side === 'w' ? -1 : 1;
      if (!x && dy === 2 * dir) {
        if ((from >> 3) !== (side === 'w' ? 6 : 1) || occupant !== '.' || grid[from + 8 * dir] !== '.') return false;
        move.ep = name(from + 8 * dir);
      } else if (dy !== dir || x > 1 || (!x && occupant !== '.')) return false;
      else if (x && occupant === '.') {
        if ((to >> 3) !== (side === 'w' ? 2 : 5) || (prev.epKnown && prev.fields[3] !== name(to))) return false;
        const captured = to - 8 * dir;
        if (grid[captured] !== (side === 'w' ? 'p' : 'P')) return false;
        grid[captured] = '.';
      }
    } else if (role === 'k') {
      if (x === 2 && !y) {
        if (!canCastle(prev, move, grid)) return false;
      } else if (Math.max(x, y) !== 1) return false;
    } else if (role === 'n') {
      if (x * y !== 2) return false;
    } else {
      const diagonal = x === y && 'bq'.includes(role);
      const straight = (!x || !y) && 'rq'.includes(role);
      if (!diagonal && !straight) return false;
      const step = 8 * Math.sign(dy) + Math.sign(dx);
      for (let sq = from + step; sq !== to; sq += step) if (grid[sq] !== '.') return false;
    }
    grid[from] = '.';
    grid[to] = next[to];
    move.resetClock = role === 'p' || occupant !== '.';
    return grid.every((p, i) => next[i] === p);
  }

  function singleMove(prev, fields, turnKnown, grid) {
    const changed = grid.map((p, i) => p !== prev.grid[i] ? i : -1).filter(i => i >= 0);
    if (changed.length < 2 || changed.length > 4) return null;
    for (const from of changed) {
      if (grid[from] !== '.' || prev.grid[from] === '.') continue;
      const piece = prev.grid[from], side = sideOf(piece), other = opposite(side);
      if ((prev.turnKnown && prev.fields[1] !== side) || (turnKnown && fields[1] !== other)) continue;
      if (!valid(prev.fields[0], side) || !valid(fields[0], other)) continue;
      for (const to of changed) {
        if (grid[to] === '.' || sideOf(grid[to]) !== side) continue;
        const move = {from, to, piece, side, ep: '-'};
        if (matchesMove(prev, grid, move)) return move;
      }
    }
    return null;
  }

  function create() {
    let prev = null;
    function read(snapshot) {
      if (!snapshot?.fen) return null; // A board may be temporarily unreadable during animation.
      const fields = snapshot.fen.split(' '), grid = expand(fields[0]);
      let turnKnown = Boolean(snapshot.turnKnown);
      const full = snapshot.completeState || (fields[0] === initial && fields[1] === 'w');
      let possible = full ? fields[2].replace('-', '') : possibleRights(grid);
      let epKnown = full || fields[3] !== '-';

      if (prev && !snapshot.completeState) {
        if (fields[0] === prev.fields[0]) {
          if (!turnKnown || !prev.turnKnown || fields[1] === prev.fields[1]) {
            fields[1] = turnKnown ? fields[1] : prev.fields[1];
            turnKnown ||= prev.turnKnown;
            if (fields[3] === '-') fields[3] = prev.fields[3];
            fields[2] = prev.fields[2];
            fields[4] = prev.fields[4];
            fields[5] = prev.fields[5];
            possible = prev.possible;
            epKnown ||= prev.epKnown;
          }
        } else {
          const move = singleMove(prev, fields, turnKnown, grid);
          if (move) {
            fields[1] = opposite(move.side);
            fields[2] = afterMove(prev.fields[2].replace('-', ''), move) || '-';
            fields[3] = move.ep;
            fields[4] = String(move.resetClock ? 0 : Math.min(999999, Number(prev.fields[4]) + 1));
            fields[5] = String(Math.min(999999, Number(prev.fields[5]) + Number(move.side === 'b')));
            possible = afterMove(prev.possible, move);
            turnKnown = epKnown = true;
          }
          // A jump to an unrelated diagram starts from the new snapshot's metadata.
        }
      }
      prev = {fields, grid, possible, epKnown, turnKnown};
      return {...snapshot, fen: fields.join(' '), turnKnown};
    }
    return {read, reset() { prev = null; }};
  }

  globalThis.ChessArrowsHistory = {create};
})();
