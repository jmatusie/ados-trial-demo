# D-002: The record contract, version xv2.record/1

- Status: Accepted
- Date: 2026-09-22
- Decided by: the build process, as engineering choices within Section 8.2
- Task: T-001

## Question

Milestone 1 fixes the record: the type that crosses the tier boundary (REQ-053), with declared identity (REQ-052), four-state absence (REQ-020), span provenance and region-completeness (REQ-021), and a within-parse fold (REQ-023a). Section 8.2 delegates the type system to design under stated constraints. This records the shape chosen and why, so later milestones build on it rather than re-derive it.

## Resolution

The code is `src/record/`. Each choice below is an engineering choice, not a domain fact.

| # | Choice | Why |
|---|---|---|
| 1 | Column values are scalars from a registered set: `text`, `integer` (safe integers, no -0), `boolean` | Section 8.2 asks for a finite registered set. Multi-valued attributes are child record sets per REQ-050 and US-006, so no list cell is needed. Adding a scalar kind later is additive |
| 2 | A cell is one of five kinds: `present` or one of the four absence states. Every declared column always has a cell. `simpleValue` gives the simple surface view without altering the cell | REQ-020 forbids collapsing absence to one null, and makes the simple view a presentation only |
| 3 | `present` and `present-unparseable` cells carry their own spans, possibly empty, in addition to the record's spans | The deferred cross-source merge (REQ-023b) must be able to say where each side of a conflict came from. Reserving this now avoids a contract change later (Section 4.2) |
| 4 | A span is a source name, a half-open byte range, and 1-based inclusive lines. Span lists are kept in a normal form: sorted, with overlapping or touching spans of one source coalesced | REQ-021 names lines and byte ranges. The source name is what makes a record mergeable across parses later. Normal form makes provenance equality structural |
| 5 | Strings sort by Unicode code point, never by UTF-16 code unit | REQ-061: ordering must not vary by host. JavaScript and Python disagree on string order otherwise |
| 6 | A key column must be `present` or `inapplicable`. Keys are compared as typed tuples, so text `1` and integer `1` differ. A record set holds one record per key | REQ-052 declares identity. Unknown or unparseable key cells leave identity undetermined. Allowing `inapplicable` lets a composite key have a part that does not apply to some entities without deciding that domain question here (see Left open) |
| 7 | `expected-absent` is refused in a record whose region is `fragment` | Appendix A.5: absence is negative information only where the parser consumed the whole region. In a fragment the honest state is `unknown` |
| 8 | The fold treats cells as a flat knowledge order: `unknown` yields to anything, a fact joined with itself is itself with spans unioned, and two different facts are a conflict returned to the caller, never a silent winner. A fold is `whole` if any part was whole | This is associative, commutative and idempotent, which is what REQ-023b needs (A.6), so the deferred join extends it rather than replaces it. Invariant 7 survives every fold |
| 9 | A child record type names foreign key columns that match its parent's key positionally and by column type. A parse output is refused if a child names no parent record | REQ-050 and Section 7.5 `child(fk, p)` emit children keyed by the enclosing record. This is a structural check on one parse output, not the cross-reference validation excluded by NG-001 |
| 10 | One canonical serialized form, `xv2.record/1`, documented in `src/record/encoding.ts` and pinned byte for byte by a test. Encoding and decoding both run the full contract check | The conformance suite is golden-output based (Section 8.2), and every core must produce the same bytes for the same records |

## Left open

These are domain questions that the contract admits either way. They will be settled with the owner when the parser that needs them is built, not here.

- Whether a global BGP neighbor's VRF key column is a named default VRF or `inapplicable` (T-010, US-007).
- Whether identifiers such as a VLAN ID are integers or text in the golden record sets (T-009, depends on T-005).
- What a within-parse conflict does to the parse: fail it, log it, or keep the first. The contract returns the conflict; the core decides (T-004).

## Rules out

- A bare null anywhere in a record.
- Records whose identity is inferred rather than declared.
- Host string ordering, host number formatting, or host JSON escaping leaking into the serialized form.

## Amendments

(An accepted decision changes only by a dated line here: `- Amended: YYYY-MM-DD -- what and why`.)
