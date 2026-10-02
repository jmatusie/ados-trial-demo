# Decision register

The fork mechanism the owner asked for in thread 5 (`transcript-5.md`, message [3]). Every proxy decision is recorded here with what it rejected, what it rests on, and what would reopen it, so any decision can be revisited without losing its alternatives. `interview.md` holds one line per decision; this file holds the record. Read it by pointer: when revisiting a decision, or when a new decision needs an earlier one's alternatives.

---

## How it works

- Proxy: from thread 5 the owner delegates the remaining design decisions. Claude surfaces each group's decisions, weighs the trade-offs, decides as the owner's proxy, and records the decision here. The owner confirms or vetoes at any time.
- Order of considerations for a proxy decision: the owner's confirmed decisions first; then intuitive authoring, which the owner calls the key; then memory and performance, which are hard requirements (inputs up to 500 MB, many small parses); then portability and a small core.
- Status: `proxy` (decided by Claude for the owner), `confirmed` (the owner agreed), or `superseded by <ID>` (reversed; the record stays).
- Going back: a veto or a failed prototype supersedes a decision with a new ID, and every decision that lists it under "Rests on" is reopened too. That is the fork.
- Revisit if: the signal that reopens a decision. `(spike)` marks a decision that an early prototype in the new repository should test first; the plan collects them.
- Reversal cost, once the new repository has code: low (a library or default changes), medium (the IR or several runtimes change), high (the output contract or every runtime changes).
- Layout: from G3 on, each record follows the five-part template in `README.md` (question, why it matters, options, choice, register fields). G1 and G2 keep the layout below.
- In the new repository, ados's Solo Loop 3 carries this file over with `design/`; it keeps this format until then.

---

## G1. Topic 4a: core versus library (thread 5)

Proposed as `D1` to `D4` in `transcript-5.md`, message [2], with the full split table; delegated by the owner in message [3].

### `T4a-01` Three tiers of operator

- Status: proxy.
- Decision: kernel (meaning stated by the spec with conformance tests; native in every runtime), required native (meaning by a reference composition plus a cost bound that every runtime meets natively), library (meaning by a reference composition; native optional, with the equivalence test, which can run both forms on generated inputs). "First-class" is split into meaning and implementation, which the equivalence rule already separates, so speed alone never grows the kernel. A new runtime writes the kernel and the required natives and interprets the rest.
- Alternatives: two tiers with native code only in the kernel (every speed-up grows the kernel, and each kernel operator costs a prose spec, conformance tests, a case in every analysis and code in every runtime); everything native, as in the legacy (drift between runtimes, the largest port).
- Rests on: `T4-01`.
- Revisit if: the equivalence test cannot be made practical for a native operator, for example because its error reports cannot match the composition's (spike).
- Reversal cost: medium.

### `T4a-02` Criteria for the tiers

- Status: proxy.
- Decision: kernel only if `K1` no composition has the same meaning, `K2` its only composition goes through `bind`, which marks it value-dependent and makes analyses conservative, or `K3` it is a host leaf the spec must pin (regex dialect, case folding, character classes, position units: UTF-16 units in JavaScript, code points in Python). Required native only if `N1` its composition is in a worse time or memory class on realistic inputs, or `N2` profiles show it dominates. Not criteria: tracing (a named operator is one trace step in any tier, `label` sets error wording, and a debug mode may run the composition); analysis beyond `K2` (analyses are compositional, and each kernel operator adds a case to every analysis); identical behavior across runtimes (a composition guarantees it; native code is what drifts). The number of runtimes is the cost side, not a criterion.
- Alternatives: Topic 3's five candidate criteria as equal promotion reasons, which grow the kernel for concerns that names and labels already serve; `E04`'s test (cannot be composed, or the core must see it for tracing, recovery or optimization).
- Rests on: `T4a-01`, `T4-04`.
- Revisit if: traces or error reports from composed operators prove unreadable even with names and labels (spike).
- Reversal cost: low.

### `T4a-03` The kernel

