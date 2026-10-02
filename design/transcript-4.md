# Transcript -- thread 4

The visible conversation of design thread 4, appended before every push and never read at start. Headings inside a message are demoted two levels so they nest under the message heading; the text is otherwise verbatim.

---

## [1] Owner

Design interview, not a build.

Read CLAUDE.md, design/README.md and design/interview.md, nothing else, then continue from the next action.

Ask me the interview questions remembering to provide full context.

You lead; I'm the domain expert.

Commit and push design/ updates directly to main.

---

## [2] Claude

### Topic 4 -- open questions C1 to C4

Thread 4 resumes at the next action: your answers to `C1` to `C4`. Each question below carries its own context, options and my recommendation. After your answers I write the Topic 4 summary for you to confirm.

---

#### Where Topic 4 stands

Settled so far: authors never write host code; definitions are DSL text loaded at runtime; the author picks the form of context by picking the combinator; a sub-parser runs on a region with its own local counters (legacy `untilEndOfIndentLevel(sub)`); and the monadic form is available by choice, because the legacy BGP parser needs `header.chain(peer => entries(peer))`.

My proposal splits contextual parsing into three independent axes; each combination is a combinator the author picks.

| Axis | Plain form | Richer form |
|---|---|---|
| Input | same input | a region, run as its own sub-input |
| Choice | a fixed parser | one picked from a declared set by a parsed value |
| Values | none | earlier values passed as parameters to a declared parser |

With no host code, a monadic step always continues into a declared parser plus values. The IR stays a finite graph, and only the value-dependent parts lose some static checks.

These terms recur below.

| Term | Meaning |
|---|---|
| Region, sub-input | a view (offset, length) into the parent's text; its end is the child's end of input |
| Expected-absent | an expected field is known to be missing, because its text was seen whole |
| Unknown | cannot tell, because the child did not take all of its text |
| Frozen dialect | the regex subset every runtime runs identically, checked at load |

---

#### C1. Context beyond explicit parameters

##### Context

"Context" covers three different things, and only the third is open here.

| Kind | Example | Where it goes |
|---|---|---|
| Output context | VRF name stamped on each peer row | Topics 4a and 5, since it never steers matching |
| Passed parse context | the peer address steers the lines after it | explicit parameters (Values axis) |
| Ambient parse context | a value any nested parser reads without it being passed | this question |

##### Options

Three options for ambient context, with the theory each comes from.

| Option | Theory | Cost |
|---|---|---|
| A. Explicit parameters | function arguments | verbose when passed through many levels |
| B. Declared context | Reader: read-only, scoped | none in the IR: the engine rewrites B into A at load (implicit parameters) |
| C. Mutable parse state | State: read and write | rollback on every backtrack; defeats memoizing and static checks |

Example for B: inside `address-family ipv6`, the section binds the address family once, and a nested prefix parser reads it without every parser in between passing it along.

I found no network-text case that needs C: counters are list positions, filldown is output context, config modes are nested regions, and a delimiter chosen by the data is a parameter.

##### Gap: values from the caller

The legacy `deviceName` comes from the orchestrator, not from the text. Proposal: the top-level parser declares typed run arguments. They count as input, so definition + text + arguments always give the same result, and nothing else (clock, environment) can reach a parse.

> Recommendation: A in the IR, B as optional DSL sugar, C out; caller values arrive as declared run arguments.

Your call: agree? Do you have a case for C?

---

#### C2. Leftover text inside a region

##### Context

The parent resumes at the region's end whatever the child did, so text the child did not take must be accounted for, or it vanishes silently. The child's outcome also decides expected-absent versus unknown: a region seen whole licenses a local closed-world assumption, and a fragment does not.

The child can end in four ways; a catch-all is a last alternative that takes any line.

| # | Child outcome | Region result | Missing expected field |
|---|---|---|---|
| 1 | took all of it | whole | expected-absent |
| 2 | took all, some lines via a catch-all | whole; those lines listed as unrecognized | expected-absent (see C2b) |
| 3 | stopped early | fragment; tail listed as unclaimed | unknown |
| 4 | failed | the sub-input fails; skipping it is recovery's job | decided by the parent |

