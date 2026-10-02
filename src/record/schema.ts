import { SCALAR_TYPES, type ScalarType } from "./cell.js";
import { issue, throwIfAny, type Issue } from "./issues.js";

// A record type: its columns and their scalar types, its declared identity (REQ-052), and for a child record set the link to its parent (REQ-050).
// The shape is static and known when a definition loads (Section 8.2, type system).

export interface ColumnDef {
  readonly name: string;
  readonly type: ScalarType;
}

// A child record set carries the enclosing record's key. `foreignKey` names this type's columns that hold it, positionally matching the parent's key.
export interface ParentLink {
  readonly type: string;
  readonly foreignKey: readonly string[];
}

export interface RecordType {
  readonly name: string;
  readonly columns: readonly ColumnDef[];
  readonly key: readonly string[];
  readonly parent?: ParentLink;
}

// Names are identifiers so they read the same in every host language. A leading double underscore is reserved.
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const nameOk = (n: unknown): n is string => typeof n === "string" && NAME.test(n) && !n.startsWith("__");

export function checkRecordType(def: RecordType, path = ""): Issue[] {
  const at = (p: string) => (path ? `${path}.${p}` : p);
  const issues: Issue[] = [];
  if (!nameOk(def.name)) issues.push(issue("bad-name", at("name"), `record type name ${JSON.stringify(def.name)} is not an identifier`));

  const columns = Array.isArray(def.columns) ? def.columns : [];
  if (columns.length === 0) issues.push(issue("no-columns", at("columns"), "a record type declares at least one column"));
  const seen = new Set<string>();
  columns.forEach((c, i) => {
    if (!nameOk(c?.name)) issues.push(issue("bad-name", at(`columns[${i}]`), `column name ${JSON.stringify(c?.name)} is not an identifier`));
    else if (seen.has(c.name)) issues.push(issue("duplicate-column", at(`columns[${i}]`), `column ${c.name} is declared twice`));
    else seen.add(c.name);
    if (!(SCALAR_TYPES as readonly unknown[]).includes(c?.type)) {
      issues.push(issue("bad-column-type", at(`columns[${i}]`), `column type ${JSON.stringify(c?.type)} is not registered`));
    }
  });

  const key = Array.isArray(def.key) ? def.key : [];
  if (key.length === 0) issues.push(issue("no-key", at("key"), "identity is declared, never inferred: name at least one key column"));
  if (new Set(key).size !== key.length) issues.push(issue("bad-key", at("key"), "a key column is named twice"));
  for (const k of key) if (!seen.has(k)) issues.push(issue("bad-key", at("key"), `key column ${k} is not declared`));

  if (def.parent !== undefined) {
    const fk = Array.isArray(def.parent.foreignKey) ? def.parent.foreignKey : [];
    if (!nameOk(def.parent.type)) issues.push(issue("bad-name", at("parent.type"), "parent type name is not an identifier"));
    if (def.parent.type === def.name) issues.push(issue("bad-foreign-key", at("parent"), "a record type cannot be its own parent"));
    if (fk.length === 0) issues.push(issue("bad-foreign-key", at("parent.foreignKey"), "a child record set names its foreign key columns"));
    if (new Set(fk).size !== fk.length) issues.push(issue("bad-foreign-key", at("parent.foreignKey"), "a foreign key column is named twice"));
    for (const k of fk) {
      if (!seen.has(k)) issues.push(issue("bad-foreign-key", at("parent.foreignKey"), `foreign key column ${k} is not declared`));
    }
  }
  return issues;
}

export function defineRecordType(def: RecordType): RecordType {
  throwIfAny(checkRecordType(def));
  const base = {
    name: def.name,
    columns: Object.freeze(def.columns.map((c) => Object.freeze({ name: c.name, type: c.type }))),
    key: Object.freeze([...def.key]),
  };
  if (def.parent === undefined) return Object.freeze(base);
  return Object.freeze({
    ...base,
    parent: Object.freeze({ type: def.parent.type, foreignKey: Object.freeze([...def.parent.foreignKey]) }),
  });
}

export const columnType = (type: RecordType, name: string): ScalarType | undefined =>
  type.columns.find((c) => c.name === name)?.type;
