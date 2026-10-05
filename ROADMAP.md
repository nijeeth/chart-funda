# Roadmap

Future plans for Chart Funda. This file tracks ideas and planned work. It is not a promise or a schedule.

## How this file works

- Items live in one of three buckets: **Ideas**, **Planned**, and **In progress**.
- When work starts on a planned item, move it to In progress.
- When a version ships to the Chrome Web Store, remove its finished items here and record them in `CHANGELOG.md` and `WHATSNEW.md`.

## In progress

_Nothing in progress._

## Planned

**2.1.0 audit follow-ups** (from the external code review, deferred after 2.0.0):

- [ ] CF-04 — narrow the `tabs` permission: scope Chartink redirect via `webNavigation` + host permission or declarativeNetRequest.
- [ ] CF-06 — abort/dedupe in-flight fetches on fast symbol switches (generation token or AbortController).
- [ ] CF-10 — guard the 5s poll with `chrome.runtime.id` + clearInterval so orphaned content scripts stop cleanly after an extension update.
- [ ] CF-12 — evict expired cache keys; cap screener entries (LRU); check `lastError` on storage writes.
- [ ] CF-14 — authenticate the page↔content CustomEvent channel with a per-load nonce.
- [ ] CF-17 — `detectTheme` fallback should ignore fully-transparent backgrounds.
- [ ] CF-18 — YoY should pair quarters by matching period, not a fixed column offset.
- [ ] CF-19 — allowlist sector links to Screener `/market/…` paths.
- [ ] CF-20 — share the in-flight `getBseLookup` promise between concurrent callers.
- [ ] CF-21 — check `chrome.runtime.lastError` on the peers response.

## Ideas

_Nothing here yet. Add ideas as they come up._

## Shipped

- 1.0.0 — first public Chrome Web Store release. See `CHANGELOG.md`.
