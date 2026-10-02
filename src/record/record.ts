import { CELL_KINDS, scalarMatches, type Cell } from "./cell.js";
import { issue, joinPath, throwIfAny, underPath, type Issue } from "./issues.js";
import { checkRecordType, columnType, type RecordType } from "./schema.js";
import { checkSpan, checkSpanList, normalizeSpans, type Span } from "./span.js";

// The record: the contract between the parser tier and everything downstream (REQ-053).

// Region-completeness (REQ-021): whether the producing parser consumed a whole delimited region or a fragment of one.
// It decides whether absence in the record is negative information (A.5, local closed world).
export const REGIONS = ["whole", "fragment"] as const;
export type Region = (typeof REGIONS)[number];

export interface Provenance {
  readonly spans: readonly Span[];
  readonly region: Region;
}

export interface ParsedRecord {
  readonly type: string;
  readonly cells: Readonly<Record<string, Cell>>;
  readonly provenance: Provenance;
}

// A record set is ordered (DEC-ORDER) and holds one record per identity.
export interface RecordSet {
  readonly type: RecordType;
  readonly records: readonly ParsedRecord[];
}

// What one parse hands the next tier: its record sets, parents and children together.
export interface ParseOutput {
  readonly recordSets: readonly RecordSet[];
}

// A key cell must say who the entity is. Present does; inapplicable does too, as a determinate marker (a column of the key that this entity has no value for).
// Unknown, expected-absent and present-unparseable leave identity undetermined, so they are refused in key columns.
const KEY_KINDS: readonly string[] = ["present", "inapplicable"];

function checkCell(cell: unknown, type: RecordType, column: string, region: unknown, path: string): Issue[] {
  if (typeof cell !== "object" || cell === null || !CELL_KINDS.includes((cell as Cell).kind)) {
    return [issue("bad-cell", path, "a cell is a present value or one of the four absence states, never null")];
  }
  const c = cell as Cell;
  const issues: Issue[] = [];
  const colType = columnType(type, column)!;
  if (c.kind === "present") {
    if (!scalarMatches(colType, c.value)) issues.push(issue("value-type", path, `value ${JSON.stringify(c.value)} is not ${colType}`));
    issues.push(...checkSpanList(c.spans, joinPath(path, "spans")));
  }
  if (c.kind === "present-unparseable") {
    if (typeof c.raw !== "string") issues.push(issue("bad-cell", path, "present-unparseable carries its raw text"));
    issues.push(...checkSpanList(c.spans, joinPath(path, "spans")));
  }
  if (type.key.includes(column) && !KEY_KINDS.includes(c.kind)) {
    issues.push(issue("indeterminate-key", path, `key column ${column} is ${c.kind}, so the record has no determinate identity`));
  }
  if (c.kind === "expected-absent" && region === "fragment") {
    issues.push(issue("closed-world-in-fragment", path, "expected-absent needs a whole region; in a fragment, absence is unknown"));
  }
  return issues;
}

export function checkRecord(type: RecordType, record: ParsedRecord, path = ""): Issue[] {
  const issues: Issue[] = [];
  if (record.type !== type.name) issues.push(issue("type-mismatch", path, `record is ${record.type}, expected ${type.name}`));

  const region = record.provenance?.region;
  const cells = (record.cells ?? {}) as Record<string, unknown>;
  for (const col of type.columns) {
    const at = joinPath(path, `cells.${col.name}`);
    if (!Object.hasOwn(cells, col.name)) issues.push(issue("missing-cell", at, `column ${col.name} has no cell; absence must be stated`));
    else issues.push(...checkCell(cells[col.name], type, col.name, region, at));
  }
  for (const name of Object.keys(cells)) {
    if (columnType(type, name) === undefined) {
      issues.push(issue("undeclared-column", joinPath(path, `cells.${name}`), `column ${name} is not declared by ${type.name}`));
    }
  }

  const prov = joinPath(path, "provenance");
  if (!(REGIONS as readonly unknown[]).includes(region)) issues.push(issue("bad-region", joinPath(prov, "region"), "region is whole or fragment"));
  const spans = record.provenance?.spans;
  if (!Array.isArray(spans) || spans.length === 0) {
    issues.push(issue("no-provenance", joinPath(prov, "spans"), "every record names the input that produced it"));
  } else {
    issues.push(...checkSpanList(spans, joinPath(prov, "spans")));
  }
  return issues;
}

