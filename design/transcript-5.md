# Transcript -- thread 5

The visible conversation of design thread 5, appended before every push and never read at start. Headings inside a message are demoted two levels so they nest under the message heading; the text is otherwise verbatim.

---

## [1] Owner

Design interview, not a build. Read CLAUDE.md, design/README.md and design/interview.md, nothing else, then continue from the next action. You lead; I'm the domain expert. Commit and push design/ updates directly to main.

---

## [2] Claude

### Topic 4a -- core versus library: proposal and D1 to D4

I read only the 4a sections of the notes. Below are four questions, each with its context, options and my recommendation. `D3` is the worked split you asked for. Answer by ID; short answers are fine.

---

#### D1. Three tiers instead of two

Decides: what "first-class" means in the IR spec, and what every runtime must write natively.

The word merges two questions that the equivalence rule in `T4-01` already separates: what defines an operator's meaning, and whether a runtime runs it as native code. Any operator may run natively if it passes the equivalence test, so speed alone never needs a bigger kernel.

Example: `take_until('!')` is defined as the span of `many(seq(not('!'), any))`. The legacy form of this was "almost unusable" (`everythingUntil`), so the spec adds a cost bound, linear in the region, which every runtime meets by scanning natively. Its meaning stays the composition.

The three tiers, by where meaning comes from and what each runtime writes:

| Tier | Meaning from | Native in every runtime |
|---|---|---|
| Kernel | the spec: prose plus conformance tests | yes |
| Required native | a reference composition plus a cost bound | yes, to meet the bound |
| Library | a reference composition | optional, with the equivalence test |

The options and their costs:

| Option | Cost |
|---|---|
| (a) Two tiers, native only in the kernel | Every speed-up grows the kernel; each kernel operator needs a prose spec, conformance tests, a case in every analysis, and code in every runtime |
| (b) Three tiers | One more idea; meaning stays executable outside the kernel, so equivalence is tested by running both forms on generated inputs |
| (c) Everything native, as in the legacy | Drift between runtimes, and the largest port |

Recommend (b). A new runtime writes the kernel and the required natives, and interprets the rest until profiles say otherwise.

---

#### D2. Criteria for each tier

Decides: what earns a place in the kernel or among the required natives. Everything else is library.

Kernel, only if one of these holds:

- `K1` Inexpressible: no composition has the same meaning, as for `not`, `bind` and `run_on`.
- `K2` Analysis: its only composition goes through `bind`, which marks the result value-dependent and makes analyses conservative (can it match empty, what can it start with). Examples: `seq`, which `bind` can express, and `many`, whose progress check compares two positions.
- `K3` Host leaf: hosts differ, so the spec pins it. Examples: the regex dialect, case folding, character classes, and position units (JavaScript counts UTF-16 units, Python code points).

Required native, only if one of these holds:

- `N1` Its composition is in a worse time or memory class on realistic inputs: 500 MB, or many small parses.
- `N2` Profiles on realistic inputs show it dominates.

You named three more possible reasons. I propose none of them promotes an operator:

- Tracing: a named operator is one step in the trace in any tier, and `label` sets the wording of its errors. A debug mode may run the composition to show the inside.
- Static analysis beyond `K2`: analyses are compositional, so a library operator gets them from its composition, while each kernel operator adds a case to every analysis.
- Identical behavior across runtimes: a composition guarantees it. Native code is what drifts, which is why the equivalence test exists.

How many runtimes must implement an operator is the cost side of the balance, not a criterion.

Recommend adopting `K1` to `K3`, `N1`, `N2` and the three exclusions.

> Net effect: meaning alone decides the kernel, cost bounds decide speed, and names and labels decide trace and error granularity.

---

#### D3. The worked split

Decides: the kernel list, and the placements the notes left open.

The kernel, 15 operators, by group:

| Group | Operators | Criterion |
|---|---|---|
| Leaves | `literal(v)` with case and spacing options, `regex(p)` | `K3`; `K1` for a literal from a parsed value, which may not enter a regex (C4) |
| Structure | `seq`, `alt`, `many` | `K2`, `K1`, `K2` |
| Zero-width | `not`, `peek`, `here`, `guard` | `K1` |
| Values | `transform`, `bind`, `ref` | `K2`, `K1`, `K1` |
| Effects | `label`, `emit`, `run_on` | `K1` |

The less familiar ones:

- `peek(p)` returns p's value without consuming; `here` returns the current position; `guard(c)` succeeds without consuming when a condition on values holds.
- `emit(channel, v)` writes to a side channel (log, provenance, unrecognized, unparsed); the spec fixes each channel's rollback rule.
- `run_on(text, p)` runs p on a sub-input as a wall: a span, gathered pieces or synthesized text. It consumes nothing in the parent and reports whether p read it whole.

Kernel types, not operators: positions and spans, text references, tagged values, and the four absence states. Line, column and indent of a position carry a cost bound. `transform` and `guard` call core data functions, whose set is Topic 5's.

