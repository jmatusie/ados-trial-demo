# XV2.0 Network Parser -- Product Requirements Document

Version: 0.1 (draft for refinement pass)
Date: 2026-09-19
Status: Research complete. Must-close decisions closed. Entering refinement.
Source: Research thread "XV2.0 Network Domain Parsing Library (research phase)".

---

## 0. How to Read This Document

This document is addressed to two downstream readers: a refinement agent acting as a second pair of eyes, and a planning agent that will make implementation decisions. It is deliberately structured so that neither reader has to invent anything load-bearing.

---

### 0.1 Identifier Scheme

Every statement in this document carries a typed identifier. The prefix tells you what the statement licenses.

| Prefix | Kind | What it licenses |
|--------|------|------------------|
| `VIS-NNN` | Vision | Orientation only. Never a source of derived requirements. |
| `OBJ-NNN` | Objective | A measurable outcome used to judge v1. Not a mechanism. |
| `US-NNN` | User story | A scenario. Basis for acceptance tests, not for feature invention. |
| `REQ-NNN` | Requirement | Binding. Every `REQ` admits a failing test. |
| `NG-NNN` | Non-goal | Out of scope. Do not extend scope to satisfy adjacent needs. |
| `DEC-*` | Decision | Closed, delegated, or open. See Section 8 for which. |
| `P-*` | Primitive | Reference vocabulary for the instruction set. Names may change; derivations may not. |
| `ACC-NNN` | Acceptance | A concrete artifact that must exist and pass before v1 is complete. |

---

### 0.2 Scope Tags

| Tag | Meaning |
|-----|---------|
| `[v1]` | Build now. |
| `[deferred]` | Specified now. The IR must accommodate it. Do not build it. |
| `[opt-in]` | Available per parser definition. Off by default. |

---

### 0.3 Rules for Downstream Agents

- Do not manufacture requirements from `VIS`, `OBJ`, or `US` statements. If a mechanism seems implied, raise it as a `DEC-OPEN`, do not implement it.
- Do not resolve a `DEC-OPEN` silently. Record the resolution and its rationale in the refinement report.
- Do not strike or weaken a `REQ` grounded in Appendix A without engaging the grounding. Several requirements look like over-engineering until the reasoning is read.
- `[deferred]` items constrain IR shape now even though they are not built. A design that would require breaking existing parser definitions to add a deferred item later is non-conforming.
- When a gap is discovered, add a `DEC-OPEN`. Do not decide inline.
- `NG` entries are enumerated precisely because each is a plausible derived requirement. Treat a proposal that reintroduces one as a scope change requiring explicit approval.

> Net: this document tells you what must be true, what has been decided, and what is still yours to decide. Nothing else.

---

## 1. Product Vision

`VIS-001` -- XV2.0 Network Parser targets data-savvy network engineers, not compiler engineers. An author who has never read the specification should be able to open an existing parser definition, recognize the input format inside it, and produce a working variant by editing what they see. Familiarity is the design currency: authoring syntax should resemble the text being parsed.

`VIS-002` -- Format variation is the normal case, not the exception. Vendor output drifts, new platforms arrive, and documents are irregular. Adapting to a newly encountered format should take minutes and touch only a parser definition -- never a build, a release, or a deployment.

`VIS-003` -- One definition, many runtimes. A parser written once should execute identically in a browser, in a Python service, and in whatever native environment follows, because the definition compiles to a portable intermediate representation and each runtime implements that representation to a shared conformance standard.

`VIS-004` -- The product of parsing is records, not documents. Device configurations and command output are document-shaped, but the useful output is normalized record sets at a declared grain: one row per VLAN, per interface, per BGP neighbor, per ACL entry. Grain-shaping is a first-class part of parsing, and the record is the contract between parsing and everything downstream.

---

## 2. Objectives

Each objective is measurable. None of them prescribes a mechanism.

| ID | Objective | Measurement |
|----|-----------|-------------|
| `OBJ-001` | An engineer unfamiliar with the DSL produces a working parser for an unseen format within one working session, given only existing examples | Timed trial with a target format not present in the example set |
| `OBJ-002` | Adapting an existing parser to a format variation requires no artifact other than the parser definition itself | Audit of the change set for any variation fix |
| `OBJ-003` | Diagnosing why a parser failed to match requires no host-language debugger | Failure diagnosis performed using only emitted trace and log output |
| `OBJ-004` | The five acceptance parsers (`ACC-001` to `ACC-005`) run on the reference core and reproduce the record sets produced by the current JS system | Golden-output comparison |

Note on `OBJ-001`: this objective is only fully testable once template-mode authoring exists. See `DEC-SURFACE` in Section 8.3.

---

## 3. Personas and User Stories

---

### 3.1 Personas

| Persona | Description |
|---------|-------------|
| Author | Network engineer, comfortable with regular expressions and structured data, not a full-time developer. Writes and maintains parser definitions. |
| Operator | Runs parsers in production pipelines. Consumes logs, coverage records, and structured output. Does not edit parsers. |
| Core Developer | Implements and maintains a language-specific core against the IR specification and conformance suite. |

