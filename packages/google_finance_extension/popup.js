const WATCHLIST_KEY = 'googleFinanceWatchlist';
const DEFAULT_EXCHANGE = 'NASDAQ';
const COMMON_EXCHANGES = new Set([
  'AMS',
  'ASX',
  'BIT',
  'BSE',
  'CME',
  'CURRENCY',
  'CUR',
  'EPA',
  'ETR',
  'FRA',
  'HKG',
  'INDEXDJX',
  'INDEXNASDAQ',
  'INDEXSP',
  'JSE',
  'KRX',
  'LON',
  'MCX',
  'NASDAQ',
  'NSE',
  'NYSE',
  'NYSEAMERICAN',
  'NYSEARCA',
  'NYSEMKT',
  'OTCMKTS',
  'SGX',
  'SHA',
  'SHE',
  'SIX',
  'TSE',
  'TSX',
  'TSXV'
]);

const form = document.getElementById('ticker-form');
const input = document.getElementById('ticker-input');
const resultContainer = document.getElementById('result');
const watchlistContainer = document.getElementById('watchlist-items');
const addToWatchlistButton = document.getElementById('add-to-watchlist');
const watchlistItemTemplate = document.getElementById('watchlist-item-template');

let currentQuote = null;
let watchlist = [];

const INTERESTING_LABELS = new Map([
  ['52-week range', '52 Week Range'],
  ['52 week range', '52 Week Range'],
  ['day range', 'Day Range'],
  ["day's range", 'Day Range'],
  ['market cap', 'Market Cap'],
  ['market capitalization', 'Market Cap'],
  ['pe ratio', 'P/E Ratio'],
  ['p/e ratio', 'P/E Ratio'],
  ['dividend yield', 'Dividend Yield'],
  ['prev close', 'Previous Close'],
  ['previous close', 'Previous Close']
]);

const storageArea = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync
  ? chrome.storage.sync
  : null;

async function loadWatchlist() {
  if (storageArea) {
    const stored = await storageArea.get([WATCHLIST_KEY]);
    return stored[WATCHLIST_KEY] ?? [];
  }

  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Unable to read watchlist from localStorage', error);
    return [];
  }
}

async function persistWatchlist(next) {
  watchlist = next;
  if (storageArea) {
    await storageArea.set({ [WATCHLIST_KEY]: watchlist });
    return;
  }

  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  } catch (error) {
    console.error('Unable to persist watchlist in localStorage', error);
  }
}

function normaliseSymbol(value) {
  if (!value) {
    return '';
  }

  const cleaned = value.trim().toUpperCase().replace(/\s+/g, '');
  if (!cleaned) {
    return '';
  }

  if (!cleaned.includes(':')) {
    return `${cleaned}:${DEFAULT_EXCHANGE}`;
  }

  const [first, second] = cleaned.split(':', 2);
  if (!second) {
    return first;
  }

  const isFirstExchange = COMMON_EXCHANGES.has(first);
  const isSecondExchange = COMMON_EXCHANGES.has(second);

  if (isFirstExchange && !isSecondExchange) {
    return `${second}:${first}`;
  }

  return `${first}:${second}`;
}

function buildQuoteUrl(symbol) {
  const encoded = encodeURIComponent(symbol).replace(/%3A/g, ':');
  return `https://www.google.com/finance/quote/${encoded}`;
}

function renderWatchlist() {
  watchlistContainer.innerHTML = '';
  if (!watchlist.length) {
    const emptyState = document.createElement('li');
    emptyState.textContent = 'No saved tickers yet.';
    emptyState.className = 'empty';
    watchlistContainer.appendChild(emptyState);
    return;
  }

  const fragment = document.createDocumentFragment();
  watchlist.forEach((symbol) => {
    const node = watchlistItemTemplate.content.firstElementChild.cloneNode(true);
    const symbolButton = node.querySelector('.watchlist-symbol');
    const removeButton = node.querySelector('.remove');

    symbolButton.dataset.symbol = symbol;
    symbolButton.textContent = symbol;
    symbolButton.addEventListener('click', () => lookup(symbol));

    removeButton.addEventListener('click', async () => {
      const next = watchlist.filter((entry) => entry !== symbol);
      await persistWatchlist(next);
      renderWatchlist();
      if (currentQuote?.symbol === symbol) {
        addToWatchlistButton.disabled = false;
      }
    });

    fragment.appendChild(node);
  });

  watchlistContainer.appendChild(fragment);
}

function setResultContent(content) {
  resultContainer.innerHTML = '';
  if (!content) {
    resultContainer.classList.add('hidden');
    return;
  }

  resultContainer.classList.remove('hidden');
  resultContainer.appendChild(content);
}

function renderError(message) {
  const wrapper = document.createElement('div');
  wrapper.className = 'error';
  wrapper.textContent = message;
  setResultContent(wrapper);
  currentQuote = null;
  addToWatchlistButton.disabled = true;
}

