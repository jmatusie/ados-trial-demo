# Queue

The top `todo` row under `## Now` is what `/next` takes. Order is priority: to change what happens next, move a row up. Anyone may add a row.

Effort is the reasoning level to set before running the task: `low`, `medium`, `high`, `xhigh`, `max`.

## Now

| ID | Status | Effort | Task |
|---|---|---|---|
| T-002 | todo | max | Portable IR: a node for every Section 7 primitive, with reserved slots for each `[deferred]` item (milestone 2) |
| T-003 | todo | max | Expression surface that compiles to the IR (milestone 3, REQ-002a REQ-002b REQ-003a to REQ-003c REQ-036) |
| T-004 | todo | xhigh | Reference core: state model with monotonic and transactional partitions, executing the IR (milestone 4, REQ-040 to REQ-044) |
| T-005 | todo | high | Spike: determine whether `reference-parser/` can be run headlessly to produce golden record sets. Report findings only, build nothing |
| T-006 | todo | xhigh | Conformance suite and derivation map assertions (milestone 5, ACC-006, REQ-016, REQ-060) |
| T-007 | todo | high | Attempted-path trace for a failing parse, and coverage record for unmodeled lines (ACC-007, ACC-008) |
| T-008 | todo | high | Frozen regex dialect producing identical output on the reference core (ACC-009) |
| T-009 | blocked | xhigh | VLAN parser reproducing its golden record set (milestone 7, ACC-001). Blocked: needs sanitized device output in `samples/` from the owner, and the outcome of T-005 |
| T-010 | blocked | xhigh | Remaining four acceptance parsers: interface with NAT and IGMP child record sets, BGP neighbor global and VRF, ACL entry, route-map entry (milestone 8, ACC-002 to ACC-005). Blocked on the same samples as T-009 |

## Done

| ID | Date | Task |
|---|---|---|
| T-000 | 2026-09-22 | Replace ADOS governance with the Solo Loop profile, move the PRD into `specs/`, and stand up the TypeScript toolchain so a verification oracle exists from the first commit |
| T-001 | 2026-09-22 | Record contract: record type with span provenance, declared key columns and four-state absence, fixing the tier boundary (milestone 1) |