---

### 3.2 User Stories -- Authoring and Diagnosis

- `US-001` -- As an Author, when my parser returns nothing, I need to see which sub-parser failed and at what input position, so I can tell a definition bug from a data variation.
- `US-002` -- As an Author, when output is structurally wrong, I need to see which sub-parser produced each field.
- `US-003` -- As an Operator, when a production parse degrades, I need the emitted log and coverage record without re-running with different flags.
- `US-004` -- As an Author, I need to see the path that was attempted and abandoned, not only the path that succeeded.
- `US-010` -- As an Author, when a vendor changes output format, I need to adapt the parser by editing its definition alone, with no build or deployment step.
- `US-011` -- As an Author, I need to use regular expressions inside a definition where that is the most natural way to express a match, and have the result behave identically on every runtime.
- `US-012` -- As an Operator, I need a coverage record showing which input lines no parser claimed, so unmodeled content is visible rather than silently discarded.

---

### 3.3 User Stories -- Grain Patterns

These five stories are the canonical grain patterns for the domain. Each corresponds to an acceptance parser in Section 9.

- `US-005` (VLAN) -- As an Author, I need one record per VLAN from a config where each VLAN is a delimited section with a unique ID and a small set of attributes, each attribute becoming a column.
- `US-006` (Interface) -- As an Author, I need one record per interface from a config where each interface is a delimited section with many attributes as columns, and where multi-valued sub-attributes (`ip nat`, `ip igmp static-group`) are emitted as separate child record sets carrying the interface name as a foreign key.
- `US-007` (BGP neighbor) -- As an Author, I need one record per BGP neighbor where the neighbor's attributes are spread across multiple lines sharing a key with no delimiter between neighbors, and where the same structure repeats inside VRF sub-sections such that the VRF name becomes part of the record key.
- `US-008` (ACL entry) -- As an Author, I need one record per ACL entry where the record key is composite: the ACL name from the enclosing section plus the entry sequence from the line itself.
- `US-009` (Route-map entry) -- As an Author, I need one record per route-map entry where the section header carries the key (name plus sequence) and the section body carries the attributes (match and set statements).

---

## 4. Scope

---

### 4.1 v1 Scope Statement

v1 delivers the parser tier only: recognition, grain shaping, and record output with span provenance; a single expression-form authoring surface; the portable IR; one reference core in TypeScript/JavaScript; a conformance suite defined against that core; and the five acceptance parsers ported from the existing JS system as golden tests.

The transform tier is specified in this document but not built in v1. The record contract between tiers is fixed in v1 because it constrains parser-tier output.

---

### 4.2 Deferred Items

Specified now, built later. Each constrains IR shape.

| Item | Why deferred | IR constraint imposed now |
|------|-------------|---------------------------|
| Template-mode authoring surface | Expression form is total; templates are sugar | Template desugaring must produce existing IR nodes with zero IR change |
| Semiring-parameterized choice | v1 is first-match only | Choice node carries an accumulation-strategy slot |
| Cross-source knowledge merge | v1 merges only within one parse | Record type carries provenance sufficient to merge later |
| Unordered set matching | Rare in practice | Reserved node kind |
| Lossless CST capture | Record extraction does not need it | Span provenance is mandatory; trivia attachment is opt-in |
| Transform tier | Parser tier first | Record contract fixed in v1 |
| Python and further cores | Reference core first | Conformance suite exists from day one |
| MDL-based template quality metrics | Research-grade | Coverage accounting present in v1 provides the substrate |

---

### 4.3 Non-Goals

Each of these is listed because it is a plausible derived requirement.

| ID | Non-goal | Why it is excluded |
|----|----------|--------------------|
| `NG-001` | Cross-reference validation (does the named interface exist) | Consistency checking against a schema, not parsing. Downstream. |
| `NG-002` | Type and range checking of parsed values | Same. |
| `NG-003` | Semantic normalization and alias resolution (`Gi0/1` vs `GigabitEthernet0/1`) | Requires external knowledge; couples parsers to it. Downstream. |
| `NG-004` | Text extraction from PDF, HTML, Excel | Upstream. The core accepts text and byte streams only. |
| `NG-005` | Jinja2 semantics (inheritance, filters, macros, control-flow blocks) | Only delimiter familiarity is borrowed. |
| `NG-006` | Host-language code in parser definitions | Kills portability; is a code-execution surface. |
| `NG-007` | API compatibility with the existing JS system | Parity is by golden output, not by API. |
| `NG-008` | External-data and runtime-value parameterization in the DSL | Core-library facility only. See `REQ-036`. |
| `NG-009` | Left recursion | Named non-goal; rewrite grammars instead. |
| `NG-010` | GUI, IDE, visual editor, or autocomplete tooling | Explicitly not what "low barrier to entry" means. |
| `NG-011` | Streaming telemetry (gNMI) as parser-tier input | Already structured. Transform-tier input only, and transform is deferred. |

