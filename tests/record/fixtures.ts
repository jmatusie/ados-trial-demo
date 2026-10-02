import { defineRecordType, type Span } from "../../src/record/index.js";

// Synthetic shapes only. Nothing here is derived from samples/ or any device output.

export const span = (start: number, end: number, startLine: number, endLine = startLine, source = "input"): Span => ({
  source,
  start,
  end,
  startLine,
  endLine,
});

export const Section = defineRecordType({
  name: "section",
  columns: [
    { name: "id", type: "integer" },
    { name: "label", type: "text" },
    { name: "enabled", type: "boolean" },
  ],
  key: ["id"],
});

export const Entry = defineRecordType({
  name: "entry",
  columns: [
    { name: "scope", type: "text" },
    { name: "owner", type: "text" },
    { name: "seq", type: "integer" },
    { name: "action", type: "text" },
  ],
  key: ["scope", "owner", "seq"],
});

export const Item = defineRecordType({
  name: "item",
  columns: [
    { name: "section_id", type: "integer" },
    { name: "value", type: "text" },
  ],
  key: ["section_id", "value"],
  parent: { type: "section", foreignKey: ["section_id"] },
});
