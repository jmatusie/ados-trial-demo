# Transcript -- thread 6

The visible conversation of design thread 6, appended before every push and never read at start. Headings inside a message are demoted two levels so they nest under the message heading; the text is otherwise verbatim.

---

## [1] Owner

Design interview, not a build. Read `CLAUDE.md`, design/README.md and `design/interview.md`, nothing else, then continue from the next action. You lead; I'm the domain expert. Commit and push design/ updates directly to main.

One correction first. In thread 5 (`transcript-5.md`, message [3]) I wrote "initialize it with ados". I meant ados, my scaffolding system in jmatusie/ados, not ADRs.  The plan: finish groups G2 to G6 (Topics 5 to 9) here, by proxy, as now. Then I start a fresh repository with ados's Solo Loop 3, which carries `design/` over and writes the PRD there, so Topic 10 (G7) happens in the new repository, not here. Record this correction in interview.md, keep `decisions.md` in its current format, and then continue with G2.

---

## [2] Claude

### G2 -- Topic 5 decided by proxy

The ados correction is recorded in `interview.md` (header and status table), with matching one-line fixes in `README.md` and `decisions.md`. `decisions.md` keeps its format. Topic 10 is marked as happening in the new repository.

G2 went out in four pushes to `main`. Each record in `decisions.md`, G2, lists its alternatives, what it rests on, what would reopen it and its reversal cost.

---

#### Decisions

These are the fifteen decisions, in the order they were made.