---

## 5. Architecture (Binding)

The system is two tiers joined by a portable intermediate representation. Relationships are stated relationally.

| From | Relation | To |
|------|----------|----|
| Parser definition (DSL) | compiles to | Parser IR |
| Template surface `[deferred]` | desugars to | Expression surface |
| Expression surface `[v1]` | compiles to | Parser IR |
| Parser IR | interpreted by | Reference core (TS/JS) `[v1]` |
| Parser IR | interpreted by | Python core `[deferred]` |
| Parser IR | emits | Record sets with span provenance |
| Record sets | consumed by | Transform IR `[deferred]` |
| Conformance suite | validates | Every core against the reference core |
| Derivation map | defines | Every non-elemental `P-*` as a composition of elemental `P-*` |
| Function registry | is part of | The IR specification, covered by the conformance suite |

Architectural invariants:

- `REQ-010` `[v1]` -- Two tiers: a language-agnostic DSL as the authoring surface and a stable core library as the developer surface.
- `REQ-011` `[v1]` -- The architecture admits multiple language-specific cores for different runtimes and performance targets. v1 ships one.
- `REQ-012` `[v1]` -- A portable IR sits between DSL and cores. DSL semantics are defined by the IR, never by any one core.
- `REQ-013` `[v1]` -- All authoring surfaces compile to the same IR node vocabulary.
- `REQ-016` `[v1]` -- A conformance suite per tier, backed by a derivation map for every non-elemental primitive, is the definition of core correctness.

> The IR is what prevents semantic drift between cores and what makes tracing a single implementation rather than one per language.

---

## 6. Requirements

---

### 6.1 Authoring Surface

| ID | Tag | Requirement |
|----|-----|-------------|
| `REQ-001a` | `[deferred]` | Template-mode surface syntax is visually derivable from a sample of the target text. |
| `REQ-002a` | `[v1]` | Parser definitions are runtime-loadable data artifacts, never compiled or linked units. |
| `REQ-002b` | `[v1]` | Authoring requires no toolchain beyond a text editor and the runtime. |
| `REQ-003a` | `[v1]` | Output shapes are bounded by the registered type set. The DSL cannot construct types outside it. |
| `REQ-003b` | `[v1]` | The DSL executes no host-language code. Extension is solely by invoking functions from a registry. |
| `REQ-003c` | `[v1]` | The registry is part of the specification and covered by the conformance suite. Host-local extensions are permitted but marked non-portable, and a definition using one is statically identifiable as such. |
| `REQ-004` | `[v1]` | Multi-level composability: parsers reference parsers by name to arbitrary depth, including recursion. |
| `REQ-007a` | `[deferred]` | A template authoring mode exists in which unmarked text matches literally and marked regions denote extraction or named-parser invocation. Delimiters echo Jinja2 for familiarity only (see `NG-005`). |
| `REQ-014` | `[deferred]` | Named-parser references are usable inside template blocks. |
| `REQ-015` | `[v1]` | Domain conveniences (`parse_line`, `section`, `parse_table`) are stdlib compositions over primitives, not new primitives. |
| `REQ-036` | `[v1]` | The DSL supports value parameters and parser parameters, monomorphized before the IR. External-data and runtime-value parameterization are core-library only, with one exception: position and geometry parameterization lexically scoped to the composing parser (see `REQ-033`). |

---

### 6.2 Parser-Tier Semantics

| ID | Tag | Requirement |
|----|-----|-------------|
| `REQ-017` | `[v1]` | Regular expressions are a terminal node with a frozen dialect specified in the IR: no backreferences, no lookaround, no possessive quantifiers. The dialect is not inherited from the host language. |
| `REQ-020` | `[v1]` | Absence is a tagged four-state value: inapplicable, unknown, expected-absent, present-unparseable. No primitive collapses these to a single null. Default presentation at the DSL surface is simple; the full model is reachable when asked for. |
| `REQ-021` | `[v1]` | Every emitted record carries span provenance (which input lines and byte ranges produced it) and region-completeness (whether the producing parser consumed a whole delimited region or a fragment). |
| `REQ-022` | `[deferred]` | Choice accumulation is parameterizable: first-match, all-matches, count, best-by-score, min-cost. v1 implements first-match; the IR node carries the slot. |
| `REQ-023a` | `[v1]` | Within one parse, multiple tagged values for one record fold into that record under a defined merge with `REQ-020` deciding the meaning of absent attributes. |
| `REQ-023b` | `[deferred]` | Across independent parses of the same fact, merge is a knowledge-order join: associative, commutative, idempotent, with an explicit conflict state. |
| `REQ-024` | `[v1]` | Coverage accounting: unmatched input is captured as residual and counted, never silently dropped. |
| `REQ-031` | `[v1]` | Failure is resumable: a `recover` primitive with a synchronization point (v1: line boundary) records the skipped region as a gap and continues. |
| `REQ-032` | `[v1]` | Residual capture: a primitive that claims whatever no other parser claimed, as first-class output. |
| `REQ-033` | `[v1]` | Indentation-sensitive parsing is achieved by primitives that read line and column as a pure function of index and parameterize a scope's termination predicate by the scope's own start position. No indent stack, no preprocessor. Position parameterization must be lexically scoped to the composing parser. |
| `REQ-034` | `[v1]` | Column-geometry matching uses the same position primitives as `REQ-033`. Header-derived column offsets are geometry values lexically scoped to the block that parsed the header. |
| `REQ-035` | `[deferred]` | Unordered set matching (N parsers against N spans, order-independent). Reserved node kind. |
| `REQ-030` | `[opt-in]` | Lossless capture: trivia attached to nodes such that `render(parse(src)) == src`. Off by default. |