##### C2a. Lenient or strict

Recommendation: lenient by default, and strict is written, not switched: end the child with `eof`, which inside a region means the region's end. A strict child fails unless it took the whole region, so the parent can try another parser on it. This is PEG's `!.` idiom.

Supporting rules: the fragment mark and tail belong to the path that made them, so backtracking discards them and only the debug trace keeps the attempt; a fragment turns to unknown only the fields its parser could have produced; the fragment mark is kept even with provenance off, because it decides expected-absent versus unknown.

##### C2b. Row 2 is weaker than it looks (new)

Row 2's expected-absent only means "not among the lines this parser recognizes". If a later EOS release changes a keyword, the setting lands in the catch-all and reads as absent: "must have" checks then fail loudly, but "must not have" checks pass silently.

| Option | Effect |
|---|---|
| a. Row 2 stays expected-absent | drift visible only through the unrecognized list |
| b. Any unrecognized line makes missing fields unknown | sound, but expected-absent rarely survives, since parsers ignore most options |
| c. (a) by default; an expectation can require a fully recognized region, giving unknown otherwise | sound where the author asks for it |

> Recommendation: C2a lenient, with `eof` for strict; C2b option (c), plus an explicit `skip` for lines the author declares irrelevant, which are neither listed nor unrecognized. `skip` also keeps a 500 MB run from listing millions of lines.

Your call: agree on C2a? Which option for C2b?

---

#### C3. Assembled sub-inputs

##### Context

Topic 2 said "one parser takes another parse's output as its input", and Topic 4 said a sub-parser "operates on the results of a parent parser". I read both as one mechanism, with three ways to build the child's input.

| Kind | What it is | Example | Copies text |
|---|---|---|---|
| a. Region | a view into the parent's text | the indented block under `router bgp` | no |
| b. Gathered | original pieces, stitched | a table cell whose text wraps onto the next line | yes, small |
| c. Synthesized | new text derived from values | an unescaped or decoded string | yes, small |

Provenance stays exact for (a) at no cost, and for (b) through a segment map; for (c) it points to the source values' spans.

The column-span region kind proposed earlier already needs (b) whenever it spans more than one line. EOS JSON strings arrive already decoded by the orchestrator (Topic 2), so they do not need (c).

If "output" meant structured rows rather than text, that is pattern matching over data, which belongs to Topic 5.

> Recommendation: support all three in the IR, with (a) as the default and the only zero-copy kind.

Your call: was (a) what you meant in Topic 2? Do you have cases for (b) or (c)?

---

#### C4. Parsed values inside regex patterns

##### Context

The Values axis lets parsed values flow into literals, counts, positions and columns, dispatch keys, and parameters of named parsers. The question is whether a value may also become regex pattern text.

A pattern can be fixed at one of three times.

| Binding time | Example | Checked before running |
|---|---|---|
| Authoring | written in the definition | yes |
| Load | a constant argument such as `kv('remote-as')`, or a pattern the caller binds at load | yes, once, then run many times |
| Run | built from a parsed value or a run argument | no |

##### Why not at run time

Three points carry the recommendation.

- The frozen-dialect check and the cost bound both need the pattern before running. V8 and Python backtrack, so `(a+)+$` can take exponential time with no backreference at all.
- An escaped value is just a literal, and an unescaped one changes the pattern (`Ethernet1/1.100` contains `.`). A literal between two regexes does the same job.
- Slack in matching (case, spacing) is an option on the literal. Semantic equality (`Et1` versus `Ethernet1`) is: parse the token, then compare values in a zero-width check. That adds comparisons to the list above.

The one loss: a regex cannot give characters back to a value after it. `a*ab` matches `aab` as one regex, but `a*` then the literal `ab` fails. That is rare in network text, where values sit between spaces or punctuation.

> Recommendation: patterns fixed by load time; parsed values and run arguments never enter a pattern.

Your call: agree? Do you know a case where a pattern must come from the text itself?

---

#### Answering

