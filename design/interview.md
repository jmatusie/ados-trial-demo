# Design interview

Roles: Claude leads the interview; the owner is the domain expert. One topic at a time. Each topic ends with a summary the owner confirms or corrects. Examples the owner gives illustrate degrees of freedom; they are not requirements unless the owner says so.

| # | Topic | Status |
|---|---|---|
| 1 | Purpose and boundary | Confirmed |
| 2 | Inputs | Confirmed |
| 3 | Output model | Confirmed |
| 4 | Authoring model | Confirmed |
| 4a | Core versus library balance | Decided by proxy and closed, group G1, thread 5 |
| 5 | Data processing | Decided by proxy: G2, thread 6, open to veto |
| 6 | Runtime | Open: G3, next, by proxy |
| 7 | Diagnostics | Open: G4, by proxy |
| 8 | Proof | Open: G5, by proxy |
| 9 | Framing and v1 scope | Open: G6, by proxy, from the parked owner intents |
| 10 | PRD and plan | Not here: G7, in the new repository, through ados's Solo Loop 3 |

Proxy mode, from thread 5 (`transcript-5.md`, message [3]): the owner delegated the remaining design decisions, saying the questions had become detailed design and implementation choices. Claude surfaces each group's decisions, weighs the trade-offs, decides as the owner's proxy, records each decision in `decisions.md` (alternatives, what it rests on, what would reopen it, reversal cost) and in one line here, and commits and pushes after each decision set. The owner may veto any decision at any time; a veto supersedes it and reopens every decision that rests on it. Owner priorities, confirmed: intuitive usability is the key; performance and memory must not be forgotten; the DSL syntax is deferred; early prototypes should test decisions before the work goes far. Claude asks the owner only for domain facts, priorities and vetoes. The goal is a PRD and a plan to start a fresh repository and iterate, with spikes first.

Correction, thread 6 (`transcript-6.md`, message [1]): in thread 5 the owner wrote "initialize it with ados", and thread 5 misread it as ADRs. It means ados, the owner's scaffolding system in `jmatusie/ados`. The plan: finish G2 to G6 (Topics 5 to 9) here, by proxy. Then the owner starts a fresh repository with ados's Solo Loop 3, which carries `design/` over and writes the PRD there, so Topic 10 (G7) happens in the new repository, not here. `decisions.md` keeps its current format.

Next action: in a new thread, first apply any veto of G2 or answer to `Q5-01` from the owner (a veto supersedes the decision in `decisions.md` and reopens what rests on it). Then group G3, Topic 6 (runtime), in proxy mode. Read the Topic 6 sections of `research-notes.md` and `legacy-notes.md`, the Topic 6 items under "Parked for later topics", and the "Raised for later topics" lines under 4a and 5, and `decisions.md` only by pointer. Surface Topic 6's decisions in sets, weigh each set's options and costs, decide as the owner's proxy, record each decision in `decisions.md` and one line under Topic 6 here, and commit and push after each set. End the group with a short report to the owner, one table of decisions, and stop, so the owner can veto before G4 builds on it. Then G4 to G6 the same way, one group per thread; G7 happens in the new repository.

---

## 1. Purpose and boundary -- confirmed

- The product is a parsing engine, a set of parser primitives, and a portable intermediate representation (IR). A DSL for authoring is designed after the IR, once the IR is right. The IR must still carry what the DSL will need: named and imported parsers, parameters, and a pointer from each node back to its authoring source.
- Everything is a parser. Primitives, utility parsers, a user's own library, and a final composed parser are the same kind of thing and compose freely. Flexibility, expressiveness, modularity and composability are the goals.
- Output shape is the author's decision. A typical top-level composed parser slices one device's text along one axis into rows (one per VLAN, per BGP peer, per ACL entry), but a parser may emit any shape, and an author may change the final form (for example, arrays of objects versus CSV).
- This repository does not ship domain parsers. VLAN, interface, BGP neighbor, ACL entry and route-map entry were examples of grain patterns authors will build, not deliverables.
- Running parsers across many devices and combining results is out of scope; an orchestration system does that.
- Data-shaping utilities (flatten, explode, filter and similar, parameterized in the spirit of Polars) are likely add-on libraries. To be discussed in Topic 5.
- Runtimes are open-ended. TypeScript on V8 (Chromium, Deno) and Python (for example inside Nautobot) so far; possibly Go, Rust, or speed- or memory-optimized variants later. The IR is therefore a real cross-runtime contract.
- Deployment examples, not requirements: scheduled runs, on-demand runs, a browser tool where an engineer pastes a config.
- The legacy JavaScript system in `reference-parser/` is a source of ideas only. Keep its model of composable parsers that both consume text and shape data. Its known weakness is memory use. Matching its output or API is not a goal.