---

### 6.3 Grain and Record Output

| ID | Tag | Requirement |
|----|-----|-------------|
| `REQ-050` | `[v1]` | Grain is a parser-tier concern. Primitives exist to declare a record boundary with an identity specification, to propagate an enclosing-scope value as a column to every record emitted within scope, to fold same-key matches into one record, and to emit to a separate child record set keyed by the enclosing record. |
| `REQ-051` | `[v1]` | A compound `section` primitive combines a delimiter-aware or indent-aware region with a grain boundary, so the most common authoring act is one construct. |
| `REQ-052` | `[v1]` | Record identity is declared, not inferred. A record type names its key columns; composite keys are permitted. |
| `REQ-053` | `[v1]` | The record is the contract between parser and transform tiers. Its type, absence semantics, and provenance fields are fixed in v1. |
| `REQ-054` | `[v1]` | The boundary test for tier placement: an operation that must know the structure of the input text belongs in the parser IR; one that needs only records belongs in the transform IR. |

---

### 6.4 Core State Model

The reference core adopts a single uniform signature for every primitive: a function from parser state to parser state. State is partitioned by rollback behavior.

| Field | Class | Notes |
|-------|-------|-------|
| input | immutable | Bytes or text. Line-offset table precomputed at parse start. |
| index | transactional | Byte position. |
| line, column | derived | Pure function of index via the line-offset table (binary search). Tab expansion policy declared in the IR specification. |
| result | transactional | |
| error | transactional | Merged across alternatives failing at the same position. |
| bindings and records | transactional | |
| user data | transactional | |
| log, trace, coverage | monotonic | Never rolls back. |
| provenance spans | attached to records | |

| ID | Tag | Requirement |
|----|-----|-------------|
| `REQ-040` | `[v1]` | State is partitioned into transactional (rolls back on backtrack) and monotonic (never rolls back). Logs, trace events, and coverage counters are monotonic. |
| `REQ-041` | `[v1]` | Line and column are available in core state, derived from index in O(log n) via a precomputed table. |
| `REQ-042` | `[v1]` | Errors from alternatives failing at the same position are merged, not last-write-wins. |
| `REQ-043` | `[v1]` | The repetition progress guard tests transactional state change, not position change alone. Monotonic-only changes do not count as progress. |
| `REQ-044` | `[v1]` | Every primitive has the same signature: state in, state out. |

---

### 6.5 Diagnostics

| ID | Tag | Requirement |
|----|-----|-------------|
| `REQ-005a` | `[v1]` | Log records are structured, leveled, positioned, emitted from within parser definitions, and survive backtracking. |
| `REQ-008a` | `[v1]` | Trace output answers `US-001`, `US-002`, and `US-004` without a host-language debugger. |
| `REQ-008b` | `[v1]` | Flags settable from within a definition influence diagnostics only. They never influence matching or control flow. |

---

### 6.6 Transform Tier (Deferred; Contract Fixed in v1)

| ID | Tag | Requirement |
|----|-----|-------------|
| `REQ-006a` | `[deferred]` | Transformation is a distinct tier with its own algebra, IR, and conformance suite, under the same DSL/IR/core discipline as parsing. |
| `REQ-006b` | `[deferred]` | The operation set is closed: every operation's inputs and outputs are members of the registered type set. |
| `REQ-006c` | `[deferred]` | Errors are values in the type set, not control-flow events. User error clauses are ordinary operations over those values. |
| `REQ-006d` | `[deferred]` | Every registered aggregation declares an identity element. |
| `REQ-006e` | `[v1]` | Parsing and transformation are separate staged artifacts in the IR regardless of authoring continuity. A core may fuse them at execution time. |
| `REQ-006f` | `[deferred]` | Absence semantics in transformation agree with `REQ-020`. |
| `REQ-006g` | `[deferred]` | Ordering semantics are specified per operation. |
| `REQ-006h` | `[deferred]` | Named, saved pipelines and module namespacing, resolved by the same rules as parser naming. |
| `REQ-006i` | `[deferred]` | Pattern matching is the branching construct, shared in form with the parser tier's `dispatch`. |

---

### 6.7 Portability and Conformance

