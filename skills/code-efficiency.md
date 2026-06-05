# Code Efficiency Review

A skill for reviewing code quality and suggesting improvements in this codebase. Always explain findings before making any changes, and never modify anything until the user approves.

## Review scope

- React best practices: unnecessary re-renders, missing cleanup, stale closures, redundant state
- JavaScript efficiency: repeated computations, avoidable object/array allocations, duplicated logic
- Firebase usage: redundant reads/writes, missing merge flags, writes that should be batched
- Component structure: props that are passed but unused, large components that could be split cleanly
- Readability: overly complex expressions that can be simplified without changing behavior

## Process — always follow this order

1. **Read** the file(s) in scope
2. **List every finding** as a numbered item before touching any code:
   - What the issue is
   - Why it matters (performance, correctness, maintainability)
   - What the fix would look like (describe or show a short snippet)
   - Risk level: **Low** (safe rename / extract) · **Medium** (logic change) · **High** (touches shared state or Firestore)
3. **Wait for the user to confirm** which findings to act on — do not implement anything before approval
4. **Apply only the approved items**, one at a time, verifying the file compiles (no syntax errors) after each
5. **Do not change** UI layout, CSS, prop names visible to other components, or Firestore document structure unless explicitly approved

## What not to flag

- Stylistic preferences (single vs double quotes, trailing commas) — the codebase has its own conventions, do not propose reformatting
- Patterns that are intentionally verbose for readability (e.g. explicit `prev =>` updaters in `useState`)
- Comments that explain non-obvious behavior
- Working code that is "not how I would write it" with no measurable benefit

## Safety checks before any change

- Confirm the symbol being changed is not exported or used outside the file being edited
- Confirm the change does not alter any Firestore field names, document paths, or collection names
- Confirm the change does not affect any prop names passed between `App.jsx` and child pages
- If any of the above apply, flag it as **High risk** and require explicit user approval before proceeding