| ID | Decision |
|---|---|
| `T5-01` | Data steps are pure functions over values, in the same IR as parsers, applied through `transform` |
| `T5-02` | A pipeline may run on caller-supplied values, such as gNMI JSON, through one pinned host mapping |
| `T5-03` | Data kernel of 6 (`const`, `get`, `build`, `fold`, `match`, `call`); 8 required natives; the rest is library |
| `T5-04` | Data steps may only write logs; external data comes in only as run arguments |
| `T5-05` | Absence is strict, with a precedence order; Kleene logic for booleans; functions apply to each candidate of a conflict |
| `T5-06` | `filter` drops rows where the test is absent, and counts them; aggregates are strict; min and max of an empty list are inapplicable |
| `T5-07` | Errors are present-unparseable with a reason code, never exceptions |
| `T5-08` | Order is always kept; one pinned sort order; integers and decimals are exact |
| `T5-09` | Provenance travels with values through every data step |
| `T5-10` | VRF-onto-peer context is a nested record plus `explode`; the parse side has no filldown |
| `T5-11` | `explode` keeps a row for an empty list (child fields inapplicable) and for an absent list (child fields take the list's state) |
| `T5-12` | `lookup` for references, `join` for relational joins; merge policies, including `overlay` for inheritance |
| `T5-13` | Named pipelines cannot recurse; `match` is the only branching, and must be exhaustive |
| `T5-14` | The spec defines meaning eagerly; a runtime may stream and fuse steps if the results are the same |
| `T5-15` | Absence has its own host type (never null); pinned JSON form (`$absent`, `$conflict`); CSV is a library encoder |

> Net effect: the legacy BGP post-processing can be written with no closures. A spike for the plan tests exactly that.

---

#### Worth a veto look

These three decisions are the ones you are most likely to disagree with.

- `T5-01`: data steps are functions, not parsers over data. "Everything is a parser" still holds when parsers are composed, not inside a data step.
- `T5-06`: `filter` works like SQL (drop and count), but aggregates are strict: one unparseable counter makes a sum absent.
- `T5-10`: filldown exists only as possible DSL sugar, never as a parse-side operator.

---

#### One domain question

`Q5-01`: `overlay` lets a peer's own setting win over its peer group's, and falls back to the group only when the peer's value is expected-absent or inapplicable. Does EOS have lines, such as `no ...` or `default ...` under a neighbor, that must block the group's value instead of falling back to it? If you are unsure, I recommend modelling such a line as a present value, which blocks inheritance under the rule as written.

---

#### Next

I am stopping here so you can veto. Start G3 (Topic 6, runtime) in a new thread with the usual opening message; `interview.md`'s next action applies any veto or answer to `Q5-01` first.

---

## [3] Owner

Where can I find the decision records in the repo for the above decisions?

---

## [4] Claude

### Where the G2 decision records are

The full records are in `design/decisions.md`, section G2, on `main` (latest commit `a2bb998`). Each record has its status, the decision, the alternatives, what it rests on, what would reopen it, and its reversal cost.

---

#### Records in `design/decisions.md`

Each set is listed with the line where its records start.

| Set | Records | Starts at |
|---|---|---|
| G2 header | Scope and evidence pointers | `design/decisions.md:118` |
| 1. Form and boundary | `T5-01` to `T5-04` | `design/decisions.md:122` |
| 2. Values in data steps | `T5-05` to `T5-09` | `design/decisions.md:160` |
| 3. Reshaping | `T5-10` to `T5-12` | `design/decisions.md:207` |
| 4. Pipelines and execution | `T5-13` to `T5-15` | `design/decisions.md:236` |
| Raised for later topics, and spikes | Follow-ups for Topics 6 to 8 and G6 | `design/decisions.md:265` |

---

#### Other places that carry them

`interview.md` has one line per decision; `decisions.md` has the full record.

- `design/interview.md:124`: the Topic 5 section, with one line for each of `T5-01` to `T5-15`.
- `design/interview.md:146`: the open domain question `Q5-01`.
- `design/interview.md:23`: the next action, which applies your veto or answer before G3 starts.
- `design/transcript-6.md`: this thread's conversation, including the report I sent you.
- `design/legacy-notes.md` and `design/research-notes.md`, Topic 5 sections: the evidence gathered this thread.

> To veto a decision, name its ID. A veto replaces that record with a new ID and reopens every decision that lists it under "Rests on".

---

## [5] Owner

I know I asked to make decisions,  and document them as if I was making them. (And allowing you to be a proxy), but when I actually have to review them -. The format of the decision records are horrible. 

I'm sure the information content is good -. They could just benefit from improved formatting.

I'd like to understand what the question was, the significance of the question,. What options are,. The significance of the choices, and then what your choice was with rationalization.  

I'm not asking you to rewrite please, but moving forward that would be nice if you could present them.  Alternatively, if there is benefit in using an agent skill and maybe a python script to write out the questions in Json or yaml, then you could benefit from a structured writing of the output using a skill, and I could benefit from reading as a formatted rendered artifact to be generated on demand.  Just an idea.

---

## [6] Claude

### Decision record format -- agreed

From G3 on, every record follows the five parts you asked for, in `decisions.md` and in the end-of-group report. G1 and G2 stay as they are.

---

#### The new layout

Each record answers these, in order.

| # | Part | Answers |
|---|---|---|
| 1 | Question | What is being decided, in one line |
| 2 | Why it matters | What depends on it, and what goes wrong if it is decided badly, with an example |
| 3 | Options | A table: what each option means, and what choosing it commits you to |
| 4 | Choice | Which option, and why, tied to your priorities or earlier decisions |
| 5 | Register | Status, rests on, revisit if, reversal cost: the veto mechanism, kept as a short footer |

I added this to `design/README.md` (the interview rules, with a template) and a one-line pointer in `decisions.md`, so the next thread follows it without being told.

You said earlier to keep `decisions.md` in its current format. I read that as "don't turn it into ADRs", so the new records go in the same file with the new layout. Tell me if you meant otherwise.

---

#### The YAML idea

I recommend not building it in this repository, and building it in the new one if ados has no decision format of its own.

- It is code, and `CLAUDE.md` keeps this repository design-only unless you ask.
- Only G3 to G6 remain here. The template gets you the readable structure now at no cost.
- ados's Solo Loop 3 sets up the new repository's tooling, and a schema and renderer would have to fit its conventions anyway. Moving the Markdown records to YAML there is mechanical, since every record will have the same five parts.
- Rendering on demand needs no script in the meantime: I can publish any group as a formatted artifact page when you want to review it.

> Net effect: readable records from G3 on, with no tooling here. The structured source and renderer wait for the new repository, where ados decides the conventions.

If you want to review G2 that way now, I can render it as an artifact page in the new layout without touching the repository.
