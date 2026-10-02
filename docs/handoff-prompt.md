# XV2.0 Network Parser -- Agent Handoff Prompt

Use this as the opening prompt in the AI development environment. Attach `xv2-network-parser-prd.md`.

---

## For the refinement agent (second pair of eyes)

You are reviewing a Product Requirements Document before a planning agent makes implementation decisions. Read Section 0 of the attached PRD first; it defines the identifier scheme and the rules you must follow.

Your job is to produce a refinement report, not a redesign. The report has exactly four parts:

1. Resolutions for every `DEC-OPEN` in Section 8.3. For each, state accept-recommendation or propose-alternative, with reasoning. Do not leave any unresolved.
2. Challenges to any `REQ` you believe is wrong, unbuildable, or in conflict with another `REQ`. For each challenge, cite the Appendix A section that grounds the requirement and explain why the grounding does not hold. A challenge that does not engage the grounding will be discarded.
3. Newly discovered gaps, each stated as a proposed `DEC-OPEN` with a recommendation. Do not resolve them yourself.
4. Anything in Sections 1 to 3 (`VIS`, `OBJ`, `US`) that you were tempted to turn into a requirement. List it and state why you did not.

Constraints:

- Do not derive requirements from vision, objectives, or user stories.
- Do not reopen a `DEC-CLOSED` without flagging it explicitly as a reopen request with a reason.
- Do not extend scope into any `NG` item.
- Treat `[deferred]` items as binding constraints on IR shape even though they are not built.

---

## For the planning agent

Read Section 0, then Sections 4, 5, 6, 7, and 8 in that order. Appendix A is the rationale for anything that looks over-specified.

Your plan must:

- Build exactly the v1 scope in Section 4.1. Every `[deferred]` item must have a reserved place in the IR and a note on how it slots in later without breaking existing definitions.
- Make the design-phase decisions listed in Section 8.2 within their stated constraints, and record each decision with its rationale.
- Treat Section 9 as the definition of done. The five acceptance parsers are golden tests; obtain their expected outputs from the existing JS system before writing the reference core.
- Keep every primitive in Section 7 at the uniform state-in, state-out signature (`REQ-044`). If you rename a primitive, carry its derivation forward (`REQ-060`).
- Produce the conformance suite alongside the reference core, not after it.

If you find yourself needing a decision the document does not make, stop and raise it as a `DEC-OPEN` rather than deciding inline.
