# QureFlow design context

This is the local MySQL DBMS variant of the established clinic application. The migration preserves the existing visual identity and routes.

The local synthetic demo administrator has an explicit all-clinic workspace, labelled in the shared sidebar. The shared Select component chooses among doctor queues and individual clinics for settings and analytics. Preserve normal staff clinic boundaries; this capability is enabled only by the local DBMS entry point and verified server-side.

- Canonical runtime tokens: `src/index.css` and `tailwind.config.js`; no duplicated generated theme.
- Existing colors: navy `#102e3d`, primary teal `#087b91`, canvas `#f5f8fa`, border `#dce7eb`; status colors remain semantic.
- Existing type: Manrope headings, Inter/system body, monospace token identifiers.
- Patient screens prioritize finding care, booking and readable queue status. Staff screens prioritize dense, accurate tables and clear operational actions.
- Keep specialty colors, shared controls, mobile navigation, responsive tables, visible focus and reduced-motion rules.
- Query-driven lists show pending, error, empty, success and pagination states. SQL owns filtering and ordering; the frontend renders returned rows.
- Demo records remain clearly labelled synthetic. No claim of affiliation with a real hospital.
- Android starts with automatic clinic discovery; an IP field appears only in advanced settings.
- Keep existing screens mounted during a connection check. Offer retry on failure and a named choice when several clinic servers are found.
- Remember the installation identity as well as the address; never silently switch a returning user to a different clinic.
- Refresh directory and shared read-only data after connection verification without resetting filters; failed directory loads offer an explicit retry.
