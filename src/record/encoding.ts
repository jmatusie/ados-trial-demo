import { expectedAbsent, inapplicable, present, unknown, unparseable, type Cell, type Scalar, type ScalarType } from "./cell.js";
import { RecordContractError, issue, throwIfAny } from "./issues.js";
import { checkParseOutput, makeRecord, type ParseOutput, type ParsedRecord, type Region } from "./record.js";
import { defineRecordType, type ColumnDef, type RecordType } from "./schema.js";
import type { Span } from "./span.js";

// The canonical serialized form of a parse output. It is what crosses the tier boundary and what golden files and other cores are compared against (REQ-053, REQ-061).
//
// Form, fixed for contract version xv2.record/1:
// - UTF-8 JSON with no insignificant whitespace. Object members appear in the order written below; arrays keep their order.
// - Strings escape only `"`, `\`, and U+0000 to U+001F (as \b \f \n \r \t or \u00XX, lowercase hex); lone surrogates as \udXXX; everything else literal.
// - Integers are written as plain decimal digits, safe integers only, no -0.
// - Cells follow the declared column order of their record type. Spans are in normal form (see span.ts) and encode as [source, start, end, startLine, endLine].
//
// {"contract":"xv2.record/1","recordSets":[{"type":{"name":..,"columns":[[name,type],..],"key":[..],"parent":{"type":..,"foreignKey":[..]}},
//   "records":[{"cells":[[column,cell],..],"provenance":{"region":..,"spans":[..]}}]}]}
//
// A cell is {"kind":"present","value":v,"spans":[..]}, {"kind":"present-unparseable","raw":s,"spans":[..]}, or {"kind":k} for the other three absence states.
// "parent" is written only for a child record type.

export const RECORD_CONTRACT_VERSION = "xv2.record/1";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const encodeSpans = (spans: readonly Span[]): Json => spans.map((s) => [s.source, s.start, s.end, s.startLine, s.endLine]);

function encodeCell(cell: Cell): Json {
  switch (cell.kind) {
    case "present":
      return { kind: cell.kind, value: cell.value, spans: encodeSpans(cell.spans) };
    case "present-unparseable":
      return { kind: cell.kind, raw: cell.raw, spans: encodeSpans(cell.spans) };
    default:
      return { kind: cell.kind };
  }
}

function encodeType(type: RecordType): Json {
  const out: { [k: string]: Json } = {
    name: type.name,
    columns: type.columns.map((c) => [c.name, c.type]),
    key: [...type.key],
  };
  if (type.parent !== undefined) out.parent = { type: type.parent.type, foreignKey: [...type.parent.foreignKey] };
  return out;
}

const encodeRecord = (type: RecordType, r: ParsedRecord): Json => ({
  cells: type.columns.map((c) => [c.name, encodeCell(r.cells[c.name]!)]),
  provenance: { region: r.provenance.region, spans: encodeSpans(r.provenance.spans) },
});

export function encodeParseOutput(output: ParseOutput): string {
  throwIfAny(checkParseOutput(output));
  return JSON.stringify({
    contract: RECORD_CONTRACT_VERSION,
    recordSets: output.recordSets.map((set) => ({
      type: encodeType(set.type),
      records: set.records.map((r) => encodeRecord(set.type, r)),
    })),
  });
}

// Decoding is strict: a shape error throws `malformed`, and the decoded output must then pass the same contract check an encoder applies.

class Malformed extends Error {}

const fail = (what: string): never => {
  throw new Malformed(what);
};
const obj = (v: unknown, what: string): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : fail(`${what} is not an object`);
const arr = (v: unknown, what: string): unknown[] => (Array.isArray(v) ? v : fail(`${what} is not an array`));
const str = (v: unknown, what: string): string => (typeof v === "string" ? v : fail(`${what} is not a string`));
const num = (v: unknown, what: string): number => (typeof v === "number" ? v : fail(`${what} is not a number`));

