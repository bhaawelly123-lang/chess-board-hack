# My Engine Arrows

Analyze standard chess positions in Chrome. Stockfish draws an arrow from the piece to its recommended destination and shows the evaluation from White's perspective. All analysis runs in your browser.

## Installation

1. Extract the ZIP and open `chrome://extensions` in Chrome 116 or later.
2. Turn on **Developer mode** and click **Load unpacked**.
3. Select the `my-arrows` folder that contains `manifest.json`, then refresh the page with the chessboard.

## Automatic board detection

The extension recognizes Chess.com boards, Chessground boards such as those on Lichess, chessboard.js boards, and other boards that expose a FEN position or identify pieces and squares on the page. If a page has several boards, open **Settings** and click **Next board** to switch between them. You can also choose whose turn it is and which color appears at the bottom.

When a page shows only the pieces, the extension uses moves it has observed to infer the side to move, castling rights, and en passant availability. If you open a position partway through a game, enter a full FEN to supply details the extension could not observe.

## Canvas boards and images

1. Click the extension's toolbar icon and choose **Select board area**. Drag from one corner of the playing area to the opposite corner, leaving the border and any labels outside the selection.
2. Paste the position into the FEN field and click **Analyze FEN**. If you don't have a FEN, choose **Set up pieces**. Select a piece, click the squares where it belongs, then choose the side to move and click **Analyze position**.
3. If Black is at the bottom, choose **Black** under **Bottom side**. Update the manual position after each move. To follow a supported board again, click **Resume automatic detection**.

Manually placing or removing a piece clears castling rights and en passant availability. Enter a full FEN if either affects the position.

## License

The extension code is licensed under the GNU General Public License, version 3 only (`GPL-3.0-only`). The project includes the full license, credits for Stockfish, and the source for the bundled engine. [License](LICENSE) · [Stockfish notices and source](engine/NOTICE.md).
