# Design Principles (Living Document)

This file is updated automatically whenever a correction or improvement is made to the app. Each entry captures the underlying rule so it applies consistently to all similar features — not just the one that was fixed.

---

## How this works

When the user requests a fix or correction, extract the general principle behind it and add it here. Before implementing any UI or code change, check this file and apply any relevant principles proactively.

---

## UI & Layout

- **Inline form controls stay on one row.** Input fields (minutes, teacher name, date, etc.) and their labels must sit on the same flex row. Use `flexWrap: 'wrap'` so they reflow on narrow screens rather than overflow — but do not force items to their own line. Give each input a fixed `width` (e.g. `80px`, `120px`, `140px`) so they fit compactly side by side.

- **Labels for inputs use secondary text style.** Inline labels next to inputs (e.g. "min", "Class date") use `fontSize: 'var(--fs-xs)'` and `color: 'var(--color-text-secondary)'`. Never leave an input without a visible label or placeholder that clearly tells the user what it is.

- **Flex containers with mixed inline elements need a text wrapper.** When a `display: flex` container holds both an icon and text that contains `<strong>` or other inline elements, wrap the text in a `<span>` so the flex layout treats it as a single child. Without this, each inline element becomes its own flex item and the message fragments.

---

## Cross-platform

- **All UI must work on mobile and desktop.** Every layout change must be reasoned through at both ≥ 320px mobile width and full desktop width before being marked complete. See the Cross-platform requirement in CLAUDE.md.

---

## Auth & Login

- **Use `signInWithRedirect` on mobile, `signInWithPopup` on desktop.** Google OAuth via popup is blocked in WebViews and some mobile browsers. Always check `isMobile()` and branch accordingly.

- **WeChat in-app browser cannot do Google OAuth at all.** Detect `MicroMessenger` in the user agent and show a clear "Open in Browser" instruction instead of a broken sign-in attempt. Disable the sign-in button in that context.

---

*Add new entries here whenever a correction reveals a general principle. Keep entries short and actionable.*
