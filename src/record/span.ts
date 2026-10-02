import { issue, type Issue } from "./issues.js";

// Span provenance (REQ-021): which input, which byte range, which lines.
// Offsets are byte offsets into the named input, half-open [start, end). Lines are 1-based and inclusive.
// Lines are carried alongside offsets so a record stays self-describing after its input is gone, which is the transform tier's situation.
// The source name is what lets a record from one parse be merged with a record from another later (Section 4.2, cross-source merge).

export interface Span {
  readonly source: string;
  readonly start: number;
  readonly end: number;
  readonly startLine: number;
  readonly endLine: number;
}

const isNat = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;

export function checkSpan(span: unknown, path = ""): Issue[] {
  const bad = (message: string) => [issue("bad-span", path, message)];
  if (typeof span !== "object" || span === null) return bad("span is not an object");
  const s = span as Record<string, unknown>;
  if (typeof s.source !== "string" || s.source === "") return bad("source must be a non-empty string");
  if (!isNat(s.start) || !isNat(s.end)) return bad("start and end must be non-negative integers");
  if (s.end < s.start) return bad("end precedes start");
  if (!isNat(s.startLine) || !isNat(s.endLine) || s.startLine < 1) return bad("lines must be integers from 1");
  if (s.endLine < s.startLine) return bad("end line precedes start line");
  return [];
}

// REQ-061: ordering must not vary by host. JavaScript compares strings by UTF-16 code unit, Python by code point; the contract says code point.
// Shifting units at or above 0xD800 so surrogates sort above the rest of the BMP makes code-unit comparison agree with code-point order.
export function compareCodePoints(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    let x = a.charCodeAt(i);
    let y = b.charCodeAt(i);
    if (x === y) continue;
    if (x >= 0xd800) x += x >= 0xe000 ? -0x800 : 0x2000;
    if (y >= 0xd800) y += y >= 0xe000 ? -0x800 : 0x2000;
    return x - y;
  }
  return a.length - b.length;
}

const compareSpans = (a: Span, b: Span): number => compareCodePoints(a.source, b.source) || a.start - b.start || a.end - b.end;

// Normal form: sorted by source, start, end, with overlapping or touching spans of one source coalesced.
// Two provenances are equal exactly when they cover the same bytes, so normal form makes that a structural comparison.
export function normalizeSpans(spans: readonly Span[]): readonly Span[] {
  const sorted = [...spans].sort(compareSpans);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && last.source === s.source && s.start <= last.end) {
      out[out.length - 1] = {
        source: last.source,
        start: last.start,
        end: Math.max(last.end, s.end),
        startLine: Math.min(last.startLine, s.startLine),
        endLine: Math.max(last.endLine, s.endLine),
      };
    } else {
      out.push({ source: s.source, start: s.start, end: s.end, startLine: s.startLine, endLine: s.endLine });
    }
  }
  return Object.freeze(out.map((s) => Object.freeze(s)));
}

export function spansAreNormal(spans: readonly Span[]): boolean {
  for (let i = 1; i < spans.length; i++) {
    const prev = spans[i - 1]!;
    const cur = spans[i]!;
    const ordered = prev.source === cur.source ? cur.start > prev.end : compareCodePoints(prev.source, cur.source) < 0;
    if (!ordered) return false;
  }
  return true;
}

// Checks an array of spans cell by cell, then for normal form once every span is well-formed.
export function checkSpanList(spans: unknown, path: string): Issue[] {
  if (!Array.isArray(spans)) return [issue("bad-span", path, "spans must be an array")];
  const issues = spans.flatMap((s, i) => checkSpan(s, `${path}[${i}]`));
  if (issues.length === 0 && !spansAreNormal(spans as Span[])) {
    issues.push(issue("spans-not-normal", path, "spans must be sorted and coalesced"));
  }
  return issues;
}