Required native: only `take_until`, when its terminator is a literal, a fixed regex, a line test or an indent end (`N1`, the `everythingUntil` lesson). Nothing else yet: there are no profiles.

The library, by family, with what each is built from:

| Family | Operators | Built from |
|---|---|---|
| Values | `succeed`, `fail` | `transform(here, ...)`, `not(here)` |
| Text | `any`, `eof`, `rest_of_line`, `take_while`, whitespace, `token` | `regex`, `not`, `seq` |
| Repetition | `optional`, `many1`, `repeat(min, max)`, `sepBy`, `between`, `manyTill`, `except`, `setOf` | `alt`, `seq`, `many`, `not`, `ref`, `guard` |
| Position | `span`, `at_column`, `advance_by` | `here`, `guard`, `bind`, `repeat` |
| Regions | `region(finder, p)`, `until`, indent level, column span, run of lines | `bind(span(finder), s -> run_on(s, p))`, `take_until` |
| Grain | tags, boundaries, `section`, `child`, `accumulate_by` | `transform` with core data functions, plus a region for `section` |
| Control | `dispatch`, `recover`, catch-all, `skip`, residual | `alt`, `guard`, `bind`, `span`, `emit` |
| Checks | `count_between`, all of, any of, none of, exactly N of, at least N of | `peek`, `not`, `alt`, `transform` |
| Output | `log`, the provenance option | `emit`, `span` |

The open placements, with my answer for each:

- `section` (`E20`): library, a region plus a boundary. It is still one named step in traces, and its speed comes from `take_until`.
- All of, any of and the other counting forms: library over `count_between`, itself library. Nothing in them needs the kernel.
- `E07`'s match-first, match-any and match-all: `alt` is match-first; as tests at a position, any and all are counting forms. If match-all meant keeping every parse, ordered choice excludes it; say if you need it.
- `many`: kernel by `K2`, `E04`'s conclusion for a sharper reason. Haskell's `Alternative` defines `many` by recursion, but that version loops forever when p matches empty, and the progress check needs `bind`.
- `regex`: kernel by `K3`, with no reference composition required. This answers thread 3's question: a composition exists (the continuation translation of Medeiros, Mascarenhas and Ierusalimschy, which uses recursion), but it is generated per pattern, so it serves only as a test oracle.
- Tags and boundaries: library, `transform` with a tagged value and a collect function. Tags are values, so a failed branch drops them with no rollback machinery.
- Output context, filldown versus explode: library either way; where it lives stays with Topic 5.

Recommend confirming the split, or naming operators to move.

> Net effect: 15 kernel operators and 1 required native, where Topic 1's families list about 35 operators outside the derived library; everything else is library with a composition.

---

#### D4. A unique name tagged twice

Decides: what a unique boundary holds when a name marked unique is tagged twice beneath it. Deferred from Topic 3.

Example: under an interface boundary, `mtu` is unique, and two lines of one block yield 1500 and 9214, from a grammar slip or from output that changed between releases.

The options and their costs:

| Option | Cost |
|---|---|
| Error | One odd line fails the whole record |
| First or last wins | Silent loss, against `T4-13` (nothing vanishes implicitly) |
| Conflict value | A new state that consumers must handle |

Recommend a conflict value by default: the field holds every candidate in order, each with its span, and equal duplicates collapse to one value. In Belnap's four-valued logic this is "both" (too much information), beside the "neither" (no usable value) that the four absence states refine. An author may declare first, last or error per boundary.

---

Recorded in `interview.md` as the 4a proposal and pushed to `main`.

---

## [3] Owner

I'd like to figure it a way to make a "fork" on these  answers - I like to answer one way, and hope it works for the best (maybe try early prototyping so we don't get too far), and then go back to this point to try other options.  

Because I really do not know how to answer your questions.  They're getting very specific now in terms of detailed design or implementation decisions.   If we get defer the actual. DSL. Syntax for now - we can figure that out later.  But if you know enough to know what my requirements are (don't forget about performance and memory),.. but intuitive usability is the key.  And based on the research you've done on the legacy code - you have an idea of the general shape. 

That being said.  Here's what I like you from that one: 

Record the decisions that you recommend as my (be sure to record that you are the proxy).

Then for the remaining sets of design decisions - explicitly surface them,. Weigh  the considerations/tradeoffs, and then make another proxy decision. 

And continue this until you reach a reasonable point where you can actually write a PRD and maybe even write a plan, that we could take to a fresh repo, and initialize it with ados, and start iterating. 

If there's anything I don't like - you can go back to decisions and we can discuss. 

Do you agree?  

Do not go fully unattended - commit to main and push often - after each decision group. . When it's time to clear or compact. the context - I could do that manually and then paste The Prompt again.  Until you decide to stop.

---

## [4] Claude

### Proxy mode -- agreed, with three refinements

Yes, I agree. Your part becomes vetoes, domain facts and priorities. I surface each decision group, weigh it, decide as your proxy, record it, and push.

---

#### The fork mechanism

