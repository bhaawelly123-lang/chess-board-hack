// SPDX-License-Identifier: GPL-3.0-only
(() => {
  'use strict';

  // Check the king of the side that just moved before handing a position to UCI.
  function kingIsAttacked(grid, king, byWhite) {
    const rank = Math.floor(king / 8);
    const file = king % 8;
    for (let i = 0; i < 64; i++) {
      const piece = grid[i];
      if (!piece || (piece === piece.toUpperCase()) !== byWhite) continue;
      const dr = rank - Math.floor(i / 8);
      const df = file - (i % 8);
      const ar = Math.abs(dr);
      const af = Math.abs(df);
      const type = piece.toLowerCase();
      if (type === 'p' && dr === (byWhite ? -1 : 1) && af === 1) return true;
      if (type === 'n' && ar * af === 2) return true;
      if (type === 'k' && Math.max(ar, af) === 1) return true;
      const diagonal = af > 0 && af === ar && (type === 'b' || type === 'q');
      const straight = (af === 0 || ar === 0) && (type === 'r' || type === 'q');
      if (!diagonal && !straight) continue;
      const step = 8 * Math.sign(dr) + Math.sign(df);
      let sq = i + step;
      while (sq !== king && !grid[sq]) sq += step;
      if (sq === king) return true;
    }
    return false;
  }

  function parseFen(text) {
    if (typeof text !== 'string' || text.length > 140) return null;
    const fields = text.trim().split(/\s+/);
    if (fields.length !== 6) return null;
    const [placement, turn, castling, ep, halfmove, fullmove] = fields;
    if (!/^[wb]$/.test(turn) || !/^(?:-|K?Q?k?q?)$/.test(castling)) return null;
    if (!/^(?:-|[a-h][36])$/.test(ep) || !/^\d{1,6}$/.test(halfmove) || !/^[1-9]\d{0,5}$/.test(fullmove)) return null;
    const ranks = placement.split('/');
    if (ranks.length !== 8) return null;
    const grid = [];
    for (const row of ranks) {
      if (!/^[pnbrqkPNBRQK1-8]+$/.test(row) || /\d\d/.test(row)) return null;
      const start = grid.length;
      for (const symbol of row) {
        if (/\d/.test(symbol)) grid.push(...Array(Number(symbol)).fill(null));
        else grid.push(symbol);
      }
      if (grid.length - start !== 8) return null;
    }
    for (const white of [true, false]) {
      const king = white ? 'K' : 'k';
      const pawn = white ? 'P' : 'p';
      if (!grid.includes(king) || grid.indexOf(king) !== grid.lastIndexOf(king)) return null;
      if (grid.filter(p => p === pawn).length > 8 ||
          grid.filter(p => p && (p === p.toUpperCase()) === white).length > 16) return null;
    }
    if (grid.slice(0, 8).concat(grid.slice(-8)).some(p => p?.toLowerCase() === 'p')) return null;
    for (const [right, king, rook] of [['K',60,63], ['Q',60,56], ['k',4,7], ['q',4,0]]) {
      const white = right === right.toUpperCase();
      if (castling.includes(right) && (grid[king] !== (white ? 'K' : 'k') || grid[rook] !== (white ? 'R' : 'r'))) return null;
    }
    if (ep !== '-') {
      const white = turn === 'w';
      const sq = (8 - Number(ep[1])) * 8 + 'abcdefgh'.indexOf(ep[0]);
      if (ep[1] !== (white ? '6' : '3') || grid[sq] || grid[sq + (white ? 8 : -8)] !== (white ? 'p' : 'P')) return null;
    }
    if (kingIsAttacked(grid, grid.indexOf(turn === 'w' ? 'k' : 'K'), turn === 'w')) return null;
    return {fen: fields.join(' '), turn};
  }

  globalThis.ChessArrowsPosition = {parseFen};
})();