Two primitive families were acknowledged, with detail deferred:

- Parser side: elemental combinators (token, sequence, alternative, many, transform, bind, ref, lookahead and negate, empty and succeed, label, log, merge), terminals (literal, frozen-dialect regex, take_while, take_until, rest_of_line, eof), position (advance_by, at_column, span, position/column/line/indent reads), zero-width effects, grain (tag, record, context, accumulate_by, child, section), control and recovery (dispatch, recover, residual), and a derived library (optional, many1, sepBy, between, manyTill, parse_line, parse_table and so on).
- Data side: never enumerated in the old PRD. Old constraints: closed operation set, errors as values, aggregations with identity elements, the same absence semantics, per-operation ordering, named non-recursive pipelines, pattern matching. The legacy system's utilities indicate the families: row-wise map and filter, flattening and exploding, grouping, dedup and set operations, pipe and match, and domain values such as IPv4 addresses and networks.

---

## 2. Inputs -- confirmed

- Input kinds, all in scope: Arista EOS running config; column-aligned show tables; free-form show output; string values inside EOS JSON output that are themselves text needing parsing; and general semi-structured text such as tables and IP addresses in documents, best effort.
- The library knows nothing about EOS JSON or any structured format. The orchestration system extracts the strings and calls the library, running a parser on each one. Nothing fancy.
- Consequence: many small parses of short strings is a normal workload, so loading a parser once and running it many times must be cheap.
- The engine receives text only. Extraction from PDFs and other document formats happens upstream.
- Platform focus: Arista EOS.
- Size: inputs up to 500 MB. A 500 MB ASCII text fits under V8's single-string limit of about 537 million characters, so the engine may hold the whole input as one string. It must not multiply that memory: positions are indexes into the input, not copied substrings.
- One parse takes one input source. Several inputs are handled by composition in two ways: mostly, an outer layer runs one parser per input and joins the results as data; for some context-based text structures, one parser takes another parse's output as its input.

---

## 3. Output model -- confirmed

- Core value types: text, integers, decimals, booleans, lists and objects, with the four absence states. More will be added soon after the core is done, so the type set must be extensible without breaking existing parsers.
- Domain value types (IP address, prefix, MAC and similar) are an add-on, kept separate from the core. An add-on may use the engine directly rather than being composed from primitives, for performance. Each add-on is implemented per runtime and declares which runtimes it supports.
- The four absence states are core: inapplicable, unknown, expected-absent, present-unparseable. They come from logic and the theory of knowledge and serve auditing, alerting and detection. A single null is not acceptable.
- Provenance is off by default and enabled per parser. It covers only that parser's own match: a section parser with provenance on records the whole section and leaves its sub-parsers out. A second per-parser option also captures the matched text. Both go to a sidecar in the result stream, recorded for every successful parse, without changing the output data the parsers build.
- Detailed, nested provenance is a different use case: a debug mode that can trace a scope recursively or between start and stop points. Belongs to Topic 7.
- Row identity and folding by key are left to the author, with common repeatable operations offered as an add-on utility library.
- The legacy tagging model is the pattern to learn from. Sequencing produces incidental nesting (arrays inside arrays, extra levels) that carries no meaning. The author marks meaningful values with `tag(name)`, marks a real list with `tagList(name)`, injects a constant with `addTag(name, value)`, and drops a value with the `_exclude_` tag. A boundary operator then collapses everything tagged beneath it into one object, ignoring the incidental structure: `getTagged` where names are unique, `collectTagged` where names repeat and become arrays, and `getTaggedR` recursively. The author marks fields and record borders and does not have to reason about exact nesting.
- Expected-absent comes from simple expressions of expectation: assertions and negative assertions combined with boolean and counting operators (for example all of, any of, exactly N of, at least N of). This is intent, not a spec; the design may propose better forms.
- Decided by proxy in Topic 4a (`T4a-06`): what happens when a name meant to be unique appears twice under a unique boundary.

---

## 4. Authoring model -- confirmed

Confirmed by the owner in thread 4 (`transcript-4.md`, message [5]), after the answers to C1 to C4 (message [3]) and this summary (message [4]). Evidence: `legacy-notes.md`, Topics 3 and 4; `research-notes.md`, Topic 4; the reasoning for C1 to C4 in `transcript-3.md` and `transcript-4.md`, message [2].

