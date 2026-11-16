// SPDX-License-Identifier: GPL-3.0-only
(() => {
  'use strict';
  const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const glyphs = {K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙', k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟'};
  const roles = {k:'king', q:'queen', r:'rook', b:'bishop', n:'knight', p:'pawn'};
  function name(piece) {
    return piece ? (piece === piece.toUpperCase() ? 'White ' : 'Black ') + roles[piece.toLowerCase()] : 'Empty';
  }
  function mount(container, apply) {
    container.innerHTML = `
      <div class="row"><label>Piece <select data-brush></select></label>
      <label>Side to move <select data-side><option value="w">White</option><option value="b">Black</option></select></label></div>
      <div class="setup-board" dir="ltr" aria-label="Position editor"></div>
      <div class="row"><button type="button" data-start>Starting position</button><button type="button" data-clear>Clear board</button>
      <button type="button" data-use>Analyze position</button></div>`;
    const get = s => container.querySelector(s);
    const brush = get('[data-brush]'), side = get('[data-side]'), grid = get('.setup-board');
    for (const p of [...Object.keys(glyphs),'']) brush.add(new Option(p ? glyphs[p]+' '+name(p) : 'Remove piece', p));
    let pieces = new Array(64).fill(''), extra = ['-','-','0','1'];
    const buttons = Array.from({length:64}, (_,i) => {
      const button = document.createElement('button');
      const square = 'abcdefgh'[i%8] + (8-Math.floor(i/8));
      button.type = 'button'; button.dataset.tile = square;
      button.className = (Math.floor(i/8) + i%8) % 2 ? 'dark' : 'light';
      button.addEventListener('click',() => {
        pieces[i] = brush.value; extra = ['-','-','0','1']; render();
      });
      grid.append(button); return button;
    });
    function render() {
      buttons.forEach((button,i) => {
        button.textContent = glyphs[pieces[i]] || '';
        button.title = button.dataset.tile + ' · ' + name(pieces[i]);
        button.setAttribute('aria-label',button.title);
      });
    }
    function load(fen) {
      const fields = fen ? fen.split(' ') : [];
      if (fields.length === 6) {
        pieces = [...fields[0].replaceAll('/','').replace(/[1-8]/g,n => '.'.repeat(Number(n)))].map(p => p === '.' ? '' : p);
        side.value = fields[1]; extra = fields.slice(2);
      } else { pieces = new Array(64).fill(''); side.value = 'w'; extra = ['-','-','0','1']; }
      render();
    }
    get('[data-start]').onclick = () => load(start);
    get('[data-clear]').onclick = () => load('');
    side.onchange = () => { extra[1] = '-'; };
    get('[data-use]').onclick = () => {
      const rows = [];
      for (let i=0;i<64;i+=8) rows.push(pieces.slice(i,i+8).map(p => p||'.').join('').replace(/\.+/g,s => s.length));
      apply([rows.join('/'),side.value,...extra].join(' '));
    };
    return {load};
  }
  globalThis.ChessArrowsSetup = {mount};
})();