A new file, `design/decisions.md`, is the fork. Each proxy decision keeps what it rejected, what it rests on, and what would reopen it:

| Field | Holds |
|---|---|
| Status | `proxy`, `confirmed`, or `superseded by <ID>` |
| Alternatives | the options not taken, with their costs |
| Rests on | the decisions it depends on |
| Revisit if | the signal that reopens it; `(spike)` marks one to prototype first |
| Reversal cost | low, medium or high, once code exists |

Going back is a supersede: the vetoed decision keeps its record and gets a successor, and every decision resting on it reopens. Each decision set is also a commit on `main`, so every earlier state stays in the history.

> Net effect: deciding now loses nothing; each alternative stays one supersede away.

---

#### Three refinements

- Prototypes go in the new repository: `CLAUDE.md` keeps this one design-only. The plan's first milestone will be spikes against the decisions marked `(spike)`, so a wrong proxy call surfaces early and cheaply.
- My order of considerations, so you can audit each call: your confirmed decisions; then intuitive authoring, the key; then memory and performance as hard limits (500 MB inputs, many small parses); then portability and a small core.
- What I still need from you: domain facts (how EOS output behaves), priorities, and vetoes. I will ask only those, one line each.

I read "initialize it with ados" as ADRs: each record in `decisions.md` becomes an ADR in the new repository. Say if you meant something else.

---

#### G1 done: Topic 4a, by proxy

`D1` to `D4` are now proxy decisions `T4a-01` to `T4a-06`:

| ID | Decision |
|---|---|
| `T4a-01` | Three tiers: kernel, required native, library |
| `T4a-02` | Kernel only by `K1` to `K3`; required native only by `N1`, `N2` |
| `T4a-03` | A kernel of 15 operators |
| `T4a-04` | Only `take_until` is required native; the rest is library |
| `T4a-05` | `section` and counting forms library; `many` and `regex` kernel; tags are values |
| `T4a-06` | A unique name tagged twice gives a conflict value by default |

Pushed to `main`, with `interview.md` and `README.md` switched to proxy mode.

---

#### The road to the PRD

One group per thread, each decided by proxy, pushed per decision set, and closed with a short report for your veto:

| # | Group | Main decisions |
|---|---|---|
| G2 | Topic 5, data processing | data operations, collect functions, filldown versus explode, joins, absence propagation |
| G3 | Topic 6, runtime | the IR as a shipped artifact, memory model, regex cost, position unit, reference runtime |
| G4 | Topic 7, diagnostics | logs, trace, debug mode, error reports, what equivalence compares |
| G5 | Topic 8, proof | conformance suite, equivalence tests, benchmarks, acceptance |
| G6 | Topic 9, framing and v1 scope | personas, the v1 cut, what the IR carries for the deferred DSL |
| G7 | Topic 10, PRD and plan | `PRD.md`, then the plan: spikes first, ADR seed |

---

#### Next step

This thread is at its context budget, so I stop here rather than start G2 in a degraded context. Clear the context and paste the usual opening prompt; `interview.md` now sends the next thread into G2 in proxy mode.

---

## [5] Owner

Finish topic 4a (if it's not done).

---

## [6] Claude

### Topic 4a -- closed

It was decided but not finished. Closing it turned up one flaw in my own call and three unpinned kernel details. All four are now decided by proxy and pushed.

---

#### One correction, using the fork

`T4a-05` made tags values that a boundary collects. That lets a transform drop a tag or a fragment mark without anyone noticing, so authors would have to reason about nesting again, which Topic 3 set out to avoid.

`T4a-07` supersedes that part: a tag registers a field with the nearest record, and `record` joins the kernel, which now has 16 operators. What it gains:

| Gain | Why |
|---|---|
| Usability | a record holds exactly what was tagged; no transform can lose a field |
| Memory | records never walk the value tree, so the engine may skip building values nothing reads, where the legacy spent memory |
| Simplicity | one trail rolls back tags, marks and provenance |

`T4a-03`, `T4a-04` and `T4a-05` keep their records, marked as amended.

---

#### The new decisions

| ID | Decision |
|---|---|
| `T4a-07` | Tags and marks go to the nearest `record`, which turns fragment, unrecognized and unparsed marks into absence states |
| `T4a-08` | `emit` carries tags, marks, provenance and logs; the first three follow the kept path; `peek` and `not` keep nothing |
| `T4a-09` | Every parse terminates: `many` stops at an empty iteration, left recursion fails, and nesting without progress is capped |
| `T4a-10` | Leaf pins: ASCII case folding; patterns stored as syntax trees in a dialect five engines share; named groups become tags |

`T4a-10` suits TextFSM habits: `(?<name>\S+)` in a pattern registers `name` with the record, so one fast regex per line still works.

> Net effect: 4a is closed with 16 kernel operators and 1 required native. Every open item is decided or assigned to Topics 5 to 7.

---

#### Next

Clear the context and paste the usual opening prompt. The next thread starts G2, Topic 5, in proxy mode.
