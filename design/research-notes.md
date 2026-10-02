# Research transcript notes

A map of `origin-xv2-research-thread-transcript.md`, the originating research thread that the old PRD was distilled from, sorted by interview topic. Written in thread 3 so later threads can go straight to the exchanges that matter. The transcript's own Section 1 (turn index), Section 2 (decision log) and Section 3 (supersession log) summarize every exchange; this file adds what bears on each interview topic and the errors found. Items marked "Claude's reading" are inferences, not the transcript's words. Citations are pointers to verify.

---

## Using the transcript

- Exchanges are labelled `E01` to `E23`. Find one by searching for its heading, such as `### E19`.
- Owner turns are verbatim. Assistant turns are the research assistant's, which ran with reasoning disabled (`E07`), so they carry its errors, and the old PRD inherited them.
- Read in thread 3: `E04` to `E14` and `E17` to `E21`. `E01` to `E03`, `E15`, `E16`, `E22` and `E23` were read by a sub-agent and are indexed in the next section, so the whole transcript is now indexed.

---

## The owner's charter and the other exchanges

Indexed in thread 3 by a sub-agent that read them in full. Owner quotes are verbatim. Owner intent found here that no topic had recorded is parked in `interview.md` for confirmation.

- `E01`, the charter: the owner describes semi-structured text from "device configuration formats, show commands, and sometimes PDF documents", made into parsers by "data-savvy domain experts". Required qualities: "Easy barrier to entry (learn by example)", parsers made "without going through SDLC life cycle iterations", output "in any shape of their choosing", "multi-level composability of parsers (by exposing a fixed set of primitive operations)", "user-defined logging (informational/warning/error) that becomes first class, useful for production systems", a way to "transform results", "template-based parsers (Jinja2-like patterns)" and a "debug mode". The assistant's survey (TextFSM, TTP, ciscoconfparse, pyparsing, the Parsec family, nom, Lark, Pest, Peggy, ANTLR) found no tool with all of them. Bears on Topics 1, 5 and 7 and the DSL.
- `E02`: the owner proposes "two tiers", a "language-agnostic custom DSL (user surface)" and "a stable core library implementing the primitives", plus "common low level utilitarian compositional patterns" such as `parse_line` and `parse_table`, and cores per language for "different optimization/performance targets". The assistant adds the portable IR between them. Bears on Topic 1 (recorded) and 4a.
- `E03`: the owner suggests "one of the 'core primitives' could simply be accepting a TTP-type template", with "the best parsers likely emerging being somewhere in between" (`many(interface_parser)` beside `create_from_template(interface_template)`), and a "Jinja2-aligned" template whose variable blocks run a named parser "instead of rendering". The assistant shows that templates and combinators compile to the same IR nodes, and leaves open how names resolve, whether an embedded parser's result merges or nests, and how repetition is written in a template. Bears on the DSL and Topics 3, 4 and 4a.
- `E15`: the owner worries that "a separate reasoning model" will read a subjective statement such as low barrier to entry "too literally and assume/create a derived requirement never intended", and asks to restate such items as "Project Vision", "Objectives" and "User Stories". The assistant keeps a requirement only if a failing test can be written for it, sorts the items into vision, objectives, stories, requirements and non-goals, and writes `US-001` to `US-004` and `REQ-005a` (leveled logs that survive backtracking). Bears on `PRD.md`, Topic 7 and the DSL.
- `E16`: the owner says "post-processing data transformations also need a similar treatment": an algebra "resembling Pandas/Polars methods", "as an IR", with "pipelining, error handling, side-effecting" and "registered functions - but I would not expect custom code". A prompt the owner pasted from another thread asks for a data DSL "not intended for programmers": "No need to be Turing-complete", "No explicit loops (mapping/reducing/etc instead)", "No explicit branching (pattern-matching and user overridable error clauses instead)", "Immutable operations", finite registered operations, "Module support" and "maybe instrumentation/inspection/tracing channels"; its examples include "network streaming telemetry from gNMI, as structured JSON data". The assistant offers JMESPath, jq, Substrait and PRQL as models and writes `REQ-006a` to `REQ-006h` and `REQ-003a` to `REQ-003c`, the registry boundary Topic 4 adopted. Bears on Topics 5, 4 and 8.
- `E22`: the owner accepts the `E21` defaults: "Accept defaults" for the v1 cut (recognition, grain and record output with provenance, one surface syntax, one reference core), "Accept TS/JS" for the reference core with Python second, and "Accept default" for porting existing parsers as acceptance tests, free backtracking (`DEC-COMMIT`) and ordered sequences (`DEC-ORDER`). The product name is "XV2.0 Network Parser". The assistant writes PRD v0.1 and flags a thin product context, a `DEC-SURFACE` item the owner had not seen, and the deferral of the transform tier and template mode. Bears on Topics 1 (which supersedes the acceptance-test default), 4a, 5, 6 and 8.
- `E23`: the owner asks to "Summarize all requirements - one table per category, and rank them per category". The assistant ranks by cost to reverse and by reach; the ranking omits five architecture requirements (the transcript's `ERR-01`), miscounts its rows, and ranks `REQ-008b` first on grounds that Topic 4 reverses. Bears only on `PRD.md`.
- Appendix A, the FRD gap register, covers a different system (config validation against a source of truth, in Neo4j) and sets nothing for this parser. The transcript's Section 4.1 already maps what a consumer of parser output would need from it: coverage per device and cycle, provenance, and absence states.

---

## Topic 4: authoring model

- `E19`: the owner says `.chain` is a rarely used workaround for the BGP key-accumulation problem, that "it provides nice context", and "I don't mind if the DSL language can encode monadic processing structures". The assistant calls this selection from a declared set and resolves `DEC-EXPR` to "selective by default, monadic never". See errors, item 1.
- `E09`: four kinds of parameterization: value, parser, external data, runtime value. The first two are substituted before the IR. The last two are kept out of the DSL because every runtime would need closures and environments, runtime values forfeit static analysis, and external data (an alias table) makes results depend on what was loaded. Claude's reading: with no host code, a continuation is a named parser plus values (defunctionalization), so the IR stays first-order and only parameter frames are needed.
- `E20`: the owner describes the legacy indent-aware `section`. Column is a pure function of index, and a scope parameterized by its own start column changes where it stops, not what is reachable, so static checks survive. Position values must be lexically scoped and never passed through the user-data channel. Also a precomputed line-offset table and a tab policy fixed in the IR. Claude's reading: the argument holds for any value that only decides where a region ends.
- `E12`: the owner reframes primitives as a practically atomic instruction set, including utilities that "set a debug flag". The assistant splits state into transactional (rolls back) and monotonic (never rolls back), puts logs, traces, coverage counters and residual records in the monotonic class so a trace shows failed branches, and limits flags to diagnostics. Origin of `REQ-008b` and `REQ-040`.
- `E13`: ArcSecond's `data` field is user state for parsing decisions; it rolls back with backtracking, so logs written on failed branches vanish.
- `E17`: the owner describes the five record patterns and the legacy `.tag()` and `.map()`. Grain taxonomy: section, line, key-accumulated, child, context-propagated. `context(name, p)` is filldown (TextFSM's `Filldown`): an enclosing value becomes a column on every record in scope, for example the VRF on BGP neighbors or the ACL name on entries. Boundary test: an operation that needs the text's structure belongs to parsing; one that needs only records belongs to data processing. Only `.map` closures fail to port.
- `E18`: `accumulate_by` routes output by a parsed value over a static grammar, which is output, not parse context.
- `E05`, `E07`, `E08`, `E10`: the four absence states; closure is a property of the region read, not of the field (local closed world); residual capture answers the owner's "what is there that you did not expect?"; whether a region was read whole belongs in the result (`GAP-CLOSURE`).
- `E11`: regex is a compressed sub-algebra that adds speed and familiarity, not power. Its dialect is frozen in the IR (RE2-shaped). Its costs: an opaque span, capture groups as a second binding mechanism, tracing stops at the leaf, and no resync position. See errors, items 2 and 3.

---

## Topic 4a: core versus library

- `E04`: the design test. A primitive earns its place if it cannot be composed, or if the core must see it directly for tracing, error recovery or optimization. Demotion candidates: `optional`, `parse_line`, `parse_table`, `separated_by`, whitespace and token helpers. `many` stays core-owned so its progress guard is not reimplemented per runtime.
- `E06`: Parsec's own `Prim` and `Combinator` modules draw the elemental and derived line; `lookAhead` and `notFollowedBy` are derived from `try` plus state save and restore.
- `E12`: an instruction set admits redundancy for speed, ergonomics and tracing, but keeps a derivation map; a runtime may implement a derivable operator natively only if it matches the reference composition. Origin of `REQ-060`.
- `E10`: the settled `P-*` core list and the derived list.
- `E07`: match-first, match-any and match-all are one primitive parameterized by a semiring (Goodman, circa 1999), the same one-primitive-with-a-parameter pattern as the counting primitive in `interview.md`, Topic 4a.
- `E05`: N parsers against N spans in any order is a bipartite assignment problem, not derivable from sequence. The legacy `setOf`, which is `many(oneOf(...))`, shows lines in any order never needed it.
- `E20`: `section`, a region plus a grain boundary in one construct, is the most common authoring act.
- `E11`: regular subtrees may be compiled to a DFA, and any regex expanded into primitives. See errors, item 3.

---

## Topic 5: data processing

- `E16`: the owner's own constraints for the data side; see the charter section above.
- `E17`: the record is the contract between parsing and data processing; a runtime may fuse the two when executing.
- `E07`: merging disagreeing sources is a join on Belnap's knowledge order: associative, commutative, idempotent, with an explicit conflict value. Bears on the Topic 3 question of a unique name appearing twice.
- `E08`: cross-reference validation, range checks and normalization are schema checks done downstream, not parsing.

Old PRD sections for Topic 5, read in thread 6 by a sub-agent (`specs/SPEC.md` line numbers):

- 6.3 (241 to 249): `REQ-050` puts grain in the parser tier (boundary with identity, filldown `context`, same-key fold `accumulate_by`, `child(fk)` sets; 7.5 at 364 to 369); `REQ-051` the compound `section`; `REQ-052` declared record identity with composite keys; `REQ-053` the record as the contract; `REQ-054` the placement test (needs text structure: parser; needs only records: data).
- 6.6 (289 to 301), headed "contract fixed in v1" though only `REQ-006e` is v1: a separate tier with its own IR and conformance (`006a`), a closed operation set (`006b`), errors as values with user error clauses as ordinary operations (`006c`), an identity element per aggregation (`006d`), parsing and transformation as separate staged artifacts that a core may fuse (`006e`), the four absence states (`006f`), ordering per operation (`006g`), named pipelines in modules (`006h`), pattern matching as the branching construct, shared in form with `dispatch` (`006i`). No operation is named: no join, explode, group, dedup or sort.
- 8.3 (435 to 437): `DEC-TCOMPLETE` no recursion in pipelines; `DEC-LAZY` eager evaluation, for log order; `DEC-DOCMODEL` tree operations deferred, as parsers emit flat records.
- A.6 (521): Belnap merge is a join-semilattice with an explicit conflict; A.10 (545): grain cannot always wait for post-processing, since the BGP neighbor case has no delimiter.
- The sub-agent's flags, checked by Claude: `accumulate_by` fails `REQ-054`'s own test unless the fold depends on adjacency, which Topic 4 settled as a parse-side region (`T4-11`, a run of lines sharing a value); no absence state is given for a missing key column; min and max have no identity over an empty set; `006c` does not say whether an error value is present-unparseable; Belnap's four values are not the four absence states, and the conflict value is a separate kernel type (`T4a-03`); pipeline names resolve like parser names, which allow recursion, so a cycle rule is missing; non-recursion guarantees termination only if no operation iterates without bound; `DEC-LAZY` cites parser-tier logs and conflicts with `DEC-STREAM`; `child(fk)` implies joins that are never defined, and a multi-table output, not flat records.

---

## Topic 6: runtime

- `E13`: ArcSecond allocates a state object per step (GC pressure) and indexes bytes, not characters.
- `E20`: line and column come from a line-offset table by binary search; deriving them naively inside `many` is quadratic. Tab policy is fixed in the IR.
- See errors, item 2, for regex engines.

---

## Topic 7: diagnostics

- `E12`: logs and traces are monotonic; `mark(name)` sets trace checkpoints.
- `E13`: errors from alternatives failing at the same position are merged, not last-write-wins (`REQ-042`).
- `E15`: user stories `US-001` to `US-004` (old PRD 3.2), including which sub-parser failed and where, which produced each field, and logs and coverage without re-running.

---

## Topic 8: proof

- `E12`: the derivation map is what cross-runtime conformance tests against.
- `E21`, `E22`: the parity and acceptance-parser decisions, superseded by Topic 1 of the interview.

---

## Errors found in thread 3

1. `E19` (`DL-08`, `SUP-13`): the owner's `.chain` passes a parsed value into the next parser, as in the legacy BGP `header.chain(peer => entries(peer))`, and selecting among declared parsers cannot do that. "Monadic never" contradicted the owner's stated intent. Topic 4 restores it.
2. `E11`: "banning backreferences also eliminates catastrophic backtracking" holds only for automaton engines such as RE2. V8's Irregexp and Python's `re` backtrack, so `(a+)+b` against a long run of `a` takes exponential time. Bounded cost needs a linear-time engine (V8 has one only as an experimental option, and Python has none built in; to verify in Topic 6) or a load-time check that rejects patterns whose automaton is exponentially ambiguous. Pointer: Weideman, van der Merwe, Berglund and Watson on backtracking matching time and NFA ambiguity, circa 2016.
3. `E11`, old PRD A.8 and 7.2: under this engine's ordered choice and possessive repetition (A.2), a regex is not "exactly" sequence, choice and repetition without recursion. `(a|ab)c` matches `abc` and `a*ab` matches `aab` as regexes; the same shapes as combinators match neither. So expanding a regex into primitives, or compiling a combinator subtree to a DFA, needs a translation that preserves meaning, not shape. Translating a backtracking regex into a PEG is possible but uses recursion. Pointer: Medeiros, Mascarenhas and Ierusalimschy, "From regexes to parsing expression grammars", circa 2014. Bears on 4a: whether a regex node can carry a reference composition (`REQ-060`).
4. `E12`: coverage and residual records were made monotonic to serve the trace; as output (`REQ-024`) they must follow the path that was kept. Resolved by the rollback rule in C2.
5. Slips in the transcript's own summaries: `SUP-08` and `SUP-09` place in `E14` corrections made in `E15`, and the turn index gives `E16` the owner's `E17` point that parsers produce flat normalized records.

---

## Pointers for Claude's readings in thread 3

- Defunctionalization: Reynolds, "Definitional interpreters for higher-order programming languages", circa 1972.
- Implicit parameters, dynamic scoping with static types: Lewis, Launchbury, Meijer and Shields, circa 2000.
- Selective applicative functors: Mokhov and others, circa 2019 (already cited in the old PRD).

---

## Old PRD pointers by topic

The old PRD, `specs/SPEC.md`, was distilled from the research thread. It is archive: its claims are ideas and questions, not requirements, and some are wrong (see errors). Sections that bear on each open topic:

| Topic | Sections |
|---|---|
| 4a core versus library | 7 (the primitive set and the derived list), 6.7 (`REQ-060` to `REQ-062`), A.1, A.8 |
| 5 data processing | 6.3 (grain and record, `REQ-050` to `REQ-054`), 6.6 (transform tier, `REQ-006a` to `REQ-006i`), 8.3 (`DEC-TCOMPLETE`, `DEC-LAZY`, `DEC-DOCMODEL`), A.6, A.10 |
| 6 runtime | 5 (architecture), 6.4 (state model, `REQ-040` to `REQ-044`), 8.1 (`DEC-COMMIT`, `DEC-REFCORE`), 8.2 (position model), 8.3 (`DEC-STREAM`), A.9 |
| 7 diagnostics | 3.2 (`US-001` to `US-004`), 6.5 (`REQ-005a`, `REQ-008a`, `REQ-008b`), 8.2 (error and log record shape) |
| 8 proof | 2 (objectives), 6.7 (conformance), 8.2 (conformance suite design), 9 (acceptance; its five parsers were examples, not targets) |
| DSL, after the IR | 6.1 (authoring surface), 4.2 (deferred items, including template mode), 8.3 (`DEC-SURFACE`) |
| The new PRD's framing | 1 (vision), 3.1 (personas), 4.3 (non-goals) |

---

## Context budget sources

Found in thread 3, when the owner asked about the "dumb zone". The design takeaways are in `README.md`, Context budget.

- Chroma, "Context Rot: How Increasing Input Tokens Impacts LLM Performance", July 2025: 18 models, including Claude 4, degrade as input grows, even on simple retrieval and copying; the decline is continuous, not a cliff. https://www.trychroma.com/research/context-rot
- Modarressi and others, "NoLiMa: Long-Context Evaluation Beyond Literal Matching", ICML 2025: when the question and the needle share no words, 11 of 13 models fell to half their short-context score or lower by 32K tokens. https://arxiv.org/abs/2502.05167
- Du and others, "Context Length Alone Hurts LLM Performance Despite Perfect Retrieval", EMNLP Findings 2025: drops of 13.9 to 85 percent from length alone, even with irrelevant tokens replaced by whitespace or masked. https://arxiv.org/abs/2510.05381
- Anthropic, "Effective context engineering for AI agents": context rot and a finite attention budget; recommends compaction, structured notes, sub-agents that return distilled summaries, and loading data just in time. https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- "Dumb zone" is a practitioner term, attributed to Dex Horthy of HumanLayer, for the degraded range, often put at 40 to 60 percent of the window. One survey of the evidence argues the onset is closer to an absolute 32K to 100K tokens than to a percentage. https://agentpatterns.ai/context-engineering/context-window-dumb-zone/
- A single-model study (Qwen2.5-7B) found a collapse at 40 to 50 percent of the maximum context length. https://arxiv.org/abs/2601.15300
