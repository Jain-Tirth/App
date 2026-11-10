## graphify

This project has a graphify knowledge graph at `graphify-out/`.

Rules:
- Before answering architecture or codebase questions, read `graphify-out/GRAPH_REPORT.md` for god nodes and community structure.
- Navigate with `graphify query "<question>"`, `graphify explain "<symbol>"` and `graphify path "<A>" "<B>"` instead of reading raw files first. Open source only to verify a graph claim or fill a gap.
- After modifying code files, run `graphify update .` (AST-only, no API cost). Inside the agent loop the `graphify` subagent owns this step and writes `.loop/graphify-report.md`.
- The `wiki/` directory is retired. Do not reference it, depend on it, or recreate it.

## Agent loop

The coder → graphify → tester → reviewer loop is defined in `.opencode/agents/`. The `github` subagent is the only agent allowed to publish, and only when `.loop/phase-status.md` says `STATUS: COMPLETE`.

## Repository hygiene

- `.loop/`, `graphify-out/`, `.codebase-memory/` and `opencode.json` are local-only and git-ignored. Never commit or push them.
- `docs/superpowers/` is legacy planning material and is git-ignored. `SPEC.md` and `spec/` are the source of truth.
- Media and binary document assets (`pdf`, `jpeg`, `png`, office documents, archives, audio/video) are git-ignored and kept on disk only. The only exception is the PWA runtime assets under `UserWeb/public/` (icons, favicon, hero and logo), which are tracked.
- The `github` subagent uses `git` for every repository operation and `gh` only for pull-request operations. It publishes to `origin` (`Jain-Tirth/App`) on a dedicated `phase/<n>` branch. Never push, fetch from, or otherwise use `upstream`.
