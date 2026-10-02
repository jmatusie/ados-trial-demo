import { RecordContractError, defineRecordType } from "../../src/record/index.js";
import { Entry, Item } from "./fixtures.js";

// REQ-052: identity is declared, not inferred, and composite keys are permitted.

describe("defineRecordType", () => {
  it("declares key columns, including a composite key", () => {
    expect(Entry.key).toEqual(["scope", "owner", "seq"]);
  });

  it("declares a parent link for a child record set (REQ-050)", () => {
    expect(Item.parent).toEqual({ type: "section", foreignKey: ["section_id"] });
  });

  it("returns a frozen type", () => {
    expect(Object.isFrozen(Entry)).toBe(true);
    expect(Object.isFrozen(Entry.columns)).toBe(true);
    expect(Object.isFrozen(Entry.key)).toBe(true);
  });

  const bad: [string, Parameters<typeof defineRecordType>[0]][] = [
    ["no key", { name: "t", columns: [{ name: "a", type: "text" }], key: [] }],
    ["key naming an undeclared column", { name: "t", columns: [{ name: "a", type: "text" }], key: ["b"] }],
    ["repeated key column", { name: "t", columns: [{ name: "a", type: "text" }], key: ["a", "a"] }],
    [
      "duplicate column",
      {
        name: "t",
        columns: [
          { name: "a", type: "text" },
          { name: "a", type: "integer" },
        ],
        key: ["a"],
      },
    ],
    ["no columns", { name: "t", columns: [], key: ["a"] }],
    ["bad type name", { name: "9t", columns: [{ name: "a", type: "text" }], key: ["a"] }],
    ["bad column name", { name: "t", columns: [{ name: "a-b", type: "text" }], key: ["a-b"] }],
    ["reserved column name", { name: "t", columns: [{ name: "__proto__", type: "text" }], key: ["__proto__"] }],
    [
      "unregistered column type",
      { name: "t", columns: [{ name: "a", type: "list" as unknown as "text" }], key: ["a"] },
    ],
    [
      "foreign key naming an undeclared column",
      { name: "t", columns: [{ name: "a", type: "text" }], key: ["a"], parent: { type: "p", foreignKey: ["x"] } },
    ],
    [
      "empty foreign key",
      { name: "t", columns: [{ name: "a", type: "text" }], key: ["a"], parent: { type: "p", foreignKey: [] } },
    ],
    [
      "self parent",
      { name: "t", columns: [{ name: "a", type: "text" }], key: ["a"], parent: { type: "t", foreignKey: ["a"] } },
    ],
  ];

  it.each(bad)("rejects a type with %s", (_name, def) => {
    expect(() => defineRecordType(def)).toThrow(RecordContractError);
  });
});