| ID | Tag | Requirement |
|----|-----|-------------|
| `REQ-060` | `[v1]` | Every non-elemental primitive implemented natively by a core has a recorded reference composition in the derivation map, and the conformance suite asserts equivalence. |
| `REQ-061` | `[v1]` | Any behavior that could vary by host (regex dialect, tab expansion, Unicode handling, ordering) is specified in the IR, not delegated to the host. |
| `REQ-062` | `[v1]` | A parser definition containing `dispatch` or a non-portable registry function is statically identifiable as such. |

---

## 7. Primitive Instruction Set (Reference Vocabulary)

The set is an instruction set architecture, not a minimal generating set. Redundancy is admitted for ergonomics, speed, and traceability. Names are reference vocabulary; the design phase may rename, but every non-elemental entry must keep its derivation.

---

### 7.1 Elemental Core

| ID | Primitive | Role |
|----|-----------|------|
| `P-TOKEN` | `token(pred)` | Consumes one element if the predicate holds. The floor of the algebra. |
| `P-SEQ` | `sequence(...)` | Ordered composition (product). |
| `P-ALT` | `alternative(...)` | Ordered choice. Non-commutative. Accumulation slot per `REQ-022`. |
| `P-MANY` | `many(p)` | Greedy, possessive repetition. Progress guard per `REQ-043`. |
| `P-MAP` | `transform(p, fn)` | Registered pure function over a match. |
| `P-BIND` | `bind(name, p)` | Names a field; emits four-state tagged absence. |
| `P-REF` | `ref(name)` | Invokes a named parser. Enables recursion and composition. |
| `P-LOOK` | `lookahead(p)`, `negate(p)` | Zero-width assertions. |
| `P-EMPTY` | `empty`, `succeed(v)` | Identity elements. |
| `P-LABEL` | `label(msg, p)` | Names a parser for errors and traces. |
| `P-LOG` | `log(level, msg)` | Monotonic diagnostic emission. |
| `P-MERGE` | `merge(a, b)` | Record-level fold within a parse (`REQ-023a`); knowledge-order join deferred (`REQ-023b`). |

---

### 7.2 Terminal Family

`literal(s)`, `regex(pat)` (frozen dialect), `take_while(pred)`, `take_until(pat)`, `rest_of_line`, `eof`.

`regex` is expressively redundant with `P-TOKEN`, `P-SEQ`, `P-ALT`, `P-MANY`. It is admitted for familiarity and speed. Any regular subtree (no `P-REF`, no `P-BIND`) is statically detectable and may be compiled to a DFA; any regex may be expanded to primitives for tracing.

---

### 7.3 Navigation and Position

`advance_by(n)` (skipped bytes captured as trivia when `REQ-030` is enabled), `at_column(n)`, `span(start_col, end_col)`, and pure reads `position()`, `column()`, `line()`, `indent_level()`.

---

### 7.4 Zero-Width Effects

`inject(value)`, `fail(msg)`, `log(level, msg)`, `set_flag(k, v)`, `get_flag(k)` (diagnostics only per `REQ-008b`), `mark(name)`.

---

### 7.5 Grain

| Primitive | Does |
|-----------|------|
| `tag(name)` | `P-BIND` emitting a tagged value. |
| `record(key_spec, p)` | Grain boundary: `p` yields one record with the declared identity. |
| `context(name, p)` | Filldown: value propagates as a column to every record emitted in scope. |
| `accumulate_by(key, p)` | Same-key matches fold into one record. |
| `child(fk, p)` | Emit to a separate record set carrying the enclosing record's key. |
| `section(open, close_or_indent, key_spec, p)` | Compound: delimited or indented region plus grain boundary. |

---

### 7.6 Control and Recovery

| Primitive | Does |
|-----------|------|
| `dispatch(p, on, cases, default)` | Selective branching: the value produced by `p` selects one of a declared, closed set of named parsers. Never constructs a parser. |
| `recover(p, sync)` | On failure, records the gap and resynchronizes at `sync`. |
| `residual()` | Claims unmatched input as first-class output. |

---

### 7.7 Derived (Stdlib, Not Primitive)

`optional`, `many1`, `count`, `sepBy`, `sepBy1`, `endBy`, `between`, `manyTill`, `choice`, `parse_line`, `parse_table`. Each has a recorded derivation per `REQ-060`.

---

## 8. Decisions

---

### 8.1 Closed Decisions

Do not reopen without flagging.

