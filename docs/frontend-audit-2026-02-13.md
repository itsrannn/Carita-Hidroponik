# Frontend API Connectivity Audit (GitHub Pages)

Date: 2026-02-13
Scope: `itsrannn/Carita-Hidroponik` frontend checkout/API calls

## 1) API URL Resolution

- `BACKEND_API_URL` is resolved in `js/main.js` using this priority:
  1. `window.APP_CONFIG.apiBaseUrl`
  2. `<meta name="api-base-url" ...>`
  3. fallback `'https://backend-carita-hidroponik.vercel.app'`
- Runtime check on production page `https://itsrannn.github.io/Carita-Hidroponik/my-cart.html` showed:
  - `window.APP_CONFIG = null`
  - `meta[name="api-base-url"] = null`
  - Effective API base URL = `https://backend-carita-hidroponik.vercel.app`

## 2) Fetch Call Inspection

`fetch()` calls found in `js/main.js`:

- Relative/site-local fetches:
  - `fetch(url)` for component includes (`components/header.html`, `components/footer.html`)
  - `fetch(locales/${lang}.json)` for translations
- Absolute external fetches:
  - `fetch('https://www.emsifa.com/...')` for province/regency/district/village data
- Backend checkout fetches (resolved absolute via `buildApiUrl()`):
  - `POST https://backend-carita-hidroponik.vercel.app/api/payment/create-snap-token`
  - `POST https://backend-carita-hidroponik.vercel.app/api/order/confirm`

Observed checkout API probe in browser runtime:
- Method: `POST`
- URL: `https://backend-carita-hidroponik.vercel.app/api/payment/create-snap-token`
- Browser result: rejected with `TypeError: Failed to fetch`

## 3) Browser Network Trace

Using Playwright network listeners on production GitHub Pages URL:

- Request is attempted by the browser and appears in network events:
  - `REQUEST POST https://backend-carita-hidroponik.vercel.app/api/payment/create-snap-token`
- Then fails:
  - `FAILED POST ... net::ERR_FAILED`
- Console error includes exact root cause:
  - `blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.`

Conclusion for this section: this is not a malformed URL or JS crash before fetch; request is attempted and blocked by CORS preflight handling.

## 4) CORS & Preflight Behavior

- Preflight is required because checkout uses `POST` with `Content-Type: application/json` (non-simple request).
- Browser explicitly reports preflight CORS rejection (missing `Access-Control-Allow-Origin`).
- No evidence of DNS failure (domain resolves and request is attempted).
- No evidence of mixed-content issue (both frontend and backend are `https`).

## 5) Environment & Hosting Constraints

- Frontend is served from GitHub Pages origin: `https://itsrannn.github.io` (static hosting).
- Backend is a different origin: `https://backend-carita-hidroponik.vercel.app`.
- Therefore checkout always requires proper cross-origin CORS headers from backend for the GitHub Pages origin.

## Final Findings (Deliverables)

1. Exact runtime API URL: `https://backend-carita-hidroponik.vercel.app`.
2. Browser does attempt request: yes (`POST /api/payment/create-snap-token`) and it appears in network trace.
3. Precise cause of `Failed to fetch`: CORS preflight rejection due to missing `Access-Control-Allow-Origin` for origin `https://itsrannn.github.io`.
4. Minimal fix required:
   - Add/adjust backend CORS policy to allow the frontend origin (`https://itsrannn.github.io`) and required methods/headers (including `POST`, `OPTIONS`, `Content-Type`), and ensure OPTIONS preflight returns success with appropriate CORS headers.
   - Frontend API URL resolution is already correct in current runtime.
