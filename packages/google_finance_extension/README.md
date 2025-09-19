# Google Finance Quick View

A Chrome extension that provides a compact Google Finance experience inside the toolbar popup. Look up tickers, review the latest price action, and maintain a personal watchlist that syncs with your Chrome profile.

## Features

- 🔎 **Instant lookup** – Search for any instrument available on Google Finance. If you only provide the ticker symbol the extension automatically defaults to the NASDAQ exchange.
- 📈 **Price & change** – Displays the last traded price together with the intraday change and percentage change.
- 🧾 **Key stats** – Extracts commonly used metrics such as the day range, 52-week range, market cap, dividend yield, and P/E ratio whenever Google Finance exposes them on the instrument page.
- ⭐ **Watchlist** – Save your favourite tickers and reload them with a single click. The list is stored via `chrome.storage.sync` (with a graceful fallback to `localStorage` during development).

## Installation

1. Clone or download this repository.
2. Open **chrome://extensions** in Google Chrome.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked** and select the `packages/google_finance_extension` directory.
5. The "Google Finance Quick View" icon will appear in your toolbar. Pin it for easier access.

## Usage

1. Click the extension icon to open the popup.
2. Enter a ticker symbol. Examples:
   - `GOOGL:NASDAQ`
   - `MSFT:NASDAQ`
   - `AAPL` (will automatically resolve to `AAPL:NASDAQ`)
   - `EURUSD:CUR` for currency pairs
3. Press **Lookup** or hit **Enter**.
4. The popup will display the latest information fetched from the Google Finance product page.
5. Use **Add** to store the current symbol in your watchlist, and tap a saved item to refresh the data later.

> ⚠️ **Note:** Google Finance pages are primarily designed for human consumption and may change without notice. If Google adjusts their markup, the parsing selectors might need to be updated.

## Development notes

- The popup is written with vanilla HTML, CSS, and JavaScript to keep bundle size minimal.
- Network requests target the public Google Finance website; no third-party data providers are involved.
- When testing outside Chrome (for example, opening `popup.html` directly), watchlist persistence falls back to `localStorage` so that you can interact with the UI without extension privileges.
- Consider adding icons under an `icons/` directory and referencing them from `manifest.json` if you intend to publish the extension to the Chrome Web Store.