Short answers are enough, for example "C1 agree, no case for C; C2a agree, C2b (c); ...". Anything you add or correct goes into `interview.md`.

Saved: the re-asked questions, with the new C2b and C4 points, are in `design/interview.md` and `design/transcript-4.md`, pushed to `main`.

---

## [3] Owner

C1:  I and a little out of my league with answering this, so I am inclined to agree with you.  However - there was one concern of mine and I wasn't sure when to bring it up: as you know, the legacy parser - as it's implemented, is mostly pure with Immutabiity.  It comes at a cost of extremely high memory utilization (perhaps some CPU time due to memory overhead and GC).  In a separate repo I had asked a reasoning model to analyze it for performance.  It suggested changes to the core engine - which involved mutable parsers which would break any parser that had access to the core.  However any parsers/modules that imported the library could still compose them.  This, many of the "template" modules (e.g. `eos-cfg` were able to be reused.  I have not specifically tested this, but it seemed like it was simply based on substitution principles. I am mentioning this because I saw the word "mutate" being used, I wondered if this was related to the use case you mentioned.   My hope Is that with the engine (I think it's an interpreter loop?) implementation will be reasonable with memory (it does not have to try hard - it just needs to maintain a reasonable space complexity and not trying to overflow the stack).  Anyway that is my C1 answer.

C2: I accept your recommendations as my decisions for both C2a and C2.

C3: (a) was what I meant.  This should probably not be overthought - in Typescript (and in the legacy implementation), string .slice() is used a lot.- which on one hand is officially a "copy", and not a "view", but given that the strings are immutable, they behave that way anyway (and under the V8 hood, sliced strings may simply be real views anyway -  I don't want to overthink certain implementations simply because the specs say so.  It would be a shame if you introduce an entire layer just to provide a "view", when all you need to do is slice().  I cannot speak to the Python engine implementation whether strings  have similar treatment  - so we need to be careful about how I have just said this.  Just take everything into consideration - and allow me to simply accept your answer is my answer (unless I just invalidated your question anyway).

C4: I agree - parsed values never become part of a pattern.

---

## [4] Claude

### Topic 4 -- answers recorded, summary to confirm

Your four answers are recorded. Two raised points worth separating out, covered first; the Topic 4 summary for you to confirm follows.

---

#### Your answers

Recorded in `interview.md` as below; I read "C2a and C2" as C2a and C2b.

| Question | Decision | Note |
|---|---|---|
| `C1` | recommendation accepted | your memory concern sits at another layer; see below |
| `C2` | C2a and C2b accepted | lenient with `eof` for strict; option (c) plus `skip` |
| `C3` | (a) meant; recommendation accepted | your slice point is folded in; see below |
| `C4` | accepted | no parsed value or run argument ever enters a pattern |

---

#### C1: a pure language, a mutating engine

The link is only the word: "mutable" appears at two different layers.

| Layer | Question | Answer |
|---|---|---|
| Language, what authors see | may parsers read and write shared state that changes results? | no: option C is out |
| Engine, how a runtime is built | may the engine mutate its own data structures? | yes, freely, if results match the pure semantics |

Purity is not what cost the legacy its memory. The suspects thread 2 found (not yet measured) are specific patterns, each fixable inside the engine: a log copied on every append, which grows quadratically; a global cache never cleared; a possible whole-input copy to normalize CRLF; a new state object per step; and error text built on every failed attempt.

Your substitution observation becomes a guarantee here: definitions are data and cannot reach the engine, so its internals can change without breaking any of them. Only native add-ons touch the engine, through a narrow interface.

On the interpreter loop: likely yes. Continuations are named parsers plus values, so a runtime needs frames, not closures, which is what a loop with an explicit stack uses. A runtime may instead compile the IR at load, within the same bounds.

I parked three requirements for Topic 6.

- The loaded parser is immutable and shared by every run; mutable state belongs to one run.
- Retained memory grows with input and output (plus the trace when on), never with the number of attempts.
- Host stack depth never grows with input size.

> Net: excluding C constrains the language, not the engine.

---

#### C3: slice is the V8 implementation

Agreed: the spec states behavior and a cost bound, each runtime picks the mechanism, and there is no view layer.

- V8: slicing a long string already makes a view under the hood, so `slice()` is the implementation.
- Python: slices copy, so a Python runtime passes offsets instead (`re` takes `pos` and `endpos`). Two integers, not a layer.

Two runtime details are parked for Topic 6: a V8 slice keeps its whole parent alive, so output text should be copied when a record is emitted, or results pin the input; and Python's `pos` does not hide text before the region from lookbehind or `^`.

> You did not invalidate the question, you sharpened it: "view" named a mechanism where a requirement belonged.

---

#### Topic 4 summary

Items are numbered for reference; the full text of each is in `design/interview.md`, Topic 4.

##### Decided, no action needed

These restate your answers.

- `T4-01` Authors never write host code; the old PRD's IR-to-native boundary holds.
- `T4-02` Definitions are DSL text, loaded at runtime.
- `T4-07` Context, as decided in C1.
- `T4-12` Sub-inputs, as decided in C3, with the slice point.
- `T4-13` to `T4-15` Leftover text, as decided in C2.

##### Proposed, to confirm

These are my proposals from threads 2 to 4, not yet confirmed.

- `T4-03` Contextual parsing is three independent axes, each combination a combinator the author picks: Input (same input, or a region as a sub-input), Choice (a fixed parser, or one picked from a declared set by a parsed value), Values (none, or earlier values as parameters to a declared parser). A richer form never precludes the plain ones.
- `T4-04` A monadic continuation is always a declared parser plus values, so the IR stays a finite graph and runtimes need frames, not closures. A parser whose matching depends on parsed values is marked, so it can be found without running it.
- `T4-05` Parsed values may flow into literals (with case and spacing options), counts, positions and columns, dispatch keys, parameters of named parsers, and value comparisons in zero-width checks (`Et1` versus `Ethernet1`). A caller may fix a pattern at load; it is checked once and run many times.
- `T4-06` A value that only decides where a region ends keeps every static check. Checks turn conservative only where a value is used inside a parser: matched as text, used as a count, or used to pick a branch. The BGP case needs only the region bound: the peer address bounds the run of lines, and a fixed grammar parses it.
- `T4-08` Values from a sibling section, such as peer-group settings applied to peers, are a join after parsing (Topic 5), not context.
- `T4-09` A region is a wall: the child cannot see past its end, which makes catch-all line parsers safe. The parent resumes at the region's end whatever the child did. Logs and traces flow back, with positions translated to the original input.
- `T4-10` Positions are their own value type, so they cross between parent and child: column offsets read from a table header are used by the child on the table body.
- `T4-11` Region kinds: up to a terminator; to the end of an indent level; the span another parser matched; a column span; a run of lines sharing a value (every `neighbor 10.1.1.1 ...` line); assembled text. A parsed value may set the delimiter.

> Reply "confirmed", or correct items by ID.

---

#### After you confirm

I mark Topic 4 confirmed and push. This thread is near its context budget (check with `/context`), so Topic 4a should start in a new thread with the usual opening message; that thread prepares the criteria and a worked split from the 4a material and `research-notes.md`.

---

## [5] Owner

Confirmed.

---

## [6] Claude

### Topic 4 confirmed

Topic 4 is recorded as confirmed in `design/interview.md`, items `T4-01` to `T4-15`, and pushed to `main`.

---

#### Next: Topic 4a in a new thread

Topic 4a (core versus library balance) starts in a new thread, as planned. The usual opening message works:

```text
Design interview, not a build. Read CLAUDE.md, design/README.md and design/interview.md, nothing else, then continue from the next action. You lead; I'm the domain expert. Commit and push design/ updates directly to main.
```

That thread prepares proposed criteria for when an operator becomes a primitive and a worked split, from the 4a material and `research-notes.md`, then opens the discussion.

I also added your "full context" request to the interview rules in `design/README.md`, so the next thread gives it without being asked.

> Thread 4 is complete; nothing is left unsaved.
