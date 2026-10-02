import { readFileSync } from "node:fs";
import { SPEC_VERSION } from "../src/index.js";

// These tests exist so a verification oracle is present from the first commit.
// They assert the toolchain runs and the specification is where the skills expect it.
// They are not a substitute for product tests, and every milestone adds real ones.

describe("toolchain", () => {
  it("loads the reference core entry point", () => {
    expect(SPEC_VERSION).toBe("XV2.0");
  });
});

describe("specification", () => {
  const spec = readFileSync(new URL("../specs/SPEC.md", import.meta.url), "utf8");

  it("is present and declares its identifier scheme", () => {
    expect(spec).toContain("## 0. How to Read This Document");
    expect(spec).toContain("`REQ-NNN`");
  });

  it("declares the build milestones the report and the auditor read", () => {
    expect(spec).toContain("## 10. Build Milestones");
    for (const m of ["Record contract", "Portable IR", "Conformance suite"]) {
      expect(spec).toContain(m);
    }
  });
});
