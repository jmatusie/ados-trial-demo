# design/

Working area for redesigning the parsing system from scratch. This is a design effort, not a build: nothing here is implemented, and nothing outside this folder is authoritative for it.

The rest of this repository (the old PRD in `specs/`, `record/`, `src/`, `tests/`, `docs/`) belongs to an abandoned effort; `CLAUDE.md` says so for every new thread. Read it only for ideas. The owner intends to start a clean repository from what this folder produces.

## Files

The files form layers. Only the state is read at the start of a thread.

| File | Layer | Holds |
|---|---|---|
| `interview.md` | State | Confirmed decisions per topic, the proposal under discussion and its details, open questions with recommendations, parked items, and the next action |
| `legacy-notes.md` | Index | What the legacy code in `reference-parser/` shows, by topic, with line pointers |
| `research-notes.md` | Index | What the research transcript says, by topic and exchange label, with the errors found in it, and which old PRD sections bear on each topic |
| `decisions.md` | Register | Every proxy decision with its alternatives, what it rests on, what would reopen it and its reversal cost: the fork mechanism from thread 5. Read by pointer |
| `transcript.md`, then `transcript-2.md` onward, one per thread | Archive | The verbatim visible conversation of each design thread |
| `origin-xv2-research-thread-transcript.md` | Archive | Part of the originating research thread that the old PRD was distilled from |
| `PRD.md` | Output | Not written here. The owner's ados Solo Loop 3 carries `design/` into the fresh repository and writes the PRD there (Topic 10) |

Outside `design/`, the old PRD (`specs/SPEC.md`) and the legacy code (`reference-parser/`) are archive too.

## How to resume in a new thread

Read this file and `interview.md`, nothing else, then continue from the next action in `interview.md`. Thread 3 read about 260 KB before its first question, because this section used to send every thread through every source; this rule stops that.

Open anything else only to answer a specific question, and only by pointer:

- For what the legacy code, the research thread or the old PRD says, read the section of the notes file for the topic at hand.
- Open a source only where a notes file points to it for a fact the notes do not hold. A source of more than a few KB is read by a sub-agent, which returns distilled notes; write those into the matching notes file.
- Open a transcript only to check the owner's exact words on a point `interview.md` leaves in doubt.

Opening message for a new thread:

```text
Design interview, not a build. Read CLAUDE.md, design/README.md and design/interview.md, nothing else, then continue from the next action. You lead; I'm the domain expert. Commit and push design/ updates directly to main.
```

## Context budget

Model quality falls as context grows, gradually and well before the window is full. Chroma's context-rot study of 18 models, NoLiMa (most models at half their short-context score by 32K tokens) and Du and others (drops of 13.9 to 85 percent from length alone) all show it; sources are in `research-notes.md`. Practitioners call the degraded range the dumb zone.

- A new thread starts at about 46K tokens: about 39K of fixed system and tool overhead, and about 7K for this file and `interview.md`.
- Plan one topic per thread and end it near 100K tokens, earlier if answers lose focus; the owner checks with `/context`. Thread 3 grew by roughly 100K tokens per exchange, mostly from reading and reasoning.
- Compaction keeps a long thread running but does not restore its quality. A new thread resuming from `interview.md` does.

## How to conduct the interview

These come from mistakes made in earlier threads. Each one cost the owner time.

- Proxy mode, from thread 5: the owner delegated the remaining design decisions (`interview.md`, header). Surface each group's decisions with their options and costs, decide as the owner's proxy, record each in `decisions.md` and one line in `interview.md`, push after each decision set, and end the turn after each group so the owner can veto. Ask the owner only for domain facts, priorities and vetoes; the rules below apply to those questions.

- Before asking a question, check `interview.md` and the notes files. Never ask what they already settle. Asking whether authors may write host code, and whether definitions are text, were both examples of this. Checking never means rereading a source the notes already cover.
- Examples the owner gives illustrate degrees of freedom. Never turn one into a requirement. The five grain patterns of the old PRD were examples and became acceptance targets, which started the loss of context.
- This effort designs an engine, its primitives and a portable IR, with a DSL designed after the IR. Engineers write domain parsers; this project never does. Everything is a parser.
- Speak up when the owner's framing seems off. The owner asked for this explicitly. Separate concepts the owner may be merging, and say which parts are right.
- Think hard. The owner raised the reasoning effort because answers were losing focus. Ground proposals in the theory the owner works from (logic, knowledge theory, applicative, selective and monadic combinators) and in the legacy code, through the notes.
- Ask two to four focused questions per turn, early in the thread. End each topic with a summary for the owner to confirm, and record it in `interview.md` before the thread ends.
- Give every question its full context in the question itself: what it decides, a concrete example, the options with their costs, and a recommendation. The owner asked for this in thread 4, where C1 to C4 had to be asked again with their context.
- The owner reads on a phone: headings, short tables, one line per paragraph, ASCII only. Keep replies short.
- Decision records, from G3 on, asked for by the owner in thread 6 (`transcript-6.md`, message [5]) after finding the G1 and G2 records hard to review: write each record so the owner can review it cold, in five parts, in this order: the question, why it matters, the options with what choosing each one commits to, the choice with its rationale, then the register fields. The same layout goes in `decisions.md` and in the end-of-group report. G1 and G2 keep their older layout; the owner did not ask for a rewrite.

The record template, from G3 on:

```markdown
### `T6-01` <short title>

**Question.** <one line: what is being decided>

**Why it matters.** <what depends on it, and what goes wrong if it is decided badly, with a concrete example>

**Options.**

| # | Option | What it means | What choosing it commits to |
|---|---|---|---|
| A | <name> | <one line> | <cost, risk or consequence> |
| B | <name> | <one line> | <cost, risk or consequence> |

**Choice.** <letter and name>. <two to four sentences of rationale, tied to the owner's priorities or earlier decisions by ID>

- Status: proxy.
- Rests on: <IDs>.
- Revisit if: <signal; `(spike)` when a prototype should test it>.
- Reversal cost: <low, medium or high>.
```

## Keeping the state small

- `interview.md` holds decisions, the current proposal and its details, open questions with their recommendations, parked items and the next action. Reasoning stays in the thread's transcript, and evidence goes to the notes files. Keep it near 20 KB by moving evidence and reasoning out, never by dropping a decision, a proposed detail or an open question.
- A thread that reads a source writes what it learned into the matching notes file before it ends, so no source is read twice for the same thing. `legacy-notes.md` (thread 2) and `research-notes.md` (thread 3) are the examples.

## Saving work

Commit and push `design/` changes to `main` after every topic and before a thread ends, so the next thread sees them. Each thread keeps its visible conversation in its own transcript file (`transcript-3.md`, `transcript-4.md` and so on), appended before every push and never read at start. A cloud session is normally assigned its own `claude/*` branch and told to push only there; the owner authorizes pushing design work to `main` in the opening message. If a thread did push to a branch instead, merge it into `main` before starting the next thread.
