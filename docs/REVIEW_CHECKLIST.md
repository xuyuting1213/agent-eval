# Review Checklist

Use this checklist when reviewing each delivery step.

## Scope and clarity

- [ ] Goal of this step is clear and small enough to review
- [ ] Non-goals are explicit
- [ ] Change matches agreed roadmap step

## Code quality

- [ ] TypeScript types are complete and reasonable
- [ ] No obvious duplicated logic
- [ ] Naming is clear and consistent
- [ ] Complex logic has concise comments where needed

## API and data

- [ ] API routes are under `server/api/`
- [ ] Input validation is present where required
- [ ] Error handling is explicit and user-safe
- [ ] DB access uses Prisma (when database is involved)

## Config and runtime

- [ ] Required env vars are documented
- [ ] Dev/prod behavior is intentional and tested
- [ ] No secrets are hardcoded

## Verification

- [ ] Local run/build commands still pass
- [ ] Lint/type checks pass (if configured)
- [ ] Relevant manual test steps are documented

## Documentation

- [ ] `docs/WORKLOG.md` is updated for this step
- [ ] `docs/ROADMAP.md` progress is updated
- [ ] README updates are included if behavior changed
