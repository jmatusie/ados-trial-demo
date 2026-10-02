# Legacy code notes

A map of `reference-parser/`, and what the code shows for each later topic, written in thread 2 so later threads can skip rereading it. The legacy system is a source of ideas only; nothing here is a requirement. Line numbers point into the files as of commit `b4c1fbf`. Items marked "Claude's reading" are inferences, not facts from the code.

---

## File map

The files read in thread 2, with the entries that matter.

| File | Holds |
|---|---|
| `Parser_Core.mjs` | The `Parser` class and core combinators: `run` 275, `runLite` 324, `chain` 584, `tag` 675, `tagList` 691, `createParserState` 1346, `mergeParserState` 1519, `getRowStructure` 1627 with its cache at 1600, `getIndentationRange` 1753, `many` 2271, `sequenceOf` 2527, `everythingUntil` 2664, `seqOf` 3199, `oneOf` 3217, `setOf` 3238, `lineOf` 3246, `except` 3338, data channel `getData` 3551, `setData` 3561, `withData` 3621 |
| `Parser_FlexParser.mjs` | Region and navigation parsers: `untilStr` 393, `untilRegExp` 452, `untilEndOfIndentLevel` 508, `until` 588, the `goto*` and `next*` families, position reads (`getIndex`, `getRow`, `getCol`, `getIndentation`) |
| `Parser_Text.mjs` | Character, whitespace and line helpers (`digits`, `letters`, `newline`, `eol`, spaces), plus `parseLine` and `rol` |
| `Parser_Network.mjs` | EOS helpers: `gotoSection` 498, `parseSectionEOS` 569 (to the next `!` line), `parseIndentedSectionEOS` 606 (to the end of the indent level), `interfaceName`, IP address parsers |
| `Object_Flattening.mjs` | `multiplyBy` 492, `multiplyByZ` 499, `flattenItem` and other flattening |
| `high-order-parsers/eos-cfg/get_eoscfg_bgp_peers_v2.mjs` | The clearest composed parser: parameterized peer lines 239 to 267, `bgpPeerIP_header`, `_entries` and `_record` 336 to 369, `bgpVrf_record` 451, post-processing from 469 |
| `high-order-parsers/eos-cfg/get_eoscfg_acls.mjs` | Leftover and sub-parser log reporting through `logEnv` at 233 and 434 |

Not read in thread 2: `Parser_Core.chaged.mjs` (a variant of the core, differences unknown), `Parser_Table.mjs` (column tables, relevant to column geometry), `Parser_Result_Helpers.mjs`, `Pattern_Matching.mjs`, `DataSet_Transformers.mjs`, `ClassIPv4*.mjs`, `classRoutingTable.v3.mjs`.

---

## Topics 3 and 4

The tagging model is summarized in `interview.md`, Topic 3. The sub-parser, context and leftover evidence behind Topic 4, moved here from `interview.md` in thread 3:

- `until` in `Parser_FlexParser.mjs` tries to pass a `parent` context to its sub-parser, but `runLite` ignores the argument and `run` only copies it into the returned state, so no sub-parser ever saw parent context during a parse.
- The high-order parsers pass parsed values only through `chain` closures and never use the `setData` / `getData` data channel.
- VRF names and the device ASN reach BGP peer rows after parsing, in `toPeerRecords`, mainly through `multiplyBy` (explode an array, copying the parent's fields into each row). Peer-group settings reach peers through a join in `resolvePeers`.
- `until` keeps the unparsed tail of a section (`section_text_unparsed`), and most EOS parsers log it through `logEnv` (`PARSER-5-SKIPPED` in the ACL parser). `untilStr` and `lineOf` drop the tail silently: `untilStr` computes the sub-parser's end index and never checks it.
- The comment on `except` says a bounded region is what stops a catch-all line parser from running past its section.
- Found in thread 3: the BGP module is a factory, `get_eoscfg_bgp_peers_v2(deviceName)`. The caller passes the device name, which lands in every row and in `_key_` (`get_eoscfg_bgp_peers_v2.mjs`, lines 126, 491 and 604).

---

## Topic 4a: core versus library

These bear on which operators earn a place as primitives.

- `until(term, sub)` finds the region's end first, then runs `sub` on it. A terminator given as a parser that is not marked "positional" falls back to `everythingUntil`, which tries the terminator at every position; the code calls it "notoriously slow (almost unusable)". The fix was a hand-set `isPositional` flag plus special cases for strings, regexes and indent ends. Claude's reading: scanning to a terminator is a primitive by the performance criterion, because the correct composition was unusable.
- `setOf(...)` is just `many(oneOf(...))`. Lines in any order never needed a dedicated unordered-set operator, which the old PRD reserved (`REQ-035`).
- `except(term, p)`, used as `many(except(term, oneOf(...)))`, is a named form of "not the terminator, then p". It exists because a catch-all needs a stop when there is no bounded region.
- `lineOf` is a hand-optimized one-line parser without `tok` wrappers, made for speed and for less noise in error output.
- `seqOf` and `oneOf` wrap every element in `tok`, which skips spaces and tabs around it. This whitespace-insensitive token sequence is the common idiom for config lines.

---

## Topic 5: data processing

The BGP parser shows a full post-parse pipeline, in order.

| # | Step | Function | Does |
|---|---|---|---|
| 1 | Reshape | `toPeerRecords` | Explodes VRFs into peer rows with `multiplyBy`, spreads `deviceASN` onto each row, injects `vrfName: 'default'` for global peers |
| 2 | Key | `addUniqueKey` | Builds `deviceName:vrfName:peerIP` as `_key_` |
| 3 | Join | `resolvePeers` | Applies peer-group templates to member peers; the peer's own values win |
| 4 | Normalize | `normalizedASNs` | Adds asplain forms of asdot ASNs |

- The ACL parser applies `multiplyBy('aclEntries')` right after its boundary, giving one row per entry with the ACL's fields copied in.
- `multiplyBy` keeps a parent row whose array is empty, and `multiplyByZ` drops it. Parked in `interview.md`.
- Global peers get the named VRF `default` rather than an absence state. Claude's reading: the four absence states would revisit this choice.

Found in thread 6 by a sub-agent that read `DataSet_Transformers.mjs` (DST), `Pattern_Matching.mjs` (PM), `Object_Flattening.mjs` (OF), `Parser_Result_Helpers.mjs` (PRH) and the BGP post-processing (BGP, 469 onward).

- Families: array map, filter, flatMap, flatten, sort, zip and partition (PRH 68 to 129); pipe and compose (PRH 83); object entry map, filter and reduce (DST 187 to 214); column drop, select, add with a default or a computed value, and combine (DST 265 to 731); flatten one level with the parent, the child or the later key winning, with prefixed keys, or recursively (OF 116 to 388, DST 441 to 611); explode (OF 406 to 502); group into buckets and collect (PRH 157 to 215, 722 to 804); primitive set operations by linear `includes` (PM 246); schema discovery and templates (PRH 285 to 345); domain classifiers and ASN conversion (PRH 553, BGP 540). Joins, `groupBy` and dedup are imported from modules not read.
- Explode variants disagree: `multiplyBy` returns the parent unchanged for a missing, non-array or empty field; `multiplyByZ` returns `null`; `multiplyBy_v2` drops the field; `multiplyBy_v2_lossy` returns no rows; `multiplyByND` returns a bare item. A `null` element throws (OF 121).
- `match(v).when(case).do(fn)` or `.return(v)`, first match wins, `.else` terminal, `.continue()` falls through, `.onError` catches (PM 398 to 669). A case is a predicate, an object template matched deeply, an array template with `$skip`, `$find` and `$tail`, or a literal (PM 559, 725, 824). A missing field fails every case.
- Missing values: `==` and `===` checks are mixed; helpers fill `""`, a sentinel string or the string `"0"`; a missing group key lands in a bucket named `"undefined"` (PRH 159); in BGP a missing field becomes the text `"undefined"` inside `_key_` (491), a missing peer-group template leaves the peer silently unresolved (512), two missing ASNs compare equal and give `iBGP` (607), and the device ASN defaults to the text `"really_handle_this"` (470). Claude's reading: each is a case the four absence states exist for.
- Order: spreads let the last key win; `resolvePeers` lets the peer's fields win over the template's, then upserts by `_key_` with later rows winning, emitting in `Map` insertion order (511 to 535); `formatColumns` sets column order by its projection.
- Cost: the `[...acc, kv]` reducer is quadratic per object (DST, OF 305); set operations are O(n times m); `structuredClone` of the whole dataset (DST 274); `multiplyBy` copies the parent twice per element; `arrMatch` copies both arrays at every step and logs each step.
- What the BGP closures do, and so what a closure-free data language must express (469 to 666): path selection with defaults; constant and run-argument columns; parent fields copied onto children; explode and flatten; concatenating tables; composite key templates; partition; a keyed left join with precedence; upsert by key; a conditional derived column (`peerType` from an equality); domain functions (asdot to asplain, falling back to an error value); an ordered projection that also lists leftover keys (`skippedCols`); a not-empty filter.

---

## Topic 6: runtime and memory

Places to examine. The code facts below were checked in thread 2; their memory impact was not measured.

- `getRowStructure` memoizes one record per line (row, start index, indent character and count, length) in a static `Map` keyed by the full text, and nothing clears it except an explicit `clearRowStructureCache()`. The main input and every region text that measures indentation get their own entry, so those strings and their per-line records stay alive. It builds them with `[...text.matchAll(/^([ \t]*)/gm)]`, one match object per line, before reducing them.
- `mergeParserState` appends logs as `[...fromState.dataLog, ...dataLog]`, copying the whole log on every append, which grows quadratically.
- `run` normalizes CRLF with `replaceAll`, which may copy the whole input.
- Sub-parsers run on `slice`s of the input, and `untilStr`, `untilRegExp` and `lineOf` slice the whole remaining input on each call. Their memory impact is still to measure; by V8's design (noted in thread 4), a slice of 13 or more characters is a view that pins its parent and a shorter one is a copy, while Python slices always copy.
- Every step returns a new state object, and error messages are formatted eagerly on failure, which is frequent under backtracking.

---

## Topic 7: diagnostics

The legacy practice, for comparison when diagnostics are designed.

- Log lines follow a syslog-like `PARSER-<severity>-<MNEMONIC>` convention with the device and module name in brackets, for example `PARSER-5-SKIPPED` and `PARSER-5-SUBPARSER`.
- Sub-parser logs had to be pulled up by hand with `.logEnv(...)`, and their positions stayed relative to the region.
- Catch-all line parsers report unrecognized lines through `.logResult(...)`, for example `peer_unknown` in the BGP parser.
- Tracing is global and all or nothing: `constructor_w_tracing` wraps every parser and records each step with timings into `Parser.traceLog`, and the code warns it may be very slow. `Parser._tracing` gates extra log lines.
- Errors carry an `errorPath` of records (parser name, error, index), and `seqOf` and `oneOf` rewrite messages with `mapError_fullHistory`.