| ID | Decision | Rationale |
|----|----------|-----------|
| `DEC-IR` | DSL compiles to a portable IR; cores interpret the IR. | Prevents semantic drift between cores; tracing implemented once. |
| `DEC-COMMIT` | Free backtracking. No `try` primitive. | Matches the existing system and the state-transformer design; `try` is an artifact of commit-on-consume strategies. |
| `DEC-EXPR` | Selective by default; monadic never. Branching is `dispatch` over declared cases. Position-parameterized scopes are permitted because they affect termination, not reachability. | Preserves static analysis (nullability, left-recursion detection, branch enumeration) while admitting the context the existing system needs. |
| `DEC-ORDER` | Collections are ordered sequences. Sets arise only via explicit `distinct`. | Config line order is meaningful in this domain. |
| `DEC-REFCORE` | Reference core is TypeScript/JavaScript. Python second. | Migrates the existing system; browser execution is a stated target. |
| `DEC-PARITY` | Parity with the existing JS system is by golden output on the five acceptance parsers. No API compatibility. | Frees the design; preserves proof of coverage. |
| `DEC-SCOPE` | v1 is parser tier only, as stated in Section 4.1. | Keeps v1 buildable. |
| `DEC-CST` | Lossless capture is opt-in, not mandatory. Span provenance is mandatory. | Record extraction does not require it; retrofit cost is managed by making trivia attachment a per-parser switch. |
| `DEC-LAYOUT` | No INDENT/DEDENT preprocessor. Layout via lexically scoped position parameterization. | Existing system proves the approach; reachability analysis survives. |

---

### 8.2 Delegated to Design (Constraints Stated Here)

The design phase decides; the answer must satisfy the stated constraints.

| Item | Constraints |
|------|-------------|
| Type system | Finite registered set. Includes four-state absence, record with declared key columns, span, and tagged value. Closed over every operation. Static shape known at definition load time. |
| Namespacing | Lexical scoping plus explicit import. No dynamic resolution. Same rules for parsers, records, and (later) pipelines. |
| Error and log record shape | Structured, leveled, positioned, labeled by `P-LABEL` path, merged per `REQ-042`, monotonic per `REQ-040`. |
| DSL expression syntax | Satisfies `REQ-002a`, `REQ-002b`, `REQ-003b`, `REQ-036`. Template mode must later desugar to it with zero IR change. |
| Conformance suite design | Exists per tier. Golden-output based. Includes the derivation map assertions of `REQ-060` and host-variance cases of `REQ-061`. |
| Position model details | Byte index, precomputed line table, declared tab policy, declared Unicode column policy. |
| Registry v1 contents | Minimal set sufficient for the five acceptance parsers. Every entry portable. |

---

### 8.3 Open Questions for the Refinement Pass

Each carries a recommendation and its reasoning. The refinement pass resolves or escalates; it does not leave these implicit.

| ID | Question | Recommendation | Reasoning |
|----|----------|----------------|-----------|
| `DEC-SURFACE` | Which authoring form ships in v1? | Expression form. Template form as the first post-v1 increment, implemented as pure front-end desugaring. | Expression form is total; templates are partial sugar; the migration source is combinator-shaped. Cost: `OBJ-001` is only partially testable in v1. |
| `DEC-STREAM` | Streaming or whole-input? | Whole-input for v1. IR designed so unbounded lookahead is the only construct that would preclude streaming, and it is flagged. | Simplicity now; option preserved. |
| `DEC-TCOMPLETE` | May named pipelines (transform tier) recurse? | No. | Termination guarantee for production. Parser-tier `P-REF` recursion is separate and permitted. |
| `DEC-LAZY` | Lazy or eager evaluation in the transform tier? | Eager. | Log ordering determinism (`REQ-005a`). |
| `DEC-DOCMODEL` | Does the v1 transform tier need tree operations at all? | Defer the question with the tier. Since parsers emit flat records, tree operations are needed only for gNMI JSON input, which is `[deferred]`. | Narrowed from the original framing. |
| `DEC-UNA` | Unique name assumption for entity identity? | State as downstream non-goal (`NG-003`). | Identity resolution requires external knowledge. |

---

## 9. Acceptance

v1 is complete when every item below exists and passes on the reference core.

| ID | Artifact | Source of truth |
|----|----------|-----------------|
| `ACC-001` | VLAN parser (`US-005`) | Golden record set from the existing JS system |
| `ACC-002` | Interface parser with NAT and IGMP static-group child record sets (`US-006`) | Same |
| `ACC-003` | BGP neighbor parser, global and VRF (`US-007`) | Same |
| `ACC-004` | ACL entry parser (`US-008`) | Same |
| `ACC-005` | Route-map entry parser (`US-009`) | Same |
| `ACC-006` | Conformance suite passing on the reference core, including derivation-map assertions | `REQ-016`, `REQ-060` |
| `ACC-007` | Attempted-path trace for a deliberately failing parse (`US-004`) | `REQ-008a`, `REQ-040` |
| `ACC-008` | Coverage record for a config containing unmodeled lines (`US-012`) | `REQ-024`, `REQ-032` |
| `ACC-009` | A regex-bearing definition producing identical output on the reference core under the frozen dialect (`US-011`) | `REQ-017` |

---

## 10. Build Milestones

Derived from Section 4.1 and Section 9 by the build process, not part of the original document. `record/queue.md` is ordered against this table, and the end-of-session report counts it for "Phase N of M".

