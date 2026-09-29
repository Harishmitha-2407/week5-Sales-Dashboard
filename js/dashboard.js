/* Week 5 - Dashboard logic (vanilla JS).
   Flow: fetch JSON -> populate filters -> render (KPIs, charts, table) on every state change. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var NS = 'http://www.w3.org/2000/svg';
  var state = { rows: [], region: '', cat: '', q: '', sortKey: 'date', sortDir: 'asc', page: 1, perPage: 10, currency: 'USD' };
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  var money = function (n) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: state.currency, maximumFractionDigits: 0 }).format(n); };
  var num = function (n) { return new Intl.NumberFormat('en-US').format(n); };

  /* ---------- Data loading with error handling ---------- */
  function useData(d, note) {
    if (!d || !Array.isArray(d.orders)) throw new Error('Unexpected data format');
    state.rows = d.orders; state.currency = d.currency || 'USD';
    $('#year').textContent = d.year || '';
    init(); $('#app').hidden = false; $('#status').textContent = 'Data loaded: ' + d.orders.length + ' orders.' + (note || '');
  }

  /* Fallback for file:// (fetch is blocked): load data/sales.js, an identical embedded copy, on demand */
  function loadFallback() {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script'); s.src = 'data/sales.js';
      s.onload = function () { window.SALES_DATA ? resolve(window.SALES_DATA) : reject(new Error('No fallback data')); };
      s.onerror = function () { reject(new Error('Fallback script failed')); };
      document.head.appendChild(s);
    });
  }

  function load() {
    $('#status').textContent = 'Loading data...'; $('#error').hidden = true;
    fetch('data/sales.json')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) { useData(d); })
      .catch(function (err) {
        console.warn('fetch failed, trying embedded copy:', err);
        loadFallback().then(function (d) { useData(d, ' (embedded copy used because fetch is unavailable)'); })
          .catch(function (err2) {
            console.error(err2);
            $('#status').textContent = 'Loading failed.'; $('#error').hidden = false; $('#retry').focus();
          });
      });
  }

  function unique(key) { return Array.from(new Set(state.rows.map(function (r) { return r[key]; }))).sort(); }
  function fill(sel, vals) { vals.forEach(function (v) { var o = document.createElement('option'); o.value = o.textContent = v; sel.appendChild(o); }); }

  var ready = false;
  function init() {
    if (ready) return; ready = true;
    fill($('#f-region'), unique('region')); fill($('#f-cat'), unique('category'));
    $('#f-region').addEventListener('change', function (e) { state.region = e.target.value; state.page = 1; render(); });
    $('#f-cat').addEventListener('change', function (e) { state.cat = e.target.value; state.page = 1; render(); });
    var t; $('#f-search').addEventListener('input', function (e) {         // debounce: avoid re-rendering on every keystroke
      clearTimeout(t); var v = e.target.value; t = setTimeout(function () { state.q = v.trim().toLowerCase(); state.page = 1; render(); }, 200);
    });
    $('#reset').addEventListener('click', function () {
      state.region = state.cat = state.q = ''; state.page = 1;
      $('#f-region').value = $('#f-cat').value = $('#f-search').value = ''; render(); $('#f-region').focus();
    });
    document.querySelectorAll('th button').forEach(function (b) { b.addEventListener('click', function () { sortBy(b.dataset.key); }); });
    $('#prev').addEventListener('click', function () { state.page--; renderTable(filtered()); });
    $('#next').addEventListener('click', function () { state.page++; renderTable(filtered()); });
    render();
  }

  /* ---------- Derived data ---------- */
  function filtered() {
    return state.rows.filter(function (r) {
      return (!state.region || r.region === state.region) && (!state.cat || r.category === state.cat) && (!state.q || r.product.toLowerCase().indexOf(state.q) > -1);
    });
  }
  function sortBy(key) {
    state.sortDir = state.sortKey === key && state.sortDir === 'asc' ? 'desc' : 'asc'; state.sortKey = key; state.page = 1;
    document.querySelectorAll('th').forEach(function (th) {
      th.setAttribute('aria-sort', th.firstElementChild.dataset.key === key ? (state.sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
    });
    renderTable(filtered());
  }

  /* ---------- Rendering ---------- */
  function render() { var rows = filtered(); renderKpis(rows); renderMonth(rows); renderCat(rows); renderTable(rows); }

  function renderKpis(rows) {
    var rev = rows.reduce(function (s, r) { return s + r.revenue; }, 0), units = rows.reduce(function (s, r) { return s + r.units; }, 0);
    $('#k-rev').textContent = money(rev); $('#k-units').textContent = num(units); $('#k-orders').textContent = num(rows.length);
    $('#k-aov').textContent = rows.length ? money(rev / rows.length) : '-';
  }

  function el(name, attrs, text) {
    var e = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text != null) e.textContent = text; return e;
  }

  /* Generic SVG bar chart: items = [{label, value}] */
  function barChart(host, items, cls, title) {
    host.textContent = '';
    var W = 560, H = 260, m = { t: 12, r: 10, b: 30, l: 52 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
    var max = Math.max.apply(null, items.map(function (i) { return i.value; }).concat(1));
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': title });
    for (var g = 0; g <= 4; g++) {                                   // gridlines + y labels
      var y = m.t + ih - (ih * g / 4);
      svg.appendChild(el('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, 'class': 'grid' }));
      svg.appendChild(el('text', { x: m.l - 6, y: y + 4, 'text-anchor': 'end' }, money(max * g / 4)));
    }
    var bw = iw / items.length;
    items.forEach(function (it, i) {
      var h = ih * it.value / max, x = m.l + i * bw + bw * 0.15;
      var r = el('rect', { x: x, y: m.t + ih - h, width: bw * 0.7, height: h, 'class': cls, rx: 3 });
      r.appendChild(el('title', {}, it.label + ': ' + money(it.value)));       // tooltip
      svg.appendChild(r);
      svg.appendChild(el('text', { x: x + bw * 0.35, y: H - 10, 'text-anchor': 'middle' }, it.label));
    });
    svg.appendChild(el('line', { x1: m.l, x2: W - m.r, y1: m.t + ih, y2: m.t + ih, 'class': 'axis' }));
    host.appendChild(svg);
  }

  function renderMonth(rows) {
    var totals = MONTHS.map(function (m, i) { return { label: m, value: 0, i: i }; });
    rows.forEach(function (r) { totals[parseInt(r.date.slice(5, 7), 10) - 1].value += r.revenue; });
    barChart($('#chart-month'), totals, 'bar', 'Bar chart of monthly revenue');
    var best = totals.reduce(function (a, b) { return b.value > a.value ? b : a; }, totals[0]);
    $('#chart-month-sum').textContent = rows.length ? 'Monthly revenue. Highest month: ' + best.label + ' at ' + money(best.value) + '.' : 'No data for current filters.';
  }
  function renderCat(rows) {
    var map = {}; rows.forEach(function (r) { map[r.category] = (map[r.category] || 0) + r.revenue; });
    var items = Object.keys(map).sort().map(function (k) { return { label: k, value: map[k] }; });
    barChart($('#chart-cat'), items.length ? items : [{ label: 'None', value: 0 }], 'bar2', 'Bar chart of revenue by category');
    $('#chart-cat-sum').textContent = items.map(function (i) { return i.label + ' ' + money(i.value); }).join('; ') || 'No data for current filters.';
  }

  function renderTable(rows) {
    var k = state.sortKey, dir = state.sortDir === 'asc' ? 1 : -1;
    rows = rows.slice().sort(function (a, b) { return (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * dir; });
    var pages = Math.max(1, Math.ceil(rows.length / state.perPage)); state.page = Math.min(Math.max(1, state.page), pages);
    var slice = rows.slice((state.page - 1) * state.perPage, state.page * state.perPage), tb = $('#table tbody');
    tb.textContent = '';
    slice.forEach(function (r) {
      var tr = document.createElement('tr');
      [r.date, r.region, r.category, r.product, num(r.units), money(r.revenue)].forEach(function (v, i) {
        var td = document.createElement('td'); td.textContent = v; if (i > 3) td.className = 'num'; tr.appendChild(td);   // textContent prevents HTML injection
      });
      tb.appendChild(tr);
    });
    if (!slice.length) { var e = document.createElement('tr'), c = document.createElement('td'); c.colSpan = 6; c.textContent = 'No orders match these filters.'; e.appendChild(c); tb.appendChild(e); }
    $('#count').textContent = rows.length + (rows.length === 1 ? ' order' : ' orders') + ' shown';
    $('#page-info').textContent = 'Page ' + state.page + ' of ' + pages;
    $('#prev').disabled = state.page <= 1; $('#next').disabled = state.page >= pages;
  }

  /* ---------- Theme ---------- */
  var root = document.documentElement, tbtn = $('#theme');
  function theme(dark) { root.setAttribute('data-theme', dark ? 'dark' : 'light'); tbtn.setAttribute('aria-pressed', String(dark)); tbtn.textContent = dark ? 'Light mode' : 'Dark mode'; }
  theme(window.matchMedia('(prefers-color-scheme: dark)').matches);
  tbtn.addEventListener('click', function () { theme(tbtn.getAttribute('aria-pressed') !== 'true'); });
  $('#retry').addEventListener('click', load);

  load();
})();
