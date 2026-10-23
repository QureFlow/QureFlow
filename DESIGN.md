# QureFlow design context

- Canonical runtime tokens: `src/index.css` and `tailwind.config.js`; no duplicated generated theme.
- Colors: navy `#102e3d`, primary teal `#087b91`, canvas `#f5f8fa`, border `#dce7eb`; status colors remain semantic.
- Type: Manrope headings, Inter/system body, monospace token identifiers.
- Patient screens prioritize finding care, booking and readable queue status. Staff screens prioritize dense, accurate tables and clear operational actions.
- Keep specialty colors, shared controls, mobile navigation, responsive tables, visible focus and reduced-motion rules.
- Query-driven lists show pending, error, empty, success and pagination states. The API owns filtering, ordering and counts; the frontend renders returned rows.
- Waiting-time estimates are shown as an approximate figure with its likely range, and are always labelled as estimates.
- Demo records remain clearly labelled synthetic. No claim of affiliation with a real hospital.
- The synthetic demo administrator has an explicit all-clinic workspace, labelled in the sidebar; the shared Select component chooses among doctor queues and clinics. Normal staff stay inside their clinic, enforced server-side.
- Android connects directly to an HTTPS API, or discovers a clinic computer on the same Wi-Fi; an IP field appears only in advanced settings.
- Keep existing screens mounted during a connection check. Offer retry on failure and a named choice when several clinic servers are found. Never silently switch a returning user to a different clinic server.