| # | Milestone | Met when | Acceptance |
|---|-----------|----------|------------|
| 1 | Record contract | A record type exists with span provenance, declared key columns and four-state absence, fixing the tier boundary | constrains parser output |
| 2 | Portable IR | Every Section 7 primitive has an IR node, and every `[deferred]` item has a reserved slot that needs no IR change later | `DEC-IR` |
| 3 | Expression surface | A definition written in the authoring surface compiles to the IR and back | `REQ-002a`, `REQ-002b`, `REQ-003a` to `REQ-003c`, `REQ-036` |
| 4 | Reference core | The IR executes on the TypeScript core with monotonic and transactional state partitions | `REQ-040` to `REQ-044` |
| 5 | Conformance suite | The suite runs green on the reference core and asserts the derivation map | `ACC-006`, `REQ-016`, `REQ-060` |
| 6 | Diagnostics and dialect | Attempted-path trace, coverage record for unmodeled lines, and a regex-bearing definition under the frozen dialect | `ACC-007`, `ACC-008`, `ACC-009` |
| 7 | First parser | The VLAN parser reproduces its golden record set | `ACC-001` |
| 8 | Remaining parsers | Interface with NAT and IGMP child sets, BGP neighbor, ACL entry, route-map entry | `ACC-002` to `ACC-005` |

Milestones 1 to 6 need nothing from the owner. Milestones 7 and 8 are blocked until sanitized device output exists in `samples/` and the golden record sets can be produced from it.

The conformance suite is ordered before the first ported parser. The reverse order is better when golden sets already exist, because the derivation map is informed by a ported parser; here it would place a blocked item at milestone 5 and stall everything behind it.

---

## Appendix A. Theoretical Grounding (Rationale)

This appendix exists so that the refinement pass can evaluate non-obvious requirements against their reasoning rather than re-deriving or striking them. Citations are pointers to verify, not confirmed references.

---

### A.1 Structural Algebra and Its Limits

Product (`P-SEQ`), sum (`P-ALT`), and map (`P-MAP`) are sufficient to construct any inductively defined output type. They are not sufficient to describe parsing, because parsing also involves recognition, disambiguation, and accounting -- none of which are type construction. The category-theoretic framing (Functor, Applicative, Monad) describes how to plumb effectful computation and says nothing about what a parse means, what absence means, or which of two definitions is better. It is an implementation vocabulary, not a domain theory. Supports: Section 7 as an ISA rather than a minimal set.

---

### A.2 PEG Semantics Corrections

Three properties of PEG-style combinators that are routinely misdescribed and have design consequences:

- Ordered choice is not commutative. `a / ab` never matches `ab`. Sum types are commutative up to isomorphism; ordered choice is not a sum type. Supports: `P-ALT` documentation, author guidance.
- Repetition is greedy and possessive: it never returns input on later failure. CFG Kleene star does. Supports: `P-MANY` semantics.
- `try` is not a universal primitive. It exists in Parsec because Parsec commits on consumed input. A freely backtracking core needs no `try`. Supports: `DEC-COMMIT`.

---

### A.3 Applicative, Selective, Monadic

Applicative-only parsers have statically knowable grammars: nullability, first sets, left recursion, and branch enumeration are all computable. Monadic parsers construct grammar at runtime and forfeit all of that. Selective applicative functors sit between: every effect that might occur is statically known; which one occurs is chosen at runtime. A DSL that forbids host code (`REQ-003b`) can only select among named parsers, never construct one, so its branching is selective by construction. Position parameterization (`REQ-033`) is weaker still: it changes where a scope terminates, not which productions are reachable. Supports: `DEC-EXPR`, `dispatch`, `REQ-033`. Pointer: Mokhov et al., "Selective Applicative Functors", circa 2019.

---

### A.4 Semiring Parsing

Parsing algorithms can be parameterized over a semiring; the semiring determines what a match produces. Boolean gives recognition; Viterbi gives the best match; counting gives ambiguity detection; derivation-forest gives all matches; tropical gives min-cost. Match-first, match-any, and match-all are therefore one primitive with a parameter, not three primitives. Supports: `REQ-022`. Pointer: Goodman, "Semiring Parsing", circa 1999.

---

### A.5 Null Semantics and Local Closed World

SQL's single null conflates "unknown" with "inapplicable" and is a widely regretted design. The domain needs at least four absence states: inapplicable, unknown (open world), expected-absent (closed-world violation), present-unparseable. Whether a region may be closed over -- whether absence within it is meaningful negative information -- depends on whether the parser consumed the whole region. That is the local closed-world assumption, and it is why region-completeness is part of provenance. Supports: `REQ-020`, `REQ-021`. Pointers: Codd on null marks; Reiter on the closed-world assumption; Imielinski and Lipski on incomplete information; Etzioni, Golden, and Weld on local closed-world reasoning.

---

### A.6 Knowledge-Order Merge

Belnap's four-valued logic carries a knowledge ordering under which merging partial information is a join-semilattice operation: associative, commutative, idempotent, with an explicit conflict state. Merge order does not matter and duplicate sources are harmless. Supports: `REQ-023b`. Pointer: Belnap, "A Useful Four-Valued Logic", circa 1977.