// Hand-built cells may carry spans out of normal form; fix that here so only real violations reach the check.
function normalizeCell(cell: Cell): Cell {
  if (typeof cell !== "object" || cell === null || !("spans" in cell) || !Array.isArray(cell.spans)) return cell;
  if (cell.spans.some((s) => checkSpan(s).length > 0)) return cell;
  return Object.freeze({ ...cell, spans: normalizeSpans(cell.spans) });
}

export function makeRecord(
  type: RecordType,
  cells: Readonly<Record<string, Cell>>,
  provenance: { readonly spans: readonly Span[]; readonly region: Region },
): ParsedRecord {
  const ordered: [string, Cell][] = [];
  for (const col of type.columns) if (Object.hasOwn(cells, col.name)) ordered.push([col.name, normalizeCell(cells[col.name]!)]);
  for (const [name, cell] of Object.entries(cells)) if (columnType(type, name) === undefined) ordered.push([name, cell]);

  const spans = Array.isArray(provenance.spans) && provenance.spans.every((s) => checkSpan(s).length === 0)
    ? normalizeSpans(provenance.spans)
    : provenance.spans;
  const record: ParsedRecord = {
    type: type.name,
    cells: Object.freeze(Object.fromEntries(ordered)),
    provenance: Object.freeze({ spans, region: provenance.region }),
  };
  throwIfAny(checkRecord(type, record));
  return Object.freeze(record);
}

// Identity as a comparable string: the key cells in declared order, a present value tagged so text "1" and integer 1 differ.
export function tupleOf(record: ParsedRecord, columns: readonly string[]): string {
  return JSON.stringify(
    columns.map((c) => {
      const cell = record.cells[c]!;
      return cell.kind === "present" ? { v: cell.value } : { absent: cell.kind };
    }),
  );
}

export const keyOf = (type: RecordType, record: ParsedRecord): string => tupleOf(record, type.key);

export function checkRecordSet(set: RecordSet, path = ""): Issue[] {
  const issues: Issue[] = [];
  const seen = new Map<string, number>();
  set.records.forEach((r, i) => {
    const at = joinPath(path, `records[${i}]`);
    const own = checkRecord(set.type, r, at);
    issues.push(...own);
    if (own.length > 0) return;
    const k = keyOf(set.type, r);
    const first = seen.get(k);
    if (first !== undefined) issues.push(issue("duplicate-key", at, `same identity as records[${first}]; same-key matches fold into one record`));
    else seen.set(k, i);
  });
  return issues;
}

export function checkParseOutput(output: ParseOutput): Issue[] {
  const issues: Issue[] = [];
  const byName = new Map<string, RecordSet>();
  output.recordSets.forEach((set, i) => {
    const at = `recordSets[${i}]`;
    const typeIssues = underPath(`${at}.type`, checkRecordType(set.type));
    issues.push(...typeIssues);
    if (typeIssues.length > 0) return;
    if (byName.has(set.type.name)) {
      issues.push(issue("duplicate-record-set", at, `a second record set of type ${set.type.name}`));
      return;
    }
    byName.set(set.type.name, set);
    issues.push(...checkRecordSet(set, at));
  });

  output.recordSets.forEach((set, i) => {
    const link = set.type.parent;
    if (link === undefined || byName.get(set.type.name) !== set) return;
    const at = `recordSets[${i}]`;
    const parent = byName.get(link.type);
    if (parent === undefined) {
      issues.push(issue("missing-parent-set", at, `child set ${set.type.name} has no ${link.type} record set in this output`));
      return;
    }
    const shapeOk =
      link.foreignKey.length === parent.type.key.length &&
      link.foreignKey.every((fk, j) => columnType(set.type, fk) === columnType(parent.type, parent.type.key[j]!));
    if (!shapeOk) {
      issues.push(issue("foreign-key-shape", `${at}.type.parent`, `foreign key does not match the key of ${link.type} in arity and column types`));
      return;
    }
    const parentKeys = new Set(parent.records.map((r) => keyOf(parent.type, r)));
    set.records.forEach((r, j) => {
      if (checkRecord(set.type, r).length > 0) return;
      if (!parentKeys.has(tupleOf(r, link.foreignKey))) {
        issues.push(issue("orphan-child", `${at}.records[${j}]`, `foreign key names no ${link.type} record`));
      }
    });
  });
  return issues;
}
