# Week 5 - Sales Dashboard (mini web application)

Responsive, accessible dashboard driven by `data/sales.json` (48 sample orders for 2025).

## Run
- Easiest: open `index.html` (works from disk: if `fetch` is blocked, an embedded copy `data/sales.js` is loaded automatically).
- Recommended: `python -m http.server` in this folder, then open http://localhost:8000 (uses the real `fetch` of the JSON file).

## Features
KPI cards, monthly-revenue and category charts (inline SVG), sortable and paginated table, filters (region, category, product search), reset, light/dark theme, loading and error states with Retry.

## Keyboard
Tab through filters, table headers (Enter/Space to sort), pager buttons and the theme switch. A skip link jumps past the header.

## Structure
`index.html` | `css/styles.css` | `js/dashboard.js` | `data/sales.json` (source) | `data/sales.js` (file:// fallback copy of the same data)