---

### A.7 Information Theory

Surprisal turns "is this absence an error or information" into a measurable threshold over corpus statistics. Minimum description length turns "which of two definitions is better" into a principled comparison and underlies template induction from examples. Both are deferred but both depend on coverage accounting existing. Supports: `REQ-024` as substrate.

---

### A.8 Regex as a Compressed Sub-Algebra

Regular expression concatenation, alternation, and star are exactly `P-SEQ`, `P-ALT`, and `P-MANY` restricted to the non-recursive case. Regex adds no expressive power; it adds familiarity and DFA-speed. Its cost is dialect divergence across hosts, which is fatal to `DEC-IR` unless the dialect is frozen in the IR. Supports: `REQ-017`, Section 7.2.

---

### A.9 Layout Without a Stack

Classic indentation-sensitive parsing uses a mutable indent stack, which is context-sensitive. Parameterizing a scope by its own start column, with column derived purely from index, needs no stack: the composition stack is the scope stack. Reachability is unchanged; only termination predicates vary. Supports: `DEC-LAYOUT`, `REQ-033`, `REQ-034`. Pointers: megaparsec `indentGuard` and `indentBlock`; Adams on indentation-sensitive parsing, circa 2013.

---

### A.10 Grain Is a Parser Concern

The BGP neighbor case demonstrates that grain cannot always be deferred to post-processing: with no delimiter, the recognizer must know that same-key lines are one entity. TextFSM's `Filldown` and `Record`, and TTP's nested groups, are grain primitives that made weak parsers succeed in this domain. General combinator libraries have strong recognition and no grain concept. Supports: Section 6.3, Section 7.5.

---

## Appendix B. Prior Art Surveyed

| Tool | Lineage | What it teaches | Verdict |
|------|---------|-----------------|---------|
| TextFSM | Network-specific template | `Filldown`, `Record` are grain primitives; huge template library | Weak parser; borrow grain concepts |
| TTP | Network-specific template | Jinja-flavored syntax; nested groups produce child record sets | Closer to intent; thin tracing |
| ciscoconfparse | Config object model | Contrast case: object model over parsed config | Not a parser |
| pyparsing | Combinator | Operator-overloaded composition; parse actions | Reference for combinator ergonomics |
| Parsec, nom, parsy | Combinator | The general ancestor; `try` semantics; tracing combinators in nom | Reference for primitive vocabulary |
| Lark, Pest, Peggy, ANTLR | Grammar engine | Declarative grammar plus transformer; ANTLR shows SDLC weight | Too heavy for on-demand authoring |
| arcsecond | Combinator (TS) | Uniform state-transformer signature; `data` channel; `errorChain` recovery | Steal the shape, not the library: no line/column, no monotonic channel, single error, dormant |
| megaparsec | Combinator (Haskell) | Indentation via position-parameterized scopes | Validates `DEC-LAYOUT` |
| JMESPath | Query DSL | Spec plus compliance suite across languages; deliberately not Turing-complete | Governance model for the transform tier |
| jq | Query DSL | Pipe-first composition; stream semantics; ports in Go, Rust, WASM | Ergonomics reference; Turing-complete, which is the line not to cross |
| Substrait | Relational IR | Cross-language serialized plans executed by different engines | `DEC-IR` for the transform tier, already built |
| PRQL | Pipeline DSL | Pipeline syntax over relational semantics for non-programmers | Surface-syntax reference |
| Jolt, JSLT | JSON transform spec | Declarative transformation that is not a programming language | Reference for bounded transform vocabulary |

---

## Appendix C. Traceability Index

| Requirement group | Serves | Grounded in |
|-------------------|--------|-------------|
| `REQ-001a`, `REQ-002a`, `REQ-002b`, `REQ-007a` | `VIS-001`, `VIS-002`, `OBJ-001`, `OBJ-002`, `US-010` | -- |
| `REQ-003a` to `REQ-003c` | `VIS-003` | A.3 |
| `REQ-017` | `US-011`, `ACC-009` | A.8 |
| `REQ-020`, `REQ-021` | `US-006`, `US-012` | A.5 |
| `REQ-022` | deferred | A.4 |
| `REQ-023a`, `REQ-023b` | `US-007` | A.6 |
| `REQ-024`, `REQ-031`, `REQ-032` | `US-003`, `US-012`, `ACC-008` | A.7 |
| `REQ-033`, `REQ-034` | `US-005` to `US-009` | A.9 |
| `REQ-040` to `REQ-044` | `US-001`, `US-004`, `ACC-007` | A.2, arcsecond review |
| `REQ-050` to `REQ-054` | `US-005` to `US-009`, `VIS-004` | A.10 |
| `REQ-060` to `REQ-062` | `VIS-003`, `ACC-006` | A.8, A.3 |

---

> The through-line of this document: parser IR is recognition plus grain shaping, emitting typed record sets with provenance; the record is the contract; every behavior that could vary by host is frozen in the IR; and everything not yet built has already reserved its place.