function renderQuote(quote) {
  const wrapper = document.createElement('div');

  const heading = document.createElement('h2');
  heading.textContent = quote.name ?? quote.symbol;
  wrapper.appendChild(heading);

  if (quote.tickerLabel) {
    const ticker = document.createElement('div');
    ticker.className = 'ticker';
    ticker.textContent = quote.tickerLabel;
    wrapper.appendChild(ticker);
  }

  const price = document.createElement('div');
  price.className = 'price';
  price.textContent = quote.priceText;
  wrapper.appendChild(price);

  const change = document.createElement('div');
  change.className = 'change';
  if (typeof quote.changeRaw === 'number') {
    change.classList.add(quote.changeRaw >= 0 ? 'positive' : 'negative');
  }
  change.textContent = quote.changeText;
  wrapper.appendChild(change);

  if (quote.metadata?.length) {
    const meta = document.createElement('div');
    meta.className = 'metadata';
    meta.textContent = quote.metadata.join(' \u2022 ');
    wrapper.appendChild(meta);
  }

  if (quote.additionalRows?.length) {
    const list = document.createElement('ul');
    list.className = 'metadata-list';
    quote.additionalRows.forEach((row) => {
      const item = document.createElement('li');
      item.textContent = `${row.label}: ${row.value}`;
      list.appendChild(item);
    });
    wrapper.appendChild(list);
  }

  setResultContent(wrapper);
  currentQuote = quote;
  addToWatchlistButton.disabled = watchlist.includes(quote.symbol);
}

function parseChange(text) {
  if (!text) {
    return { changeText: 'Change unavailable' };
  }

  const normalized = text.replace(/\s+/g, ' ').replace(/\u2212/g, '-');
  const match = normalized.match(/([+\-]?[0-9.,]+)\s*\(([^)]+)\)/);
  if (!match) {
    return { changeText: normalized };
  }

  const rawChange = parseFloat(match[1].replace(/,/g, ''));
  return {
    changeText: normalized,
    changeRaw: Number.isFinite(rawChange) ? rawChange : undefined,
    changePercentText: match[2]
  };
}

function parseKeyValuePairs(doc) {
  const rows = [];
  const cells = Array.from(doc.querySelectorAll('div[data-attrid]'));
  cells.forEach((cell) => {
    const label = cell.getAttribute('data-attrid');
    if (!label) {
      return;
    }

    const friendlyLabel = INTERESTING_LABELS.get(label.toLowerCase());
    if (!friendlyLabel) {
      return;
    }

    let value = cell.textContent?.trim();
    if (!value) {
      return;
    }

    const normalizedLabel = label.toLowerCase();
    if (value.toLowerCase().startsWith(normalizedLabel)) {
      value = value.slice(label.length).trim();
    }

    rows.push({ label: friendlyLabel, value });
  });
  return rows;
}

function extractQuoteFromDocument(doc, symbol) {
  const priceElement = doc.querySelector('.YMlKec.fxKbKc');
  if (!priceElement) {
    throw new Error('Unable to locate price on Google Finance. Try a fully qualified symbol such as GOOGL:NASDAQ.');
  }

  const nameElement = doc.querySelector('.zzDege');
  const tickerElement = doc.querySelector('.P6K39c');
  const changeElement =
    doc.querySelector('[data-last-price-change]') ||
    doc.querySelector('.NydbP.Vd') ||
    doc.querySelector('.P2Luy.Ebnabc') ||
    doc.querySelector('.WlRRw.IsqQVc.NprOob');

  const metadataElement = doc.querySelector('.ygUjEc');

  const quote = {
    symbol,
    name: nameElement?.textContent?.trim(),
    tickerLabel: tickerElement?.textContent?.trim(),
    priceText: priceElement.textContent.trim()
  };

  const changeData = parseChange(changeElement?.textContent?.trim());
  quote.changeText = changeData.changeText;
  quote.changeRaw = changeData.changeRaw;

  const metadata = [];
  if (metadataElement?.textContent) {
    metadata.push(metadataElement.textContent.trim());
  }
  metadata.push(`Fetched ${new Date().toLocaleTimeString()}`);
  quote.metadata = metadata;

  const rows = parseKeyValuePairs(doc).filter((row) =>
    ['52-week range', 'Day range', 'Market cap', 'P/E ratio', 'Dividend yield'].some((key) =>
      row.label.toLowerCase().includes(key)
    )
  );
  if (rows.length) {
    quote.additionalRows = rows;
  }

  return quote;
}

async function fetchQuote(symbol) {
  const url = buildQuoteUrl(symbol);
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`Google Finance returned ${response.status}`);
  }

  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return extractQuoteFromDocument(doc, symbol);
}

async function lookup(inputValue) {
  const symbol = normaliseSymbol(inputValue);
  if (!symbol) {
    renderError('Enter a ticker symbol to begin.');
    return;
  }

  input.value = symbol;
  setResultContent(createLoadingSkeleton(symbol));

  try {
    const quote = await fetchQuote(symbol);
    renderQuote(quote);
  } catch (error) {
    console.error(error);
    renderError(error.message || 'Something went wrong while requesting data from Google Finance.');
  }
}

function createLoadingSkeleton(symbol) {
  const wrapper = document.createElement('div');
  wrapper.className = 'metadata';
  wrapper.textContent = `Fetching ${symbol} from Google Finance...`;
  return wrapper;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  lookup(input.value);
});

addToWatchlistButton.addEventListener('click', async () => {
  if (!currentQuote) {
    return;
  }

  if (watchlist.includes(currentQuote.symbol)) {
    return;
  }

  const next = [...watchlist, currentQuote.symbol].sort();
  await persistWatchlist(next);
  renderWatchlist();
  addToWatchlistButton.disabled = true;
});

function attachWatchlistDelegates() {
  watchlistContainer.addEventListener('keydown', (event) => {
    if (event.target.matches('.watchlist-symbol') && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      const symbol = event.target.dataset.symbol;
      lookup(symbol);
    }
  });
}

async function init() {
  watchlist = await loadWatchlist();
  renderWatchlist();
  attachWatchlistDelegates();

  const [first] = watchlist;
  if (first) {
    lookup(first);
  }
}

document.addEventListener('DOMContentLoaded', init);
