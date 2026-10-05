# Working notes

## Release tracking files

- `ROADMAP.md` — future plans. Items move Ideas → Planned → In progress, and are removed when shipped.
- `BUGS.md` — known bugs and their status (Open / In progress / Fixed awaiting release).
- `WHATSNEW.md` — highlights for the current release only. Rewritten each release.
- `CHANGELOG.md` — updated **only when the user says a version is done and ready for the Chrome Web Store**. New releases are prepended as a new section; never rewrite or remove previous version text.
- `NEXT-RELEASE.md` — staging file for the in-development version. Everything changed since the last shipped release gets logged here as work happens; its contents are moved into `CHANGELOG.md`/`WHATSNEW.md` when the version is declared done.

## Project

Manifest V3 Chrome extension, no build step. Load unpacked from this folder to test; reload the extension and refresh the TradingView tab after changes.

This folder is git-linked to `github.com/nijeeth/chart-funda` (remote `origin`, branch `main`). Tag `backup-2026-10-05` is the pre-fix revert point — `git checkout backup-2026-10-05` restores the shipped v1.0.0 state.
