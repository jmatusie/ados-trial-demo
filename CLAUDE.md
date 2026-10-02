# XV2.0 Network Parser -- design workspace

This repository is in design only. Nothing is being built here. The owner abandoned the earlier build effort and is redesigning the parsing system from scratch through an interview, with the aim of starting a clean repository from the result.

## Where to work

`design/` is the only live part of this repository. Start every thread by reading `design/README.md`, then `design/interview.md`, and continue from the first topic that is not confirmed.

Roles: Claude leads the interview; the owner is the domain expert. Ask a few focused questions at a time, write a summary per topic for the owner to confirm, and record confirmed answers in `design/interview.md` before the thread ends. Examples the owner gives illustrate degrees of freedom; they are not requirements unless the owner says so.

## Archived

Everything outside `design/` belongs to the abandoned effort: `specs/SPEC.md` (the old PRD), `record/`, `src/`, `tests/`, `docs/`, and the toolchain files. Read them for ideas only. They are not requirements, and nothing in them governs this work. `reference-parser/` is the owner's legacy JavaScript system, a source of ideas and not a target.

## Rules

- Do not write code, queue tasks, or run a build process unless the owner asks.
- Never force-push, reset hard, rebase, or delete a branch.
- `samples/` may hold sanitized device output. Never quote it into a commit, a file, or a reply.
- Prose is one line per paragraph. Never break a line inside a sentence.
