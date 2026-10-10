const API = 'https://api.coingecko.com/api/v3';
const coinRows = document.querySelector('#coin-rows');
const stateArea = document.querySelector('#state-area');
const resultCount = document.querySelector('#result-count');
const searchInput = document.querySelector('#search');
const sortSelect = document.querySelector('#sort');
const currencySelect = document.querySelector('#currency');
const refreshButton = document.querySelector('#refresh-button');
const dialog = document.querySelector('#coin-dialog');
const CURRENCIES = { usd: { symbol: '$', locale: 'en-US' }, eur: { symbol: '€', locale: 'de-DE' }, gbp: { symbol: '£', locale: 'en-GB' }, bdt: { symbol: '৳', locale: 'en-BD' } };
let coins = [];
let marketState = 'loading';
let updatedAt = null;
let toastTimeout;

function currentCurrency() { return currencySelect.value; }
function formatMoney(value, currency = currentCurrency(), compact = false) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const config = CURRENCIES[currency] || CURRENCIES.usd;
  const opts = { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: Number(value) < 1 ? 6 : 2 };
  if (compact) { opts.notation = 'compact'; opts.maximumFractionDigits = 2; }
  try { return new Intl.NumberFormat(config.locale, opts).format(value); } catch { return `${config.symbol}${Number(value).toLocaleString()}`; }
}
function formatPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
}
function formatNumber(value) { return value == null ? '—' : new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(value); }
function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 2500);
}
function showLoading() {
  marketState = 'loading';
  coinRows.innerHTML = '';
  stateArea.innerHTML = '<div class="loading-state"><div class="spinner"></div><div class="state-title">Finding the latest prices</div><p class="state-copy">Fetching live market data. This usually takes just a moment.</p></div>';
  resultCount.textContent = 'Loading assets…';
}
function showError(message = 'We couldn’t load market data right now. Please check your connection and try again.') {
  marketState = 'error';
  coinRows.innerHTML = '';
  stateArea.innerHTML = `<div class="error-state"><div class="error-symbol">⌁</div><div class="state-title">Market data took a detour</div><p class="state-copy">${escapeHtml(message)}</p><button class="retry-button" id="retry-button">Try again</button></div>`;
  resultCount.textContent = 'Unable to load assets';
  document.querySelector('#retry-button').addEventListener('click', loadCoins);
}
function sparkline(points, color) {
  if (!points || points.length < 2) return '<span class="rank">—</span>';
  const w = 88, h = 30, pad = 2;
  const low = Math.min(...points), high = Math.max(...points), range = high - low || 1;
  const coords = points.map((point, index) => `${pad + index / (points.length - 1) * (w - pad * 2)},${h - pad - ((point - low) / range) * (h - pad * 2)}`).join(' ');
  return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" aria-label="Seven day price trend"><polyline fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" points="${coords}"/></svg>`;
}
function getVisibleCoins() {
  const query = searchInput.value.trim().toLowerCase();
  let list = coins.filter((coin) => !query || coin.name.toLowerCase().includes(query) || coin.symbol.toLowerCase().includes(query));
  const sort = sortSelect.value;
  list = [...list].sort((a, b) => {
    if (sort === 'price_desc') return b.current_price - a.current_price;
    if (sort === 'price_asc') return a.current_price - b.current_price;
    if (sort === 'change_desc') return (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0);
    if (sort === 'change_asc') return (a.price_change_percentage_24h || 0) - (b.price_change_percentage_24h || 0);
    return (a.market_cap_rank || 9999) - (b.market_cap_rank || 9999);
  });
  return list;
}
function renderCoins() {
  if (marketState !== 'success') return;
  const list = getVisibleCoins();
  stateArea.innerHTML = '';
  if (!list.length) {
    coinRows.innerHTML = '';
    const message = 'Try a different name or symbol.';
    stateArea.innerHTML = `<div class="empty-state"><div class="empty-symbol">⌕</div><div class="state-title">No coins found</div><p class="state-copy">${message}</p></div>`;
    resultCount.textContent = 'No matching assets';
    return;
  }
  coinRows.innerHTML = list.map((coin) => {
    const change = coin.price_change_percentage_24h;
    const positive = Number(change) >= 0;
    return `<tr data-coin-id="${escapeHtml(coin.id)}" tabindex="0" aria-label="View ${escapeHtml(coin.name)} details">
      <td class="rank">${coin.market_cap_rank || '—'}</td>
      <td><div class="asset-cell"><img class="coin-logo" src="${escapeHtml(coin.image)}" alt="" loading="lazy" /><div><div class="asset-name">${escapeHtml(coin.name)}</div><div class="asset-symbol">${escapeHtml(coin.symbol)}</div></div></div></td>
      <td class="align-right price-cell">${formatMoney(coin.current_price)}</td>
      <td class="align-right"><span class="change-pill ${positive ? 'positive' : 'negative'}">${formatPercent(change)}</span></td>
      <td class="align-right cap-cell">${formatMoney(coin.market_cap, currentCurrency(), true)}</td>
      <td class="align-right volume-cell">${formatMoney(coin.total_volume, currentCurrency(), true)}</td>
      <td class="spark-col">${sparkline(coin.sparkline_in_7d?.price, positive ? '#55d69e' : '#fa7480')}</td>
    </tr>`;
  }).join('');
  resultCount.textContent = `Showing ${list.length} of ${coins.length} assets`;
}
function updateSummary() {
  const totalCap = coins.reduce((sum, coin) => sum + (coin.market_cap || 0), 0);
  const changes = coins.filter((coin) => coin.price_change_percentage_24h != null);
  const average = changes.length ? changes.reduce((sum, coin) => sum + coin.price_change_percentage_24h, 0) / changes.length : 0;
  document.querySelector('#total-market-cap').textContent = formatMoney(totalCap, currentCurrency(), true);
  const movement = document.querySelector('#market-movement');
  movement.textContent = formatPercent(average);
  movement.classList.toggle('positive', average >= 0);
  movement.classList.toggle('negative', average < 0);
  document.querySelector('#asset-count').textContent = String(coins.length).padStart(2, '0');
  document.querySelector('#last-updated').textContent = updatedAt ? updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
}
async function loadCoins() {
  showLoading();
  refreshButton.classList.add('is-loading');
  refreshButton.disabled = true;
  try {
    const params = new URLSearchParams({ vs_currency: currentCurrency(), order: 'market_cap_desc', per_page: '30', page: '1', sparkline: 'true', price_change_percentage: '24h' });
    const response = await fetch(`${API}/coins/markets?${params}`, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(response.status === 429 ? 'The market data service is busy. Please wait a moment and try again.' : `The data service returned an error (${response.status}). Please try again.`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('The market data came back in an unexpected format. Please try again.');
    coins = data;
    marketState = 'success';
    updatedAt = new Date();
    updateSummary();
    renderCoins();
  } catch (error) {
    showError(error.message || 'We couldn’t load market data right now. Please try again.');
  } finally {
    refreshButton.classList.remove('is-loading');
    refreshButton.disabled = false;
  }
}
function buildChart(prices, positive = true) {
  if (!prices || prices.length < 2) return '<p class="state-copy">Chart data is not available for this coin yet.</p>';
  const w = 460, h = 145, pad = 5, values = prices.map((p) => p[1]);
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const coords = values.map((value, index) => `${pad + index / (values.length - 1) * (w - pad * 2)},${h - pad - ((value - min) / range) * (h - pad * 2)}`);
  const stroke = positive ? '#55d69e' : '#fa7480';
  const fillPoints = `${coords[0].split(',')[0]},${h} ${coords.join(' ')} ${coords[coords.length - 1].split(',')[0]},${h}`;
  return `<svg class="detail-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${stroke}" stop-opacity=".22"/><stop offset="1" stop-color="${stroke}" stop-opacity="0"/></linearGradient></defs><polygon points="${fillPoints}" fill="url(#chart-fill)"/><polyline points="${coords.join(' ')}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
async function openCoinDetails(id) {
  const coin = coins.find((item) => item.id === id);
  if (!coin) return;
  const change = coin.price_change_percentage_24h;
  const positive = Number(change) >= 0;
  document.querySelector('#coin-detail-content').innerHTML = `<div class="detail-heading"><img class="coin-logo" src="${escapeHtml(coin.image)}" alt=""/><div><h2>${escapeHtml(coin.name)}</h2><span>${escapeHtml(coin.symbol)} · rank #${coin.market_cap_rank || '—'}</span></div></div><div class="detail-price">${formatMoney(coin.current_price)}</div><div class="detail-change ${positive ? 'positive' : 'negative'}">${formatPercent(change)} <span style="color:#8a96a5">past 24 hours</span></div><div class="chart-toolbar"><span>Price history</span><select id="chart-days" aria-label="Chart time range"><option value="1">24 hours</option><option value="7" selected>7 days</option><option value="30">30 days</option></select></div><div id="detail-chart-wrap"><div class="spinner"></div></div><div class="detail-stats"><div class="detail-stat"><span>MARKET CAP</span><strong>${formatMoney(coin.market_cap, currentCurrency(), true)}</strong></div><div class="detail-stat"><span>24H VOLUME</span><strong>${formatMoney(coin.total_volume, currentCurrency(), true)}</strong></div><div class="detail-stat"><span>24H HIGH</span><strong>${formatMoney(coin.high_24h)}</strong></div><div class="detail-stat"><span>24H LOW</span><strong>${formatMoney(coin.low_24h)}</strong></div><div class="detail-stat"><span>CIRCULATING SUPPLY</span><strong>${formatNumber(coin.circulating_supply)} ${escapeHtml(coin.symbol.toUpperCase())}</strong></div><div class="detail-stat"><span>MAX SUPPLY</span><strong>${formatNumber(coin.max_supply)} ${escapeHtml(coin.symbol.toUpperCase())}</strong></div></div><p class="detail-description">Market data supplied by <a class="detail-link" href="https://www.coingecko.com/en/coins/${encodeURIComponent(coin.id)}" target="_blank" rel="noreferrer">CoinGecko ↗</a>. Prices can change quickly.</p>`;
  dialog.showModal();
  const loadChart = async () => {
    const days = document.querySelector('#chart-days').value;
    const chartWrap = document.querySelector('#detail-chart-wrap');
    chartWrap.innerHTML = '<div class="spinner"></div>';
    try {
      const params = new URLSearchParams({ vs_currency: currentCurrency(), days });
      const response = await fetch(`${API}/coins/${encodeURIComponent(coin.id)}/market_chart?${params}`);
      if (!response.ok) throw new Error('Chart unavailable');
      const chart = await response.json();
      chartWrap.innerHTML = buildChart(chart.prices, positive);
    } catch { chartWrap.innerHTML = '<p class="state-copy">Price history is temporarily unavailable.</p>'; }
  };
  document.querySelector('#chart-days').addEventListener('change', loadChart);
  await loadChart();
}

document.querySelector('#refresh-button').addEventListener('click', loadCoins);
document.querySelector('#header-refresh').addEventListener('click', loadCoins);
currencySelect.addEventListener('change', loadCoins);
searchInput.addEventListener('input', renderCoins);
sortSelect.addEventListener('change', renderCoins);
document.querySelector('#market-nav').addEventListener('click', () => {
  document.querySelector('#market-nav').classList.add('active');
  document.querySelector('.market-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
coinRows.addEventListener('click', (event) => {
  const row = event.target.closest('[data-coin-id]');
  if (row) openCoinDetails(row.dataset.coinId);
});
coinRows.addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('tr[data-coin-id]')) {
    event.preventDefault(); openCoinDetails(event.target.dataset.coinId);
  }
});
document.querySelector('#dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchInput.focus(); }
});
loadCoins();