function decodeSpans(v: unknown, what: string): Span[] {
  return arr(v, what).map((s, i) => {
    const t = arr(s, `${what}[${i}]`);
    if (t.length !== 5) fail(`${what}[${i}] is not a five-element span`);
    return {
      source: str(t[0], `${what}[${i}].source`),
      start: num(t[1], `${what}[${i}].start`),
      end: num(t[2], `${what}[${i}].end`),
      startLine: num(t[3], `${what}[${i}].startLine`),
      endLine: num(t[4], `${what}[${i}].endLine`),
    };
  });
}

function decodeCell(v: unknown, what: string): Cell {
  const c = obj(v, what);
  switch (c.kind) {
    case "present":
      if (!["string", "number", "boolean"].includes(typeof c.value)) fail(`${what}.value is not a scalar`);
      return present(c.value as Scalar, decodeSpans(c.spans, `${what}.spans`));
    case "present-unparseable":
      return unparseable(str(c.raw, `${what}.raw`), decodeSpans(c.spans, `${what}.spans`));
    case "inapplicable":
      return inapplicable();
    case "unknown":
      return unknown();
    case "expected-absent":
      return expectedAbsent();
    default:
      return fail(`${what}.kind is not a cell kind`);
  }
}

function decodeType(v: unknown, what: string): RecordType {
  const t = obj(v, what);
  const columns: ColumnDef[] = arr(t.columns, `${what}.columns`).map((c, i) => {
    const pair = arr(c, `${what}.columns[${i}]`);
    return { name: str(pair[0], `${what}.columns[${i}].name`), type: str(pair[1], `${what}.columns[${i}].type`) as ScalarType };
  });
  const key = arr(t.key, `${what}.key`).map((k, i) => str(k, `${what}.key[${i}]`));
  const base = { name: str(t.name, `${what}.name`), columns, key };
  if (t.parent === undefined) return defineRecordType(base);
  const p = obj(t.parent, `${what}.parent`);
  return defineRecordType({
    ...base,
    parent: {
      type: str(p.type, `${what}.parent.type`),
      foreignKey: arr(p.foreignKey, `${what}.parent.foreignKey`).map((k, i) => str(k, `${what}.parent.foreignKey[${i}]`)),
    },
  });
}

function decodeRecord(type: RecordType, v: unknown, what: string): ParsedRecord {
  const r = obj(v, what);
  const cells: Record<string, Cell> = {};
  arr(r.cells, `${what}.cells`).forEach((c, i) => {
    const pair = arr(c, `${what}.cells[${i}]`);
    const name = str(pair[0], `${what}.cells[${i}].column`);
    if (Object.hasOwn(cells, name)) fail(`${what}.cells names ${name} twice`);
    cells[name] = decodeCell(pair[1], `${what}.cells[${i}]`);
  });
  const p = obj(r.provenance, `${what}.provenance`);
  return makeRecord(type, cells, { region: str(p.region, `${what}.provenance.region`) as Region, spans: decodeSpans(p.spans, `${what}.provenance.spans`) });
}

export function decodeParseOutput(text: string): ParseOutput {
  let output: ParseOutput;
  try {
    const root = obj(JSON.parse(text), "output");
    if (root.contract !== RECORD_CONTRACT_VERSION) {
      throw new RecordContractError([issue("contract-version", "contract", `expected ${RECORD_CONTRACT_VERSION}, found ${JSON.stringify(root.contract)}`)]);
    }
    output = {
      recordSets: arr(root.recordSets, "recordSets").map((s, i) => {
        const set = obj(s, `recordSets[${i}]`);
        const type = decodeType(set.type, `recordSets[${i}].type`);
        return { type, records: arr(set.records, `recordSets[${i}].records`).map((r, j) => decodeRecord(type, r, `recordSets[${i}].records[${j}]`)) };
      }),
    };
  } catch (e) {
    if (e instanceof Malformed || e instanceof SyntaxError) throw new RecordContractError([issue("malformed", "", e.message)]);
    throw e;
  }
  throwIfAny(checkParseOutput(output));
  return output;
}
