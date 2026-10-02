// A contract violation is reported as data: every issue found, each with a stable code and a path into the value that broke it.

export type IssueCode =
  | "bad-name"
  | "no-columns"
  | "duplicate-column"
  | "bad-column-type"
  | "no-key"
  | "bad-key"
  | "bad-foreign-key"
  | "type-mismatch"
  | "missing-cell"
  | "undeclared-column"
  | "bad-cell"
  | "value-type"
  | "indeterminate-key"
  | "closed-world-in-fragment"
  | "no-provenance"
  | "bad-span"
  | "spans-not-normal"
  | "bad-region"
  | "duplicate-key"
  | "key-mismatch"
  | "duplicate-record-set"
  | "missing-parent-set"
  | "foreign-key-shape"
  | "orphan-child"
  | "malformed"
  | "contract-version";

export interface Issue {
  readonly code: IssueCode;
  readonly path: string;
  readonly message: string;
}

export class RecordContractError extends Error {
  readonly issues: readonly Issue[];

  constructor(issues: readonly Issue[]) {
    super(issues.map((i) => `${i.path || "<root>"}: ${i.code}: ${i.message}`).join("; "));
    this.name = "RecordContractError";
    this.issues = issues;
  }
}

export const issue = (code: IssueCode, path: string, message: string): Issue => ({ code, path, message });

export const joinPath = (prefix: string, path: string): string => (!prefix ? path : !path ? prefix : `${prefix}.${path}`);

export const underPath = (prefix: string, issues: readonly Issue[]): Issue[] =>
  issues.map((i) => ({ ...i, path: joinPath(prefix, i.path) }));

export function throwIfAny(issues: readonly Issue[]): void {
  if (issues.length > 0) throw new RecordContractError(issues);
}
