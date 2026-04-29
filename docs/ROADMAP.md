# Project Roadmap

This document tracks planned implementation steps for this Nuxt3 project.

## Phase 0 - Foundation

- [x] Initialize Nuxt3 + TypeScript project
- [x] Configure TailwindCSS module
- [x] Add runtime environment config
- [x] Add development proxy config
- [x] Define Cursor project rules in `.cursor/rules/`

## Phase 1 - Basic App Skeleton

- [x] Create `pages/index.vue` as a usable home page
- [ ] Add base layout in `layouts/default.vue`
- [ ] Add shared UI components in `components/`
- [ ] Add common composables in `composables/`

## Phase 2 - API and Data Layer

- [x] Add simple API endpoint in `server/api/hello.get.ts`
- [ ] Add first API endpoint in `server/api/health.get.ts`
- [ ] Add Prisma schema and DB connection setup
- [ ] Add first business API endpoint with validation and error handling
- [ ] Add shared response/error shape for APIs

## Phase 3 - Engineering Quality

- [ ] Add lint config and lint script
- [ ] Add formatter config
- [ ] Add basic test setup (unit and API smoke test)
- [ ] Add CI workflow for lint/build/test

## Notes

- Keep each step small and reviewable.
- Update this file whenever scope changes.
