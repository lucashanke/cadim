# Cadim

## Commands
- `cd frontend && npm test` — run frontend tests (vitest)
- `cd frontend && npm run dev` — dev server on :5173
- `cd backend && cargo test` — run backend tests
- `cd backend && cargo run` — backend server on :3001

## Frontend Patterns
- shadcn UI components in `frontend/src/components/ui/` — available: alert, avatar, badge, button, card, chart, dialog, dropdown-menu, input, label, separator, sheet, sidebar, skeleton, tabs, tooltip
- KPI cards: use Dashboard pattern — `Card` with `group`, icon in `h-9 w-9 rounded-xl bg-{color}/10`, `hover:shadow-lg hover:shadow-black/30`, `group-hover` icon color transition
- Chart tooltips: custom component pattern with color dots, tabular-nums, total row — see CreditCardsPage.tsx
- Sheet component uses `@base-ui/react/dialog` — triggers use `render` prop: `<SheetTrigger render={<Button />}>`
- Collapsible sections: ChevronDown/ChevronRight toggle pattern (not an accordion component)

## Known Issues
- `Logo.tsx` has a pre-existing TS error (unused `r` variable) — not a regression
- recharts logs "width/height 0" warnings in tests — harmless, from jsdom having no layout
