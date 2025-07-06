import { describe, it, expect } from "vitest";
import {
  matchPattern,
  Pattern,
  Statement,
  Field,
  $,
  defineField,
} from "../src/pattern.js";

// Define Field objects for tests
const hasName = defineField<string>("name");
const hasAge = defineField<number>("age");

describe("Pattern", () => {
  it("should match exact values", () => {
    const pattern: Pattern<string, never, "dummy"> = ["1", hasName.$("dummy")];
    const statement: Statement = ["1", hasName("Alice")];

    const result = matchPattern(pattern, statement);
    expect(result).toEqual({ dummy: "Alice" });
  });

  it("should match with variables", () => {
    const pattern: Pattern<string, "person", never> = [
      $("person"),
      hasName("Alice"),
    ];
    const statement: Statement = ["1", hasName("Alice")];

    const result = matchPattern(pattern, statement);

    expect(result).toEqual({ person: "1" });
  });

  it("should match multiple variables", () => {
    const pattern: Pattern<string, "person", "value"> = [
      $("person"),
      hasName.$("value"),
    ];
    const statement: Statement = ["1", hasName("Alice")];

    const result = matchPattern(pattern, statement);

    expect(result).toEqual({
      person: "1",
      value: "Alice",
    });
  });

  it("should not match when values differ", () => {
    const pattern: Pattern<string, "id", never> = [$("id"), hasName("Bob")];
    const statement: Statement = ["1", hasName("Alice")];

    const result = matchPattern(pattern, statement);
    expect(result).toBeNull();
  });

  it("should not match when subjects differ", () => {
    const pattern: Pattern<string, never, "name"> = ["2", hasName.$("name")];
    const statement: Statement = ["1", hasName("Alice")];

    const result = matchPattern(pattern, statement);
    expect(result).toBeNull();
  });

  it("should not match when predicates differ", () => {
    const pattern: Pattern<number, never, "age"> = ["1", hasAge.$("age")];
    const statement: Statement = ["1", hasName("Alice")];

    const result = matchPattern(pattern, statement);
    expect(result).toBeNull();
  });
});
