# Admin Front-end UI/UX Audit — 2026-06-26

Scope: `admin.html`, dynamically loaded admin partials under `admin-partials/`, and linked admin scripts/styles used by the GitHub Pages admin shell.

## Current condition summary

The admin area already has a modern dashboard shell with a fixed sidebar, sticky topbar, global search event, dynamic partial loading, KPI cards, charts, product/news management tables, orders management, and shipping settings. The visual direction is appropriate for an e-commerce back office, but the implementation is still fragmented: each partial ships its own `<style>` block, component styles are repeated, several navigation items are aliases/placeholders rather than real sections, and mobile navigation is currently incomplete.

The page can become a clean, compact, professional e-commerce dashboard with a staged refactor that consolidates admin components, fixes navigation/responsiveness first, then standardizes tables, filters, forms, states, and accessibility.

## Critical findings

1. **Mobile sidebar is hidden without an open mechanism.** At `max-width: 900px`, `.sidebar` is translated off-canvas, but there is no visible mobile menu button outside the sidebar to restore it. Admin navigation becomes effectively unavailable on tablet/mobile.
2. **Analytics menu does not load a distinct analytics section.** The Analytics item points to `admin-dashboard` and the same dashboard partial. This makes navigation misleading and prevents a clear analytics workflow.
3. **Grow Lab menu is only a placeholder in the admin shell.** The navigation exposes Grow Lab, but the loaded content is a static empty panel rather than a real management page or a link to the existing Grow Lab admin file.
4. **Inline partial styles make UI consistency fragile.** Dashboard, orders, products/news, and shipping each define separate card, filter, button, table, empty/error, and header styles. This increases drift and makes the page harder to maintain.
5. **Session guard is script-dependent and should be verified as a first-class flow.** `admin-auth.js` exists, but the shell loads visible UI before any explicit blocking auth state in the HTML. The flow should present a clear checking/unauthorized state.

## High-priority UI/UX issues

1. **Navigation hierarchy is not fully truthful.** Products and News share the same partial with a tab switch; Analytics reuses Dashboard; Settings loads Shipping. These can be valid implementation shortcuts, but labels should match the actual destination and default state.
2. **Dashboard density is high.** Five KPI cards plus two charts plus recent transactions appear in one flow. Cards should be more compact, use consistent icon/label/value patterns, and prioritize the most actionable metrics.
3. **Table readability varies by section.** Products/news, orders, dashboard transactions, and shipping use different table classes, header colors, border radii, and action button treatments.
4. **Filter bars are not standardized.** Orders use `.filter-container`, products/news use `.cms-toolbar`, shipping uses `.shipping-toolbar`, and dashboard uses `.filter-controls`. This creates different spacing, label, and input behavior.
5. **Action hierarchy is inconsistent.** Primary create buttons, secondary reset buttons, edit buttons, delete buttons, and status selectors vary in size and visual weight.
6. **Loading, empty, error, and success states exist but are inconsistent.** Products/news have table-row states, orders have inline messages, shipping has notices, and the shell has a generic loading panel.

## Medium-priority structure issues

1. **`admin.html` mixes shell markup, shell CSS, and shell JS.** This is convenient for GitHub Pages but difficult to maintain as the admin grows.
2. **Component classes are duplicated across partials.** Repeated concepts include page headers, cards, tables, toolbar inputs, status badges, action buttons, and pagination.
3. **The dynamic loader has no route state.** Clicking a section does not update a query string/hash, so refresh/back/forward behavior does not preserve the selected admin section.
4. **Global search is event-based but page support is uneven.** The shell dispatches `admin:global-search`, but only scripts that listen to it will respond. Visual feedback should indicate which page is searchable.
5. **HTML semantics can be improved.** Sidebar menu items are anchors without `href` for section actions; buttons would be more semantically accurate unless hash routes are introduced.

## Responsiveness findings

1. **Mobile navigation is the main blocker.** The sidebar is moved off-screen with no overlay, open button, close button, or escape/outside-click behavior.
2. **Topbar stacks on smaller screens but action grouping may become tall.** Search, notification, and profile controls should wrap predictably or collapse nonessential actions.
3. **Wide tables rely on horizontal scrolling.** This is acceptable for admin dashboards, but mobile should include sticky first/action columns or card-style summaries for orders/products if frequent mobile use is expected.
4. **Chart cards stack at `768px`, but canvas heights are fixed.** Fixed heights may still overflow or feel cramped on smaller phones.
5. **Toolbar controls use mixed layouts.** Some use grid auto-fit, others flex. This causes inconsistent wrapping between sections.

## Accessibility findings

1. **Focus states are not standardized.** Buttons, links, filters, and table actions need visible `:focus-visible` rings.
2. **Some controls lack explicit labels.** Dashboard chart filters and product/news filters rely heavily on visual placement/placeholders.
3. **Clickable sidebar items should be keyboard-operable with clear semantics.** Anchors without `href` are not ideal for keyboard navigation; use buttons or add hash routes/hrefs.
4. **Icon-only controls need robust labels.** Sidebar collapse and notification buttons have labels; chart previous/next buttons currently use `<` and `>` without descriptive aria labels.
5. **Contrast should be checked after dark-mode overrides.** Partial-level hard-coded colors like `#fff`, `#0f172a`, and `#6c757d` can conflict with the shell's dark color scheme.
6. **Status updates should be announced.** Loading, success, error, and empty states should use `role="status"`, `role="alert"`, or `aria-live` where appropriate.

