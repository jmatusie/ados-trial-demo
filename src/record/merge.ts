import { present, unparseable, type Cell } from "./cell.js";
import { issue, throwIfAny } from "./issues.js";
import { checkRecord, keyOf, makeRecord, type ParsedRecord } from "./record.js";
import type { RecordType } from "./schema.js";

// The within-parse fold of REQ-023a, with REQ-020 deciding what absence means.
//
// Cells form a flat knowledge order: unknown carries no information and sits below everything; every other cell is a distinct, maximal fact.
// Joining unknown with anything yields the other; joining a fact with itself yields it (spans unioned); joining two different facts is a conflict.
// That join is associative, commutative and idempotent, which is exactly what the deferred cross-source merge needs (REQ-023b, A.6).
// v1 reports the conflict to the caller instead of storing a conflict state, so adding that state later extends this merge rather than changing it.

export type CellMerge = { readonly ok: true; readonly cell: Cell } | { readonly ok: false };

export function mergeCells(a: Cell, b: Cell): CellMerge {
  if (a.kind === "unknown") return { ok: true, cell: b };
  if (b.kind === "unknown") return { ok: true, cell: a };
  if (a.kind !== b.kind) return { ok: false };
  if (a.kind === "present" && b.kind === "present") {
    return a.value === b.value ? { ok: true, cell: present(a.value, [...a.spans, ...b.spans]) } : { ok: false };
  }
  if (a.kind === "present-unparseable" && b.kind === "present-unparseable") {
    return a.raw === b.raw ? { ok: true, cell: unparseable(a.raw, [...a.spans, ...b.spans]) } : { ok: false };
  }
  return { ok: true, cell: a };
}

export interface Conflict {
  readonly column: string;
  readonly a: Cell;
  readonly b: Cell;
}

export type RecordMerge =
  | { readonly ok: true; readonly record: ParsedRecord }
  | { readonly ok: false; readonly conflicts: readonly Conflict[] };

// Folds two records of one identity. The fold is whole if any part consumed a whole region: that part licenses the closed-world claims it carries,
// and a fragment that contradicts one surfaces as a conflict rather than silently overriding it.
export function mergeRecords(type: RecordType, a: ParsedRecord, b: ParsedRecord): RecordMerge {
  throwIfAny([...checkRecord(type, a, "a"), ...checkRecord(type, b, "b")]);
  if (keyOf(type, a) !== keyOf(type, b)) {
    throwIfAny([issue("key-mismatch", "", "only records with one identity fold together")]);
  }
  const cells: Record<string, Cell> = {};
  const conflicts: Conflict[] = [];
  for (const { name } of type.columns) {
    const ca = a.cells[name]!;
    const cb = b.cells[name]!;
    const m = mergeCells(ca, cb);
    if (m.ok) cells[name] = m.cell;
    else conflicts.push({ column: name, a: ca, b: cb });
  }
  if (conflicts.length > 0) return { ok: false, conflicts };
  const region = a.provenance.region === "whole" || b.provenance.region === "whole" ? "whole" : "fragment";
  return {
    ok: true,
    record: makeRecord(type, cells, { spans: [...a.provenance.spans, ...b.provenance.spans], region }),
  };
}
