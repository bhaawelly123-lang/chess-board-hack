// SPDX-License-Identifier: GPL-3.0-only
'use strict';

const hostPath = 'engine-host.html';
let openingHost;

// Concurrent frames share the document, but each gets its own engine port.
function ensureHost() {
  if (!openingHost) {
    openingHost = (async () => {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL(hostPath)]
      });
      if (!contexts.length) {
        await chrome.offscreen.createDocument({
          url: hostPath,
          reasons: ['WORKERS'],
          justification: 'Run the bundled Stockfish WebAssembly worker to analyze chess positions locally.'
        });
      }
    })().finally(() => { openingHost = null; });
  }
  return openingHost;
}

chrome.runtime.onConnect.addListener(client => {
  if (client.name !== 'chess-arrows-analysis' || !client.sender?.tab) return;

  let connected = true;
  let enginePort = null;
  let pending = null;

  function respond(response) {
    if (connected) {
      try { client.postMessage(response); } catch { /* Frame has navigated away. */ }
    }
  }

  function attachEngine() {
    const port = chrome.runtime.connect({ name: 'chess-arrows-host' });
    enginePort = port;
    port.onMessage.addListener(response => {
      if (port !== enginePort || !pending || response?.requestId !== pending.requestId) return;
      if (response.type === 'bestmove' || response.type === 'error') pending = null;
      respond(response);
    });
    port.onDisconnect.addListener(() => {
      void chrome.runtime.lastError;
      if (port !== enginePort) return;
      enginePort = null;
      if (pending) {
        respond({ type: 'error', requestId: pending.requestId, message: 'The local engine disconnected. Try again.' });
        pending = null;
      }
    });
    return port;
  }

  client.onMessage.addListener(async request => {
    if (request?.type !== 'analyze' || !Number.isSafeInteger(request.requestId)) return;
    pending = request;
    try {
      if (!enginePort) await ensureHost();
      if (!connected || pending !== request) return;
      (enginePort || attachEngine()).postMessage({ type: 'analyze', fen: request.fen, requestId: request.requestId });
    } catch {
      if (connected && pending === request) {
        pending = null;
        respond({ type: 'error', requestId: request.requestId, message: 'Could not start the local engine.' });
      }
    }
  });
  client.onDisconnect.addListener(() => {
    void chrome.runtime.lastError;
    connected = false;
    pending = null;
    enginePort?.disconnect();
    enginePort = null;
  });
});

chrome.action.onClicked.addListener(tab => {
  if (Number.isInteger(tab.id)) {
    chrome.tabs.sendMessage(tab.id, { type: 'chess-arrows-toggle' }, { frameId: 0 })
      .catch(() => {}); // Browser settings and other protected pages have no content script.
  }
});
