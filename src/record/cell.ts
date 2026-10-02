import { normalizeSpans, type Span } from "./span.js";

// A cell is the value of one column in one record. It is either present, or absent in exactly one of the four states of REQ-020.
// No constructor here produces a bare null, and nothing collapses the four states into one (REQ-020).

// The registered scalar set for v1 (Section 8.2, type system). Multi-valued attributes are child record sets (REQ-050, US-006), not list cells.
export const SCALAR_TYPES = ["text", "integer", "boolean"] as const;
export type ScalarType = (typeof SCALAR_TYPES)[number];
export type Scalar = string | number | boolean;

export const ABSENCE_STATES = ["inapplicable", "unknown", "expected-absent", "present-unparseable"] as const;
export type AbsenceState = (typeof ABSENCE_STATES)[number];

export interface Present {
  readonly kind: "present";
  readonly value: Scalar;
  readonly spans: readonly Span[];
}

// The attribute does not apply to this entity.
export interface Inapplicable {
  readonly kind: "inapplicable";
}

// Open world: nothing is known. The only state that carries no information, so it yields to anything in a merge.
export interface Unknown {
  readonly kind: "unknown";
}

// Closed world: the parser consumed the whole region and the attribute was not there. Negative information.
export interface ExpectedAbsent {
  readonly kind: "expected-absent";
}

// Something was there and did not parse. The raw text and where it was are kept.
export interface PresentUnparseable {
  readonly kind: "present-unparseable";
  readonly raw: string;
  readonly spans: readonly Span[];
}

export type Absent = Inapplicable | Unknown | ExpectedAbsent | PresentUnparseable;
export type Cell = Present | Absent;
export type CellKind = Cell["kind"];

export const CELL_KINDS: readonly CellKind[] = ["present", ...ABSENCE_STATES];

// -0 is folded to 0 so that every core, and the canonical encoding, sees one zero.
export const present = (value: Scalar, spans: readonly Span[] = []): Present =>
  Object.freeze({ kind: "present", value: value === 0 ? 0 : value, spans: normalizeSpans(spans) });

export const inapplicable = (): Inapplicable => Object.freeze({ kind: "inapplicable" });
export const unknown = (): Unknown => Object.freeze({ kind: "unknown" });
export const expectedAbsent = (): ExpectedAbsent => Object.freeze({ kind: "expected-absent" });

export const unparseable = (raw: string, spans: readonly Span[] = []): PresentUnparseable =>
  Object.freeze({ kind: "present-unparseable", raw, spans: normalizeSpans(spans) });

export const isAbsent = (cell: Cell): cell is Absent => cell.kind !== "present";

// The simple presentation REQ-020 asks for at the surface. It is a read-only view: the cell keeps its full state.
export const simpleValue = (cell: Cell): Scalar | null => (cell.kind === "present" ? cell.value : null);

export function scalarMatches(type: ScalarType, value: unknown): boolean {
  switch (type) {
    case "text":
      return typeof value === "string";
    case "integer":
      return typeof value === "number" && Number.isSafeInteger(value) && !Object.is(value, -0);
    case "boolean":
      return typeof value === "boolean";
  }
}
