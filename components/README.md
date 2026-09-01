# Shared UI Components

Shared, presentational UI components used across Guardian features.

**Status (Phase 1B-01):** intentionally empty. The first real components
arrive with the authentication pages and dashboard in later phases.

Planned conventions (from the approved Phase 1A architecture):

- Feature-specific UI lives in `features/<feature>/components/`.
- Only genuinely cross-feature primitives (buttons, badges, cards, tables)
  belong here.
- Components are server components by default; `"use client"` only where
  interactivity requires it.
