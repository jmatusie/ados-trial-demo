# D-001: The six Section 8.3 open questions resolve to the specification's own recommendations

- Status: Accepted
- Date: 2026-09-22
- Decided by: the owner, in the conversion thread
- Task: T-000

## Question

`specs/SPEC.md` Section 8.3 carries six `DEC-OPEN` items for a refinement pass. Section 0.3 forbids resolving one silently, and the handoff prompt asks for a refinement report resolving all six. Under the previous governance these became a single blocking task of kind `decision` that no session could close, which is one reason no build work ever started.

What had to be decided is whether these are the owner's calls or the document's.

## Resolution

They are the document's. Each already carries a recommendation with its reasoning, and Section 4.1 had already fixed the one that looked most consequential. All six are accepted as written.

| ID | Resolution | The specification's reasoning |
|----|-----------|-------------------------------|
| `DEC-SURFACE` | Expression form in v1 | Expression form is total, templates are partial sugar, and the migration source is combinator-shaped. Already fixed by Section 4.1 |
| `DEC-STREAM` | Whole-input | Simplicity now, option preserved. Unbounded lookahead is the only construct that would preclude streaming later and is flagged in the IR |
| `DEC-TCOMPLETE` | No recursion in named pipelines | Termination guarantee for production. Parser-tier `P-REF` recursion is separate and still permitted |
| `DEC-LAZY` | Eager evaluation in the transform tier | Log ordering determinism, `REQ-005a` |
| `DEC-DOCMODEL` | Defer the question with the tier | Parsers emit flat records, so tree operations are needed only for gNMI JSON input, which is `[deferred]` |
| `DEC-UNA` | State as downstream non-goal `NG-003` | Identity resolution requires knowledge outside this system |

## Consequences

Milestone 2 reserves an IR slot for unbounded lookahead and flags it, so the streaming option survives. Milestone 3 builds the expression surface only; template mode remains a post-v1 front-end desugaring with zero IR change, per Section 4.2.

Nothing here reopens a `DEC-CLOSED` item and nothing extends scope into an `NG` entry.

## Rules out

- Building template-mode authoring in v1.
- Designing the IR in a way that assumes whole-input access without flagging it.
- Treating entity identity resolution as in scope.

## Amendments

(An accepted decision changes only by a dated line here: `- Amended: YYYY-MM-DD -- what and why`.)
