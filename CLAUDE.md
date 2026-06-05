This is a live class management app that is used by 10+ users. Unless instructed, all the main features, format and user data should remain the same. Significant modification of the app should be set up seperately and tested thoroughly before deployment.

## Cross-platform requirement

All features and UI must work correctly on both **desktop** and **mobile web browsers**. When implementing or reviewing any change:

- Layouts must be usable on small screens (≥ 320px wide) without horizontal overflow or clipped content
- Touch targets (buttons, inputs) must be large enough to tap comfortably on mobile
- Flex/grid containers that hold inline inputs must use `flexWrap: 'wrap'` so elements reflow gracefully on narrow screens instead of overflowing
- Font sizes, spacing, and visual hierarchy must remain consistent and readable on both platforms
- Do not hardcode pixel widths for containers — use percentages, `flex: 1`, or `max-width` patterns that adapt to screen size
- Always test or reason through the mobile layout before marking a UI change as complete

## Project skills for this repo

- [Develop](skills/develop.md)
- [Review & Modification](skills/review-and-modification.md)
- [Testing](skills/testing.md)
- [Publish](skills/publish.md)
- [Code Efficiency Review](skills/code-efficiency.md)

> Use these skill guides to map features, files, and workflows for safe updates and deployments.