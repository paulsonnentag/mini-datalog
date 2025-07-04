import { describe, it, expect } from "vitest";
import { matchPattern, Pattern, Triple } from "../src/pattern.js";

describe("Pattern", () => {
  it("should match exact values", () => {
    const pattern: Pattern = ["1", "name", "Alice"];
    const triple: Triple = ["1", "name", "Alice"];

    const result = matchPattern(pattern, triple);
    expect(result).toEqual({});
  });

  it("should match with variables", () => {
    const pattern: Pattern = ["?person", "name", "Alice"];
    const triple: Triple = ["1", "name", "Alice"];

    const result = matchPattern(pattern, triple);
    expect(result).toEqual({ person: "1" });
  });

  it("should match multiple variables", () => {
    const pattern: Pattern = ["?person", "?property", "?value"];
    const triple: Triple = ["1", "name", "Alice"];

    const result = matchPattern(pattern, triple);
    expect(result).toEqual({
      person: "1",
      property: "name",
      value: "Alice",
    });
  });

  it("should not match when values differ", () => {
    const pattern: Pattern = ["1", "name", "Bob"];
    const triple: Triple = ["1", "name", "Alice"];

    const result = matchPattern(pattern, triple);
    expect(result).toBeNull();
  });

  it("should not match when subjects differ", () => {
    const pattern: Pattern = ["2", "name", "Alice"];
    const triple: Triple = ["1", "name", "Alice"];

    const result = matchPattern(pattern, triple);
    expect(result).toBeNull();
  });

  it("should not match when predicates differ", () => {
    const pattern: Pattern = ["1", "age", "Alice"];
    const triple: Triple = ["1", "name", "Alice"];

    const result = matchPattern(pattern, triple);
    expect(result).toBeNull();
  });
});