- Status: proxy; amended by `T4a-07` (`record` joins the kernel, making 16 operators, and tags are no longer values) and `T4a-08` (the channels `emit` carries).
- Decision: 15 operators. Leaves: `literal(v)` with case and spacing options, `regex(p)`. Structure: `seq`, `alt`, `many`. Zero-width: `not`, `peek` (p's value without consuming), `here` (the current position), `guard` (a condition on values). Values: `transform`, `bind`, `ref`. Effects: `label`, `emit(channel, v)`, which writes to a side channel (log, provenance, unrecognized, unparsed) under a rollback rule the spec fixes, and `run_on(text, p)`, which runs p on a sub-input as a wall (a span, gathered pieces or synthesized text), consumes nothing in the parent, and reports whether p read it whole. Kernel types: positions and spans, text references, tagged values, the four absence states; line, column and indent reads carry a cost bound. `transform` and `guard` call core data functions, whose set is Topic 5's.
- Alternatives: the old PRD's families, about 35 operators outside the derived library (Topic 1); a smaller kernel that derives `seq`, `transform` or `many` through `bind` (loses analysis, `K2`); exposing parser state, as Parsec derives lookahead from saving and restoring it, instead of `peek` and `not` (breaks analysis).
- Rests on: `T4a-02`, `T4-05`, `T4-09` to `T4-14`, Topic 3's tagging model.
- Revisit if: a needed behavior cannot be composed from the kernel, or an interpreter prototype shows a composition too slow with no cost-bound fix (spike).
- Reversal cost: adding an operator is low; removing one is high, so the kernel starts small.

### `T4a-04` Required natives and the library

- Status: proxy; amended by `T4a-07`: `tag`, `tagList` and `addTag` are library over `emit`, the boundary is the kernel `record`, and `section` is a region plus a record.
- Decision: the only required native is `take_until`, for literal, fixed-regex, line-test and indent-end terminators (`N1`: the legacy `everythingUntil` tried the terminator at every position and was "almost unusable"). Everything else is library with a reference composition: `succeed` from `transform(here, ...)` and `fail` as `not(here)`; `any`, `eof`, `rest_of_line`, `take_while`, whitespace and `token` from `regex`, `not`, `seq`; `optional`, `many1`, `repeat(min, max)`, `sepBy`, `between`, `manyTill`, `except` and `setOf` from `alt`, `seq`, `many`, `not`, `ref`, `guard`; `span`, `at_column` and `advance_by` from `here`, `guard`, `bind`, `repeat`; `region(finder, p)` as `bind(span(finder), s -> run_on(s, p))`, with `until`, indent level, column span and run of lines over it and `take_until`; tags, boundaries, `section`, `child` and `accumulate_by` as `transform` with core data functions, plus a region for `section`; `dispatch`, `recover`, catch-all, `skip` and residual from `alt`, `guard`, `bind`, `span`, `emit`; `count_between` and all of, any of, none of, exactly N of, at least N of from `peek`, `not`, `alt`, `transform`; `log` and the provenance option from `emit`, `span`.
- Alternatives: making `section`, `dispatch`, indent scanning or the token helpers required natives now, without profiles.
- Rests on: `T4a-03`.
- Revisit if: profiles on realistic inputs, a 500 MB configuration and many small strings, show another operator dominates (spike).
- Reversal cost: low.

### `T4a-05` The open placements

- Status: proxy; its tags-as-values part is superseded by `T4a-07`, which answers its revisit signal.
- Decision: `section` (`E20`) is library, a region plus a boundary; it is still one named trace step, and its speed comes from `take_until`. The counting forms are library over `count_between`, itself library. `E07`'s match-first is `alt`, and match-any and match-all, as tests at a position, are counting forms; keeping every parse is excluded by ordered choice unless the owner needs it. `many` is kernel by `K2`: Haskell's `Alternative` defines `many` by recursion, which loops forever when p matches empty, and the progress check needs `bind`. `regex` is kernel by `K3` with no reference composition required: the continuation translation of Medeiros, Mascarenhas and Ierusalimschy exists but is generated per pattern, so it serves only as a test oracle (answers thread 3's open question). Tags are values and boundaries are `transform` with a collect function, so a failed branch drops its tags with no rollback machinery. Output context is library either way; where it lives is Topic 5's.
- Alternatives: `section` and the counting forms as kernel operators; a reference composition required for `regex` by old PRD `REQ-060`; tags as parser state, as in the legacy.
- Rests on: `T4a-02`, `T4a-03`, Topic 3.
- Revisit if: a boundary needs information its values do not carry, such as the fragment mark (spike: tags as values).
- Reversal cost: low for the placements; medium for tags as values.

### `T4a-06` A unique name tagged twice

- Status: proxy.
- Decision: a conflict value by default: the field holds every candidate in order, each with its span, and equal duplicates collapse to one value. The author may declare first, last or error per boundary. In Belnap's four-valued logic this is "both" (too much information), beside the "neither" (no usable value) that the four absence states refine. Example: `mtu` unique under an interface boundary, with two lines of one block yielding 1500 and 9214.
- Alternatives: error (one odd line fails the whole record); first or last wins (silent loss, against `T4-13`).
- Rests on: Topic 3 (the absence states, extensible value types), `T4-13`.
- Revisit if: consumers find conflict values harder to handle than failures.
- Reversal cost: medium, since it is part of the output contract.

### `T4a-07` Tags and marks are scoped emits; `record` joins the kernel

- Status: proxy, decided while closing 4a in thread 5 (`transcript-5.md`, message [6]). Supersedes the tags-as-values part of `T4a-05`; amends `T4a-03` and `T4a-04`.
- Decision: `tag(name, p)`, `tagList` and `addTag` are library over `emit`: they write a name and a value to the tag channel and return p's value unchanged. A new kernel operator, `record(p, mode, expectations)`, is the boundary: it runs p, gathers the tag and mark entries p left on the kept path, except those a nested record gathered, and returns one object. Modes: unique names, with conflict values per `T4a-06`, or repeated names as lists. It applies its expectations to the gathered fields and turns marks into absence states and a report of unclaimed, unrecognized and unparsed spans. Marks: `run_on` leaves a fragment mark holding the tail span and the tags the child could produce, computed at load and over-approximated when a name comes from a value; catch-alls leave unrecognized marks; `recover` leaves unparsed marks. A nested record returns one value, which the author may tag into the outer record. Marks outside every record go to the run's report. The kernel is 16 operators.
- Why: with tags inside values, a transform could drop a tag or a fragment mark silently, so authors would have to reason about nesting again, which Topic 3 set out to avoid; here, what reaches a record is exactly what was tagged. A record never walks the incidental value tree, so the engine may skip building values nothing reads, which is where the legacy spent memory. One trail rolls back tags, marks and provenance.
- Alternatives: tags and marks as values gathered by a collect function (`T4a-05` as first decided), which needs marks to propagate through every data function; tags as mutable parser state, as in the legacy.
- Rests on: `T4a-02` (`K1`: no other operator reads a channel within a scope), `T4-13` to `T4-15`, Topic 3.
- Revisit if: authors need to compute over tagged fields before their record closes (spike: record ergonomics).
- Reversal cost: medium.

### `T4a-08` What `emit` carries, and what rolls back

- Status: proxy. Amends `T4a-03`.
- Decision: four channels: tag and mark, which the nearest record gathers (`T4a-07`); provenance, the sidecar of Topic 3; and author logs. Tag, mark and provenance entries follow the kept path: the engine appends them to a trail and truncates it on backtracking, so failed attempts retain no memory. `peek` and `not` keep none of their operand's entries; `run_on` keeps its child's, with positions translated. The trace is written by the engine, not through `emit`, and keeps every attempt. Whether logs follow the kept path or keep every attempt is Topic 7's.
- Alternatives: every channel keeps every attempt (output provenance would include failed branches, which C2 and research error item 4 rejected); a separate rollback mechanism per channel.
- Rests on: `T4a-07`, `T4-14`.
- Revisit if: Topic 7 needs another channel.
- Reversal cost: low.

### `T4a-09` Every parse terminates

- Status: proxy.
- Decision: `many` ends at an iteration that consumes nothing, discarding that iteration's value and entries, and the loader warns where analysis shows the operand can match empty, as in `many(optional(x))`. A call that re-enters the same named parser at the same position with the same arguments fails, which stops left recursion; the loader rejects left recursion it can prove and adds the runtime check only where it cannot. A chain of nested calls that consumes nothing is capped by a limit the spec fixes, failing with a diagnostic, which covers recursion whose arguments change without progress.
- Alternatives: Parsec's runtime error when `many`'s operand accepts empty (fails a common slip at run time); static rejection alone, as in PEG theory (conservative under `bind`, so it rejects valid grammars); no guards (a hang in production).
- Rests on: `T4a-03`, `T4-04`.
- Revisit if: the cap rejects a legitimate grammar, or the checks show in profiles (spike).
- Reversal cost: low.

### `T4a-10` Pins for the kernel leaves

- Status: proxy.
- Decision: `literal` folds case for ASCII letters only in v1, and its spacing option lets any run of spaces and tabs match any run. `regex`: the IR stores each pattern as a syntax tree in the frozen dialect, and each runtime renders it for its own engine, so host syntax never passes through. The dialect is what V8, Python `re`, RE2, Go and Rust share: leftmost-first alternation, greedy and lazy repetition, classes, groups and anchors; no backreferences and no lookaround, which `peek` and `not` cover. Classes and case folding are ASCII in v1. `.`, `^`, `$` and `\b` are defined by the spec, relative to the region and its line endings, and every renderer must honor them, because hosts differ: JavaScript's `.` stops at `\r` and Python's does not, Python's `$` also matches before a final newline, and JavaScript's `\d` is ASCII where Python's is Unicode. Named groups write tags (`T4a-07`), so a capture group is the tagging model rather than a second binding mechanism (`E11`), and TextFSM-style patterns stay fast and familiar; other groups capture nothing; a pattern's value is its matched text. The cost bound is Topic 6's.
- Alternatives: passing host pattern strings through (drift, as above); a fuller dialect with backreferences or lookaround (no linear-time engine supports it); positional capture groups.
- Rests on: `T4a-02` (`K3`), `T4-05`, `T4a-07`.
- Revisit if: authors need Unicode classes or case folding, which would come as an add-on with pinned tables.
- Reversal cost: medium.

G1 closed in thread 5: `T4a-01` to `T4a-10`.

---

## G2. Topic 5: data processing (thread 6)

Decided in four sets, each pushed on its own: form and boundary (`T5-01` to `T5-04`), values in data steps (`T5-05` to `T5-09`), reshaping (`T5-10` to `T5-12`), pipelines and execution (`T5-13` to `T5-15`). Evidence: `research-notes.md` and `legacy-notes.md`, Topic 5, both extended in thread 6. The owner's intent for the data side (`E16`) is in `research-notes.md`, the charter section.

### Set 1. Form and boundary

### `T5-01` Data steps are functions over values, in the same IR

- Status: proxy.
- Decision: a data step is a pure, total function from values to a value, written as an expression over the core value types and add-on types, with no host code. It lives in the same IR as parsers, as a second sort of node, and shares their names, modules, parameters and source pointers. A parser applies one through `transform`; a record's expectations and `guard` use them as predicates; a whole-result pipeline is a `transform` at the top of a composed parser. So "everything is a parser" holds where it matters, at composition: any parser followed by a data step is a parser. Inside the data side the unit is the function, because a data step neither consumes input nor backtracks. One loader, one module system, one name resolution; the spec and conformance suite get a data section.
- Alternatives: a separate data tier with its own IR, as the old PRD had (`REQ-006a`: two module systems and two loaders for one author); data steps as parsers over lists of values (brings consumption and backtracking where nothing needs them, and every analysis gets harder); host closures, as the legacy `.map` (breaks `T4-01`).
- Rests on: `T4-01`, `T4-02`, `T4a-03` (`transform`), Topic 1.
- Revisit if: authors need sequence patterns across records, such as "an A row followed by two B rows", which would add a list-parsing mode.
- Reversal cost: medium.

### `T5-02` Pipelines may run on structured input

- Status: proxy. Answers the parked question of gNMI telemetry JSON (`E16`).
- Decision: a pipeline can run on its own on a value the caller supplies, since its input is a value. The library still decodes no format (Topic 2): the host binding converts host values by one pinned mapping: strings to text, integral numbers to integers, other numbers to decimals, booleans, arrays to lists, objects to objects, and a JSON null to an absence state the caller names per run, unknown by default. Whether this is in v1 is G6's.
- Alternatives: text only everywhere (the orchestration system would re-encode data as text, or authors would write host code); a JSON decoder in the library (contradicts Topic 2).
- Rests on: `T5-01`, Topic 2.
- Revisit if: telemetry needs types the core lacks, such as unsigned 64-bit counters or timestamps, which would come as add-on types.
- Reversal cost: low.

### `T5-03` Operation families, by tier

- Status: proxy.
- Decision: the data side uses the tiers and criteria of `T4a-01` and `T4a-02`. Data kernel, six operators: `const`; `get` (a field or path); `build` (an object or a list); `fold` over a finite list, the only iterator; `match` (`T5-13`); `call` of a registry function. The core registry pins scalar functions by spec (`K3`): arithmetic, comparison, boolean logic, text functions and conversions. Required native (`N1`: the composition is quadratic, by immutable append or by pairwise comparison): `map`, `filter`, `sort`, `group`, `distinct`, `join` and `lookup`, and set membership. Library, each with a reference composition: `explode`, `flatten` (one level, with a prefix option), `select` (an ordered projection that can also collect the leftover fields, as the legacy `skippedCols`), `drop`, `rename`, `with` (add or replace a field), `partition`, `concat`, `key` (a composite key from a template), `coalesce`, `overlay`, `upsert` (by key), aggregates (`count`, `sum`, `min`, `max`, `any`, `all`, `first`, `last`), encoders (`T5-15`). Domain functions, such as asdot to asplain or prefix containment, are add-ons (Topic 3). The legacy BGP post-processing needs nothing outside this list (`legacy-notes.md`, Topic 5, last item).
- Alternatives: a Polars-sized native set (every operator a spec, conformance tests and code per runtime); map and filter in the kernel (they compose from `fold`, so `K1` fails; they are native for cost, which `N1` covers).
- Rests on: `T4a-01`, `T4a-02`, `T5-01`.
- Revisit if: profiles show another library operator dominating (`N2`), or the BGP spike needs an operator not listed (spike).
- Reversal cost: low.

### `T5-04` No effects but logs; determinism

- Status: proxy.
- Decision: a data step may write author logs and nothing else: no tags (those are parse-side, gathered by records, `T4a-07`), no I/O, no clock, no randomness. External data, such as an alias table or the device name, reaches a step only as a declared run argument (`T4-07`), so the same input and arguments always give the same result. Functions come only from the registry, portable or host-local (`T4-01`). Validation against a source of truth stays downstream (`E08`); range checks are ordinary predicates.
- Alternatives: lookups against external services (results would depend on when a parse ran); tags from data steps (reopens `T4a-07`).
- Rests on: `T4-01`, `T4-07`, `T4a-08`.
- Revisit if: Topic 7 needs another channel from data steps.
- Reversal cost: low.

### Set 2. Values in data steps

### `T5-05` How absence and conflict propagate

- Status: proxy. Answers `REQ-006f`.
- Decision: a record fills every field it could produce with a value or a state (`T4a-07`), so `get` of a declared field returns that. `get` of a key an object lacks returns unknown (an open world, as in structured input); where the schema proves the key can never exist, the loader rejects it. A registry function is strict unless it declares that it handles absence (`coalesce`, `is`, `match`, the boolean connectives): an absent argument makes the result absent, and with several absent arguments the result takes the first state in the order present-unparseable, unknown, expected-absent, inapplicable, so a sign of a defect is never hidden and a result that cannot be known is never reported as known absence. Boolean connectives follow strong Kleene logic: false and anything is false, true or anything is true, otherwise absent. A comparison with an absent operand is absent; `is(state)`, `is_present` and `is_absent` return booleans. A strict function lifts over a conflict value: it applies to each candidate, keeping each candidate's span, and equal results collapse, so normalizing `Et1` and `Ethernet1` dissolves a conflict that was only spelling.
- Alternatives: one null with SQL semantics (Topic 3 rejected it); an error on any absent argument (every step would need guards, against intuitive use); treating a conflict as present-unparseable (loses the candidates, which Belnap's merge exists to keep, `E07`).
- Rests on: Topic 3, `T4a-06`, `T4a-07`, `T5-01`.
- Revisit if: authors find the precedence order surprising in practice (spike: BGP post-processing).
- Reversal cost: medium.

### `T5-06` Filters and aggregates over absence

- Status: proxy.
- Decision: `filter` keeps a row whose predicate is true and drops it when false or absent, as SQL, pandas and Polars do, and counts the rows it drops on an absent predicate, by state, so nothing vanishes silently (`T4-13`). Aggregates are strict: an absent element makes the result absent by the precedence of `T5-05`; the `skip_absent` option gives SQL's behavior and counts what it skipped. A filter answers "which rows are known to satisfy this"; an aggregate answers "what is the value", which cannot be known if an input is not. Identity elements (`REQ-006d`): `count` 0, `sum` 0, `all` true, `any` false, concatenation empty. `min`, `max`, `first` and `last` have none, and over an empty list return inapplicable: the question does not apply to an empty set. An aggregate over an absent list returns the list's state.
- Alternatives: aggregates skip absent elements, as SQL (a sum of counters with one unparseable counter would look correct); filters keep rows on an absent predicate (a query for AS 65000 would return peers of unknown AS).
- Rests on: `T5-05`, `T4-13`.
- Revisit if: the counts prove noisy; where they go is Topic 7's.
- Reversal cost: low.

### `T5-07` Errors are values: present-unparseable

- Status: proxy. Answers `REQ-006c` and the owner's "overridable error clauses" (`E16`).
- Decision: a data function never throws. A failed conversion or domain function, such as integer from `12a` or asplain from `1.x`, returns present-unparseable carrying the input value, its provenance and a reason code: the value is present and not readable as the type, which is what that state means, so errors and absence are one mechanism. The loader type-checks pipelines against record schemas inferred from tags (`T4a-07`), so most type errors fail at load; a type mismatch it cannot rule out gives present-unparseable with reason `type` and a warning log. Error clauses are ordinary operations: `coalesce`, `match` on states and reasons, and a per-step policy for absent results: keep (default, so errors stay visible in the output), a default value, drop the row (counted as in `T5-06`), or fail the run with a diagnostic.
- Alternatives: exceptions (one bad row aborts a run of a 500 MB config); an error type beside the absence states (two mechanisms for "no usable value", and every function handles both).
- Rests on: Topic 3, `T5-05`, `T5-06`.
- Revisit if: authors need to tell a data defect from their own type slip in the output, beyond the reason code.
- Reversal cost: low.

### `T5-08` Order and value pins

- Status: proxy. Answers `REQ-006g`; the pins are what cross-runtime conformance compares.
- Decision: every operation keeps input order, and each that builds a collection orders it deterministically: `group` by first appearance, rows in order within a group; `join` and `lookup` in left order, then right order; `distinct` keeps first occurrences. A record's fields come in the order its grammar declares them, fixed at load, not the order an input happened to fill them. `sort` is stable over one pinned total order: present values first, ranked by type, integers and decimals compared numerically together, text by code point (a JavaScript runtime must not compare UTF-16 units), false before true, lists and objects lexicographically; then the absence states in a fixed order, then conflicts; descending reverses present values only. Equality is structural; a state equals only the same state, so `group` and `distinct` put equal states together, while `join` and `lookup` never match an absent key, as SQL. Integers are exact and never overflow or round (interface counters exceed 2^53, the exact range of a JavaScript number); decimals are exact as written, not binary floats; the spec pins rounding for division and other inexact functions. Representation and fast paths are Topic 6's.
- Alternatives: order unspecified, as SQL without `ORDER BY` (runtimes would disagree, and conformance could not compare results); host-native numbers (JavaScript rounds large counters, Python does not).
- Rests on: `T5-03`, Topic 3.
- Revisit if: exact numbers show in profiles (Topic 6).
- Reversal cost: high, since results change.

### `T5-09` Provenance travels with values

- Status: proxy. Extends Topic 3's sidecar through data steps.
- Decision: when provenance is on for a parser, each value it tags carries its span as metadata that equality, order and output data ignore. Data steps pass it along: a copied or exploded field keeps its span, a computed value carries its inputs' spans, a conflict keeps each candidate's, and an aggregate refers to its input list's provenance rather than copying it, so memory stays linear. The sidecar is rendered from the final values at output, so reshaping never breaks it. Off by default, and costs nothing when off.
- Alternatives: a sidecar keyed by record identity (breaks on `explode` and `join`, and needs a key on every record); provenance for parser output only (lost at the first data step).
- Rests on: Topic 3, `T4a-08`, `T5-01`.
- Revisit if: the metadata costs show in profiles with provenance on (Topic 6).
- Reversal cost: medium.

### Set 3. Reshaping

### `T5-10` Output context is a data step: `explode`

- Status: proxy. Settles the placement `T4-07` and `T4a-05` sent here.
- Decision: the VRF name reaches peer rows after parsing. The grammar builds a VRF record holding a list of peer records (a nested record, `T4a-07`), and `explode(vrf, peers)` gives one row per peer with the VRF's other fields copied in. There is no filldown operator on the parse side; the DSL may offer filldown as sugar that rewrites into a record plus `explode`. Grounds: the old PRD's own placement test (`REQ-054`: needs only records, so data side); output context never steers matching (`T4-07`); and one mechanism instead of two. Fields shared by parent and child need a merge policy, as for joins (`T5-12`). Cost: values are immutable, so copied parent fields are shared references, and the engine may fuse `explode` into record emission so the nested form is never built (`T5-14`). The old PRD's argument that grain cannot always wait for post-processing (A.10, the BGP neighbor lines with no delimiter) is answered on the parse side by a region, a run of lines sharing a value (`T4-11`); same-key folding by adjacency stays a region, not a data `group`.
- Alternatives: a parse-side `context` operator, as TextFSM's Filldown and the old PRD's `REQ-050` (a second mechanism, and a scope rule for which records inherit); both (two ways to write the same row).
- Rests on: `T4-07`, `T4-11`, `T4a-07`, `T5-03`.
- Revisit if: the record-ergonomics spike shows filldown sugar cannot read naturally.
- Reversal cost: low.

### `T5-11` `explode` of an empty or absent list

- Status: proxy. Answers the parked `multiplyBy` versus `multiplyByZ` question.
- Decision: by default a parent always yields at least one row. A parent whose list is empty yields one row whose child fields are inapplicable, since no child exists; a parent whose list is absent yields one row whose child fields take the list's state, so unknown stays unknown; an absent element yields a row whose child fields take its state (the legacy threw). The child fields come from the child record's schema, known at load. The option `drop_empty` drops parents with empty lists, as `multiplyByZ`; `drop_absent` also drops parents with absent lists; each drop is counted as in `T5-06`. Grounds: pandas and Polars keep the row, and an ACL with no entries is a fact an audit wants to see.
- Alternatives: drop by default, as `multiplyByZ` (an ACL with no entries disappears from the output); keep with no child fields, as `multiplyBy` (row shape varies with the data).
- Rests on: `T5-05`, `T5-06`, `T5-10`, Topic 3.
- Revisit if: authors mostly write `drop_empty` (spike: BGP and ACL post-processing).
- Reversal cost: low.

### `T5-12` Joins, lookups and merges

- Status: proxy. Serves `T4-08`: sibling-section values, such as peer-group settings applied to peers, are a join after parsing.
- Decision: two operations, both required native by hashing. `lookup(rows, table, on, merge)` resolves a reference: each row gains the fields of the one table entry its key names. A row whose key is absent gets those fields as inapplicable when the key is inapplicable or expected-absent (no group applies), and in the key's state otherwise; a present key with no entry is a dangling reference, which gives unknown fields and a log; duplicate keys in the table give conflict values per `T4a-06`. `join(left, right, on, kind)` is relational, with kinds inner, left, full and anti (anti answers "what is missing"): duplicates multiply rows, as SQL, and the fields of an unmatched side are inapplicable. Absent keys never match (`T5-08`). When both sides carry the same non-key field, the merge policy decides: `left`, `right`, `conflict` (Belnap's join, `E07`: equal values collapse, others become a conflict value) or `overlay` for inheritance: the left value wins unless it is expected-absent or inapplicable, so a peer's own setting beats its group's, while an unknown or unparseable value is never masked by an inherited one. The loader requires a policy where the schemas overlap; where it cannot tell, the default is `conflict`, so nothing is overwritten silently. `upsert` by key, the legacy `resolvePeers` dedup, is library over `group` and a merge.
- Alternatives: SQL joins only (a dangling peer-group reference would look like "no group"); last-write-wins merges, as the legacy spreads (silent overwrites); Polars-style suffixes for overlapping names (the author must then reconcile columns by hand).
- Rests on: `T4-08`, `T4a-06`, `T5-05`, `T5-08`.
- Revisit if: `overlay`'s fallback set proves wrong for some inheritance in EOS, such as a `no` form that must block inheritance (a domain fact to check with the owner).
- Reversal cost: low.

### Set 4. Pipelines and execution

### `T5-13` Pipelines, `match` and termination

- Status: proxy. Answers `REQ-006h`, `REQ-006i`, `DEC-TCOMPLETE` and the owner's "no explicit loops, no explicit branching" (`E16`).
- Decision: a pipeline is a named expression with typed parameters, in modules, resolved like parser names. A data step may run a parser on a text value (a synthesized sub-input, `T4-12` (c)), returning its value or present-unparseable. The loader rejects any cycle in the call graph that passes through a pipeline, the rule the old PRD left out; parsers alone may still recurse, guarded by `T4a-09`. Iteration exists only as the list operations over finite lists, so every pipeline terminates, in time at most n log n per operation, except joins, whose output can multiply. `match(value, cases)` is the only branching: cases in order, the first match wins, no fallthrough (the legacy `.continue()` is dropped). Patterns: literals, types, absence states and reason codes, conflicts, object patterns that bind named fields, list patterns with a prefix and a rest, and a guard predicate. The loader checks exhaustiveness and requires a default case where it cannot prove it, so no value falls off the end.
- Alternatives: recursion allowed (termination depends on the data); an `if` form (the owner asked for pattern matching instead, and `match` covers it); fallthrough (order-dependent effects, harder to read).
- Rests on: `T5-01`, `T5-03`, `T4a-09`, `T4-12`.
- Revisit if: a real post-processing task needs a fixed point, such as resolving peer-group chains of unknown depth, which would need a bounded iterate operator.
- Reversal cost: low.

### `T5-14` Meaning is eager; execution may stream

- Status: proxy. Resolves `DEC-LAZY` against `DEC-STREAM`, and fixes what `REQ-006e`'s fusion must preserve.
- Decision: the spec defines every data step eagerly, over complete values. The loader classifies each operation as row-wise (`map`, `filter`, `explode`, `with`, `select`, `lookup` into a finished table, scalar calls) or blocking (`sort`, `group`, `distinct`, a join's build side, aggregates over a whole list). A runtime may stream a chain of row-wise steps through record emission, so each record passes through the chain as it closes and a 500 MB config's rows are never held twice, and may fuse steps so an intermediate such as the nested form before an `explode` is never built. Blocking steps hold their input. Streaming and fusion must give the same values and the same logs as eager evaluation; Topic 7 pins log order so the two agree. A `transform` inside the grammar runs as its value is built and follows the kept path like any value (`T4a-08`).
- Alternatives: eager execution only, as `DEC-LAZY` (every intermediate held whole, against the memory requirement); lazy meaning (evaluation order leaks into logs and errors).
- Rests on: `T5-01`, `T5-04`, `T5-08`, `T4a-07` (the engine may skip values nothing reads), Topic 2 (500 MB inputs).
- Revisit if: Topic 7 cannot pin a log order that streaming honors cheaply (spike: memory of a streamed pipeline on a large config).
- Reversal cost: low for the spec, medium for a runtime that has to add streaming later.

### `T5-15` The result and its encodings

- Status: proxy. Serves Topic 1: the author may change the final form, such as arrays of objects versus CSV.
- Decision: a run's result is a value in the core types, beside its report and sidecars (the stream is Topic 7's). Host bindings deliver native values, and an absence state or a conflict is its own host type, never `null`, `None` or `undefined`, so a consumer cannot mistake one for a value. The JSON encoding is pinned: an absent value is `{"$absent": "<state>"}` with an optional `reason`, a conflict is `{"$conflict": [...]}` with its candidates in order, integers and decimals are written as their exact digits, and field names starting with `$` are reserved. Tabular encoders, CSV first, are library data functions that return text, each with a documented mapping for the states, by default the state name in the cell; so choosing CSV is choosing the last step of the pipeline.
- Alternatives: states as JSON `null` plus a sidecar (a consumer that ignores the sidecar sees one null, which Topic 3 rejected); encoders in the host binding (each runtime would drift).
- Rests on: Topic 1, Topic 3, `T5-05`, `T5-08`.
- Revisit if: a consumer, such as Nautobot, needs a different encoding of the states; an encoder option covers it.
- Reversal cost: high once consumers exist.

Raised for later topics: representation and fast paths for exact integers and decimals, code point comparison in JavaScript, and the memory of hash-based operations and streaming (Topic 6); where the drop and skip counts of `T5-06` and `T5-11` and the dangling-reference logs of `T5-12` go, and a log order that streaming honors (Topic 7); conformance for the data kernel and equivalence tests for the required natives, including sort stability (Topic 8); whether standalone pipelines (`T5-02`) and encoders (`T5-15`) are v1 (G6). Spikes for the plan: the BGP post-processing written closure-free (`T5-03`, `T5-05`, `T5-10` to `T5-12`); a streamed pipeline's memory on a large config (`T5-14`).

G2 decided in thread 6: `T5-01` to `T5-15`, open to the owner's veto.