## Code quality findings

1. **Too many inline `<style>` blocks.** Admin CSS should move into one or more static files, for example `css/admin.css`, compatible with GitHub Pages.
2. **Repeated class names with different meanings.** `.filter-select`, `.empty-state`, `.btn-secondary`, and `.dashboard-header` are defined in multiple scopes.
3. **Hard-coded visual tokens are mixed with CSS variables.** The shell defines admin tokens, but partials often use raw colors and sizes.
4. **Loader responsibilities are growing.** `admin.html` initializes page-specific modules, handles navigation, search dispatching, logout, loading, and fallback content.
5. **No centralized admin component vocabulary.** A small set of reusable CSS utilities would reduce duplication without introducing any library.

## Recommended redesign direction

Use a lightweight GitHub Pages-compatible admin design system:

- **Shell:** fixed desktop sidebar, off-canvas mobile sidebar, sticky compact topbar, optional breadcrumb, active route persistence via hash/query.
- **Cards:** unified `.admin-card`, `.admin-stat-card`, `.admin-section-header`, and `.admin-grid` utilities.
- **Tables:** unified `.admin-table-wrap`, `.admin-table`, `.admin-table-actions`, sticky header, consistent cell padding, badges, and horizontal overflow.
- **Filters/forms:** unified `.admin-toolbar`, `.admin-field`, `.admin-input`, `.admin-select`, `.admin-button` variants.
- **States:** unified `.admin-state`, `.admin-state--loading`, `.admin-state--empty`, `.admin-state--error`, `.admin-alert--success`.
- **Badges:** unified status badge variants for product/news publication, order status, payment status, and shipping state.
- **Responsiveness:** desktop two-column analytics, tablet stacked cards with preserved table scroll, mobile off-canvas nav plus compact topbar.

## Prioritized refactor plan

### Critical

1. Add a mobile sidebar open/close control, overlay, escape-key close, and focus-visible styles.
2. Fix misleading navigation: either create separate Analytics/Settings partials or rename/group items to match loaded content.
3. Replace the Grow Lab placeholder with a real partial or link to `admin-grow-lab.html` if that is the supported admin flow.
4. Add a clear auth-checking/unauthorized state before sensitive admin content becomes interactive.

### High

1. Extract shell and shared component styles from `admin.html` and partial `<style>` blocks into `css/admin.css`.
2. Standardize admin cards, headers, tables, filters, badges, buttons, pagination, and message states.
3. Make global search behavior visible and consistent per section.
4. Improve table action hierarchy and use consistent edit/delete/detail controls.
5. Add descriptive labels/aria attributes to chart filters and previous/next controls.

### Medium

1. Add hash routing such as `admin.html#dashboard`, `#products`, `#orders`, `#news`, `#analytics`, `#shipping`.
2. Split admin loader logic into a small `js/admin-shell.js` module while preserving GitHub Pages compatibility.
3. Convert order/product/news mobile tables into optional compact row cards if mobile admin use is important.
4. Add shared skeleton/loading rows for every table.
5. Normalize language: either Indonesian admin labels or English admin labels, not a mix within the same workflow.

### Low

1. Add subtle microcopy for dangerous actions and bulk actions.
2. Add empty-state illustrations/icons using existing icon set only.
3. Tune dashboard chart spacing and legends after functional fixes.
4. Add lightweight documentation for the admin component classes.

## Files likely to change in staged implementation

- `admin.html` — shell markup, mobile navigation control, hash routing bootstrap, remove large inline style/script over time.
- `css/admin.css` — new shared admin design system CSS.
- `js/admin-shell.js` — optional extraction of shell navigation/loading/search logic.
- `admin-partials/admin-dashboard-content.html` — remove inline CSS, standardize KPI/chart/table markup.
- `admin-partials/admin-products-content.html` — standardize CMS toolbar, table, actions, states, labels.
- `admin-partials/admin-orders-content.html` — standardize filters, stats, table, status badges, messages.
- `admin-partials/admin-shipping-content.html` — align settings/shipping UI with shared components.
- `js/admin.js`, `js/admin-dashboard.js`, `js/admin-shipping.js` — small updates for aria live regions, global search consistency, and state rendering.
- Potential new partials: `admin-partials/admin-analytics-content.html`, `admin-partials/admin-grow-lab-content.html`, `admin-partials/admin-settings-content.html`.

## Suggested future folder structure

```text
admin.html
admin-partials/
  dashboard.html
  products.html
  orders.html
  news.html
  grow-lab.html
  analytics.html
  settings.html
css/
  admin.css
js/
  admin-shell.js
  admin-dashboard.js
  admin-content-manager.js
  admin-orders.js
  admin-shipping.js
  admin-auth.js
```

This keeps the site static-hosting friendly while separating shell, shared styling, and section behavior.

## Recommended first patch after this audit

Keep the first implementation patch intentionally small:

1. Add `css/admin.css` and move only shared shell/mobile/focus/state styles there.
2. Add mobile sidebar open/close behavior without changing data features.
3. Add hash route persistence for existing sections.
4. Rename Settings to Shipping Settings or add a lightweight Settings placeholder that links to shipping.
5. Add focus-visible and aria-live improvements.

Avoid redesigning all partials in the first patch so existing product, order, news, chart, and shipping functions remain stable.
