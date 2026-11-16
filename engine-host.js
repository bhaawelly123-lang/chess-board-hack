// SPDX-License-Identifier: GPL-3.0-only
'use strict';

// Stockfish.js reads the first URL fragment field to locate its WASM binary.
const engineBase = 'engine/stockfish-19-lite-single';
const wasmURL = chrome.runtime.getURL(engineBase + '.wasm');
const workerURL = chrome.runtime.getURL(engineBase + '.js') + '#' + encodeURIComponent(wasmURL);

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'chess-arrows-host' || port.sender?.id !== chrome.runtime.id || port.sender.tab) return;

  let currentWorker = null;
  let timeout;

  function stop() {
    clearTimeout(timeout);
    if (currentWorker) {
      currentWorker.terminate();
      currentWorker = null;
    }
  }

  function reply(message) {
    try { port.postMessage(message); } catch { stop(); }
  }

  port.onDisconnect.addListener(() => {
    void chrome.runtime.lastError;
    stop();
  });
  port.onMessage.addListener(request => {
    if (request?.type !== 'analyze' || !Number.isSafeInteger(request.requestId)) return;
    stop(); // Replacing the worker also cancels a search running synchronously in WASM.

    const { requestId } = request;
    const position = typeof request.fen === 'string' && request.fen.length <= 160 &&
      !/[\r\n\0]/.test(request.fen) && globalThis.ChessArrowsPosition.parseFen(request.fen);
    if (!position) {
      reply({ type: 'error', message: 'The position is not a valid chess FEN.', requestId });
      return;
    }

    function fail(message) {
      stop();
      reply({ type: 'error', message, requestId });
    }

    try {
      const worker = new Worker(workerURL);
      currentWorker = worker;
      timeout = setTimeout(() => {
        if (currentWorker === worker) fail('The local engine timed out. Try again.');
      }, 20000);
      worker.onerror = event => {
        event.preventDefault();
        if (currentWorker === worker) fail('The local engine failed to analyze this position.');
      };
      worker.onmessage = ({ data }) => {
        if (currentWorker !== worker || typeof data !== 'string') return;
        if (data === 'uciok') {
          worker.postMessage('isready');
        } else if (data === 'readyok') {
          worker.postMessage('position fen ' + position.fen);
          worker.postMessage('go depth 12 movetime 1800');
        } else if (/^info depth /.test(data)) {
          reply({ type: 'info', text: data, requestId });
        } else if (data.startsWith('bestmove ')) {
          const match = /^bestmove ([a-h][1-8][a-h][1-8][qrbn]?|\(none\)|0000)(?: |$)/.exec(data);
          if (!match) {
            fail('The local engine returned an invalid move.');
            return;
          }
          stop();
          reply({ type: 'bestmove', move: match[1], requestId });
        }
      };
      worker.postMessage('uci');
    } catch {
      fail('Could not load the bundled engine.');
    }
  });
});