Form:

- `T4-01` Authors never write host code. The IR-to-native boundary is the one the old PRD recorded (REQ-003a to REQ-003c, REQ-060 to REQ-062, NG-006): the IR is pure data that names things; each runtime implements every primitive natively; the only door to native code is a named registry entry, portable (specified and covered by conformance) or host-local (marked, and statically detectable in any definition that uses it); add-ons contribute registry entries per runtime and declare their runtimes; a native operator that could have been composed carries a reference composition and an equivalence test, so going native changes speed and never meaning.
- `T4-02` Parser definitions are DSL text, loaded at runtime.
- `T4-03` Contextual parsing is required, and the author chooses its form by choosing the combinator, along three independent axes. Input: the same input, or a region run as a sub-input with its own local index and counters (legacy `untilEndOfIndentLevel(sub)`, `untilStr(term, sub)`). Choice: a fixed parser, or one picked from a declared set by a parsed value (legacy `rol.chain(res => cond ? A : B)`). Values: none, or values parsed earlier passed as parameters to a declared parser (legacy `header.chain(peer => entries(peer))`). Using a richer form never precludes the plain ones.
- `T4-04` The monadic form is available by choice. The old PRD closed it (DEC-EXPR: selective by default, monadic never; REQ-036: runtime values only as positions and column geometry) after the research thread read the owner's `.chain` as a choice among declared parsers (`E19`); this restores the owner's position. With no host code, a continuation is always a declared parser plus values, written inline or under a name (defunctionalized), so the IR stays a finite, first-order graph and a runtime needs parameter frames, not closures, which answers `E09`. A parser whose matching depends on parsed values is marked, so it can be found without running it, as the old PRD required for `dispatch` (`REQ-062`).

Values:

- `T4-05` Parsed values may flow into literals, with options for slack such as case and spacing; counts; positions and columns; dispatch keys; parameters of named parsers; and comparisons in zero-width checks, so semantic equality (`Et1` versus `Ethernet1`) is a parsed token compared with a value. Decided in C4: parsed values and run arguments never enter a regex pattern. A pattern is fixed when written or at load (a constant argument such as `kv('remote-as')`, or a pattern the caller binds at load, checked once and run many times), since the frozen-dialect check and a cost bound on backtracking engines need it before running (`E11` was wrong that banning backreferences suffices), and an escaped value is just a literal (a regex, then the value as a literal, then a regex). The one loss: neither a regex node nor combinator repetition gives characters back to a following value (`a*ab` on `aab`).
- `T4-06` A value that only decides where a region ends keeps every static check (`E20`'s argument for start columns, extended to any value). Checks become conservative only where a value is used inside a parser: matched as text, used as a count, or used to pick a branch (can it match empty, first-character dispatch); regex precompilation is never affected, by `T4-05`. The BGP case needs only the region bound: the peer address bounds the run of lines sharing it, and a fixed grammar parses that run.
- `T4-07` Context, decided in C1. Output context (the VRF name on peer rows) never steers matching; whether it lives in a grain step at the boundary (old PRD `context`, TextFSM's Filldown) or a data step after parsing (legacy `multiplyBy`) goes to 4a and 5. Passed parse context (the peer address) is explicit parameters. Ambient parse context is explicit parameters in the IR; declared context, a read-only scoped environment (an `address-family` section binding the address family once for nested parsers), may be DSL sugar rewritten into parameters at load, the pattern known as implicit parameters; mutable parse state is out. Caller values, such as the legacy `deviceName`, are declared, typed run arguments of the top-level parser, counted as part of the run's input, so the same definition, input and arguments always give the same result; nothing else, such as the clock or the environment, reaches a parse. The owner's concern about memory and a mutating engine is an implementation matter, parked for Topic 6.
- `T4-08` Values from a sibling section, such as peer-group settings applied to peers, are a join after parsing (Topic 5), not context.

Regions:

- `T4-09` A region is a wall: inside a sub-input, end of input is the end of the region, and the child cannot look past it, which makes catch-all line parsers safe. The parent resumes at the end of the region, whatever the child did. Logs and traces from the child flow back to the parent automatically, with positions translated to the original input.
- `T4-10` Positions are their own value type, not plain integers, so the engine can translate them between the parent's frame and the child's. Typical crossing: column offsets read from a table header in the parent, used by the child on the table body.
- `T4-11` Region kinds: up to a terminator; to the end of an indent level; the span another parser matched; a column span; a run of lines sharing a value (every `neighbor 10.1.1.1 ...` line); assembled text. A parsed value may set the delimiter.
- `T4-12` Sub-inputs, decided in C3. The owner's Topic 2 case ("one parser takes another parse's output as its input") is (a), a region of the parent's text with exact provenance, and the default. Also supported: (b) gathered text, pieces of the original such as a wrapped table cell or a column span over several lines, with exact provenance through a segment map; (c) synthesized text, such as a decoded value, with the spans of its source values as provenance. Only (b) and (c) copy text. EOS JSON strings arrive decoded, so they need no (c); structured rows as input are pattern matching over data, Topic 5. The requirement is behavior and cost, not a mechanism, and there is no view layer: the child sees only its region, local counters are offset arithmetic, provenance translates back to the original input, and no runtime copies in a way that multiplies memory. V8's `slice` already shares long strings; Python's slices copy, so its runtime passes offsets (`re` takes `pos` and `endpos`).

Leftover text, decided in C2:

- `T4-13` Nothing vanishes implicitly. A child that consumes the whole region leaves it whole, so a missing expected field is expected-absent (a local closed-world assumption, which is what licenses expected-absent from Topic 3); a catch-all that takes lines it does not understand leaves it whole, with those lines listed as unrecognized; a child that stops early leaves a fragment, its tail reported as unclaimed and missing fields unknown. A child that fails outright fails the sub-input; skipping an unparseable region is recovery's job.
- `T4-14` C2a: lenient by default; strict is written, not switched, by ending the child with `eof`, which inside a sub-input is the end of the region, so a strict child fails unless it consumed the whole region and the parent can try another parser on it. The fragment mark and the tail roll back with the path that produced them, while the trace keeps the attempt; a fragment downgrades enclosing boundaries only for tags its parser could produce; the fragment mark is kept even with provenance off, since it decides between expected-absent and unknown.
- `T4-15` C2b: after a catch-all, expected-absent is relative to the grammar, since a keyword changed in a later release lands in the catch-all ("must have" checks fail loudly, "must not have" checks pass silently). An expectation may require a fully recognized region, giving unknown otherwise. `skip` marks lines the author declares irrelevant, neither listed nor counted as unrecognized, which also keeps a large run from listing millions of lines.

---

## 4a. Core versus library balance -- decided by proxy, closed

Proposed in thread 5 as `D1` to `D4` (`transcript-5.md`, message [2]), decided by Claude as the owner's proxy (message [3]), and closed in message [6], where `T4a-07` corrected `T4a-05`. Full records, with alternatives, what each rests on, what would reopen it and its reversal cost: `decisions.md`, G1. Evidence: `research-notes.md` and `legacy-notes.md`, Topic 4a.

- `T4a-01` (proxy) Three tiers: kernel (meaning stated by the spec, native in every runtime), required native (a reference composition plus a cost bound met natively), library (a reference composition; native optional, with the equivalence test).
- `T4a-02` (proxy) Kernel only by `K1` inexpressible, `K2` composable only through `bind`, or `K3` a host leaf the spec must pin; required native only by `N1` a worse time or memory class, or `N2` profiles. Tracing, analysis beyond `K2` and identical behavior across runtimes are not criteria.
- `T4a-03` (proxy, amended by `T4a-07` and `T4a-08`) Kernel, 16 operators: `literal`, `regex`; `seq`, `alt`, `many`; `not`, `peek`, `here`, `guard`; `transform`, `bind`, `ref`; `label`, `emit`, `run_on`, `record`. Kernel types: positions and spans, text references, the four absence states, conflict values.
- `T4a-04` (proxy, amended by `T4a-07`) The only required native is `take_until` for literal, fixed-regex, line-test and indent-end terminators; everything else is library with a reference composition, including `tag` over `emit` and `section` as a region plus a record.
- `T4a-05` (proxy, tags part superseded by `T4a-07`) `section` and the counting forms are library; `many` and `regex` are kernel, `regex` with no reference composition; output context goes to Topic 5.
- `T4a-06` (proxy) A unique name tagged twice gives a conflict value by default (every candidate in order with its span; equal duplicates collapse); the author may declare first, last or error per boundary.
- `T4a-07` (proxy) Tags and marks are emits gathered by the nearest `record`, the kernel boundary: it applies its expectations and turns fragment, unrecognized and unparsed marks into absence states and a report. Transforms cannot drop fields, and the engine may skip building values nothing reads.
- `T4a-08` (proxy) `emit` carries tags, marks, provenance and logs; the first three follow the kept path through one trail; `peek` and `not` keep none of their operand's entries; the engine-written trace keeps every attempt.
- `T4a-09` (proxy) Every parse terminates: `many` ends at an empty iteration, a call re-entering itself at the same position with the same arguments fails, and nesting without progress is capped.
- `T4a-10` (proxy) Leaf pins: ASCII case folding and classes in v1; patterns stored as syntax trees in a dialect V8, Python, RE2, Go and Rust share, rendered per runtime; no backreferences or lookaround; named groups write tags.

Raised for later topics: what the equivalence test compares beyond the result, the consumed span and the kept-path channels (Topics 7 and 8); the pinned position unit, and line and column reads within their cost bound without multiplying memory (Topic 6); the regex cost bound, and walls for `^` and `\b` at a region start in Python (Topic 6); the value of the no-progress cap (Topic 6); where a record's report goes in the result stream, and whether logs follow the kept path (Topic 7); record ergonomics, as a spike for the plan.

---

## 5. Data processing -- decided by proxy, G2, thread 6

Decided by Claude as the owner's proxy in thread 6, in four sets, and reported to the owner for veto (`transcript-6.md`, message [2]). Full records: `decisions.md`, G2. Evidence: `research-notes.md` and `legacy-notes.md`, Topic 5.

- `T5-01` (proxy) Data steps are pure, total functions over values, with no host code, in the same IR as parsers as a second node sort; parsers apply them through `transform`, so a parser followed by a data step is a parser.
- `T5-02` (proxy) A pipeline may run on its own on a caller-supplied value, such as decoded gNMI JSON, through one pinned host mapping (JSON null to a caller-named state, unknown by default); v1 scope is G6's.
- `T5-03` (proxy) Data kernel of six: `const`, `get`, `build`, `fold`, `match`, `call`, with a spec-pinned scalar registry; required native: `map`, `filter`, `sort`, `group`, `distinct`, `join`, `lookup`, membership; the rest is library, and covers the legacy BGP post-processing.
- `T5-04` (proxy) Data steps write author logs and nothing else; external data only as declared run arguments; validation against a source of truth stays downstream.
- `T5-05` (proxy) Strict propagation: an absent argument gives an absent result, several give the first of present-unparseable, unknown, expected-absent, inapplicable; strong Kleene logic for booleans; a missing key is unknown; strict functions lift over conflicts, and equal results collapse.
- `T5-06` (proxy) `filter` drops rows on false or absent and counts the absent drops; aggregates are strict, with `skip_absent` as an option; identities for `count`, `sum`, `all`, `any`; `min`, `max`, `first`, `last` of an empty list are inapplicable.
- `T5-07` (proxy) Errors are present-unparseable with a reason code, never exceptions; the loader type-checks pipelines against record schemas; per-step policy for absent results: keep (default), default value, drop row, fail run.
- `T5-08` (proxy) Every operation keeps input order; record fields in grammar order; one pinned total order for `sort`; structural equality, absent keys never join; exact integers and decimals.
- `T5-09` (proxy) With provenance on, values carry their spans through every data step, and the sidecar is rendered from final values.
- `T5-10` (proxy) Output context is a data step: a nested record plus `explode`; no parse-side filldown, though the DSL may sugar it; adjacency folding stays a parse-side region.
- `T5-11` (proxy) `explode` keeps a parent with an empty list as one row with inapplicable child fields, and one with an absent list as one row in the list's state; `drop_empty` and `drop_absent` are options, and drops are counted.
- `T5-12` (proxy) `lookup` resolves references (dangling keys give unknown and a log, duplicates give conflicts); `join` is relational (inner, left, full, anti); merge policies `left`, `right`, `conflict`, `overlay`; the loader requires one where fields overlap.
- `T5-13` (proxy) Named, typed pipelines in modules; no cycle through a pipeline; iteration only over finite lists, so every pipeline terminates; `match` is the only branching, first match wins, exhaustive or with a default; a data step may run a parser on a text value.
- `T5-14` (proxy) Meaning is eager; a runtime may stream row-wise chains through record emission and fuse steps, giving the same values and logs; blocking steps hold their input.
- `T5-15` (proxy) The result is a value; absence and conflict are their own host types; pinned JSON encoding (`$absent`, `$conflict`, exact digits); CSV and other encoders are library data functions.

Raised for later topics: exact-number representation, code point comparison in JavaScript, memory of hash-based operations and streaming (Topic 6); where the drop, skip and dangling-reference counts and logs go, and a log order streaming honors (Topic 7); data-kernel conformance and equivalence tests for the required natives (Topic 8); whether `T5-02` and `T5-15` are v1 (G6); spikes: the BGP post-processing written closure-free, and a streamed pipeline's memory on a large config.

Open domain question for the owner, `Q5-01`: `overlay` (`T5-12`) lets a peer's own value win over its peer group's unless the peer's value is expected-absent or inapplicable. Does EOS have forms, such as a `no ...` or `default ...` line under a neighbor, that must block inheritance from the group rather than fall back to it? Recommendation, if unsure: model such a line as a present value (for example `false` or a `disabled` token), which blocks inheritance under the rule as written.

---

## Parked for later topics

- Topic 6: is the IR also a serialized artifact that can be compiled once and shipped to any runtime, or only an in-memory structure each runtime builds from DSL text? Bears on "load once, run many".
- Topics 4a, 5, 6 and 7: legacy findings sorted by topic, including concrete memory suspects, are in `legacy-notes.md`; research-thread findings sorted by topic, with the errors found in that thread, are in `research-notes.md`.
- Topic 6: V8 and Python regex engines backtrack, so bounded regex cost needs a linear-time engine per runtime or a load-time ambiguity check (`research-notes.md`, errors, item 2).
- Topic 6, from the owner's C1 answer in thread 4: purity is a property of the language, not of the engine, which may mutate its own structures as long as results match the pure semantics. Proposed requirements: the loaded parser is immutable and shared by every run, and mutable state belongs to one run; retained memory grows with input and output (plus the trace when on), never with the number of attempts; host stack depth never grows with input size. The owner expects an interpreter loop; defunctionalized continuations need frames, not closures, and a runtime may instead compile the IR at load within the same bounds. Definitions cannot reach the engine, so its internals can change without breaking them, as the owner observed in a separate analysis where a mutable core would still run the imported `eos-cfg` modules (untested); only native add-ons touch the engine, through a narrow interface. The legacy memory suspects (`legacy-notes.md`, Topic 6) are implementation patterns with engine-side fixes, not costs of purity.
- Topic 6, from C3 in thread 4: a V8 slice of 13 or more characters shares and pins its whole parent (shorter ones are copied), so output text should be copied when a record is emitted, or results keep the input alive; Python's `re` `pos` does not hide text before the region from lookbehind or `^`, so the frozen dialect or the Python runtime must make a region's start a wall too; line endings should be handled without copying the input (the legacy normalizes CRLF with `replaceAll`).

Owner intent from the research transcript that no topic has recorded yet, found in thread 3's audit. Confirm each in its topic; quotes and sources are in `research-notes.md`, "The owner's charter and the other exchanges".

- DSL: template-based authoring, "template-based parsers (Jinja2-like patterns)" whose blocks run named parsers, mixed freely with combinators (`E01`, `E03`). The research thread deferred it without discussing the trade-off. The IR must let a template surface compile to the same nodes as the expression form.
- Topic 1 or the PRD framing: authors are "data-savvy domain experts", with an "Easy barrier to entry (learn by example)" and no "SDLC life cycle iterations" (`E01`); the data DSL is "not intended for programmers" (`E16`).
- Topic 7: "user-defined logging (informational/warning/error) that becomes first class, useful for production systems" (`E01`).
- Topic 5, recorded by proxy in `T5-01`, `T5-02`, `T5-04`, `T5-07` and `T5-13`: the data side gets "a similar treatment", "as an IR", with pipelining, error handling, side effects and registered functions but no custom code; no explicit loops (mapping and reducing instead), no explicit branching (pattern matching and overridable error clauses instead), immutable operations, modules, and tracing channels (`E16`). Also whether it takes structured input such as gNMI telemetry JSON, which Topic 2 excluded only for parsing.
- Topics 4a, 5, 6 and 8: in `E22` the owner accepted a TypeScript reference runtime with Python second, free backtracking, ordered sequences, and a v1 cut of recognition, grain and record output with provenance, one surface syntax and one reference runtime. The interview has not confirmed these.
- `PRD.md`: keep vision, objectives and user stories apart from requirements, and keep a requirement only if a failing test can be written for it, so a downstream model cannot read a subjective statement as a requirement (`E15`).
