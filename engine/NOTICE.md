# Stockfish.js 19

The two files in this directory are the unmodified lite, single-threaded JavaScript and WebAssembly assets from Stockfish.js v19.0.1. SHA-256 digests match the published release. [Release and downloads](https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.1).

Stockfish.js © 2026 Chess.com, LLC. WebAssembly port by Nathan Rugg. Stockfish is by Tord Romstad, Marco Costalba, Joona Kiiski, Gary Linscott and the Stockfish contributors. Chris Bao (sscg13) provided the lite evaluation network. Upstream licenses the engine under GPL version 3 and identifies its non-engine code as MIT licensed. Original source notices and the AUTHORS file are in the source archive. [License](../LICENSE) · [Upstream source](https://github.com/nmrugg/stockfish.js/tree/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6).

The corresponding source and evaluation network are supplied with this project. [Source archive with build scripts](../third_party/stockfish/stockfish-js-v19.0.1.tar.gz) · [Lite network weights](../third_party/stockfish/nn-61e7af4bb97d.nnue).

To build the lite single-threaded target, extract the source archive, place the supplied network in its `src/` directory under its original filename, and activate Emscripten 6.0.9. From the extracted source directory run `npm install` followed by `npm run build-single-lite`. The upstream README and build.js in the archive describe the toolchain and build options.

| File | SHA-256 |
| --- | --- |
| stockfish-19-lite-single.js | ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a |
| stockfish-19-lite-single.wasm | ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de |
