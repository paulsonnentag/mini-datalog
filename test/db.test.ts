import { describe, it, expect, beforeEach } from "vitest";
import { DB } from "../src/db.js";

describe("DB", () => {
  let db: DB;

  beforeEach(() => {
    db = new DB();
  });

  describe("assert and retract", () => {
    it("should assert triples and return them in state", () => {
      // Test assert
      db.assert(["1", "name", "Alice"]);
      db.assert(["1", "age", 30]);
      db.assert(["2", "name", "Bob"]);
      db.assert(["1", "hobby", "reading"]);
      db.assert(["1", "hobby", "swimming"]);

      // Test state returns all triples
      const expectedState = [
        ["1", "name", "Alice"],
        ["1", "age", 30],
        ["2", "name", "Bob"],
        ["1", "hobby", "reading"],
        ["1", "hobby", "swimming"],
      ];

      expect(db.triples()).toEqual(expect.arrayContaining(expectedState));
      expect(db.triples()).toHaveLength(expectedState.length);
    });

    it("should retract triples and update state", () => {
      // Setup initial state
      db.assert(["1", "name", "Alice"]);
      db.assert(["1", "age", 30]);
      db.assert(["2", "name", "Bob"]);
      db.assert(["1", "hobby", "reading"]);
      db.assert(["1", "hobby", "swimming"]);

      // Test retract
      db.retract(["1", "age", 30]);
      db.retract(["1", "hobby", "reading"]);

      const expectedAfterRetract = [
        ["1", "name", "Alice"],
        ["2", "name", "Bob"],
        ["1", "hobby", "swimming"],
      ];

      expect(db.triples()).toEqual(
        expect.arrayContaining(expectedAfterRetract)
      );
      expect(db.triples()).toHaveLength(expectedAfterRetract.length);
    });

    it("should not add duplicate triples on assert", () => {
      // Setup initial state
      db.assert(["1", "name", "Alice"]);
      db.assert(["1", "age", 30]);
      db.assert(["2", "name", "Bob"]);
      db.assert(["1", "hobby", "reading"]);
      db.assert(["1", "hobby", "swimming"]);

      // Retract some triples
      db.retract(["1", "age", 30]);
      db.retract(["1", "hobby", "reading"]);

      const expectedAfterRetract = [
        ["1", "name", "Alice"],
        ["2", "name", "Bob"],
        ["1", "hobby", "swimming"],
      ];

      // Test duplicate assert doesn't add
      db.assert(["1", "name", "Alice"]);

      expect(db.triples()).toEqual(
        expect.arrayContaining(expectedAfterRetract)
      );
      expect(db.triples()).toHaveLength(expectedAfterRetract.length);
    });

    it("should not change state when retracting non-existent triples", () => {
      // Setup initial state
      db.assert(["1", "name", "Alice"]);
      db.assert(["1", "age", 30]);
      db.assert(["2", "name", "Bob"]);
      db.assert(["1", "hobby", "reading"]);
      db.assert(["1", "hobby", "swimming"]);

      // Retract some triples
      db.retract(["1", "age", 30]);
      db.retract(["1", "hobby", "reading"]);

      const expectedAfterRetract = [
        ["1", "name", "Alice"],
        ["2", "name", "Bob"],
        ["1", "hobby", "swimming"],
      ];

      // Test retract non-existent
      db.retract(["999", "name", "NonExistent"]);

      expect(db.triples()).toEqual(
        expect.arrayContaining(expectedAfterRetract)
      );
      expect(db.triples()).toHaveLength(expectedAfterRetract.length);
    });
  });

  describe("edge cases", () => {
    it("should handle empty database", () => {
      expect(db.triples()).toEqual([]);
    });

    it("should handle retracting from empty database", () => {
      db.retract(["1", "name", "Alice"]);
      expect(db.triples()).toEqual([]);
    });

    it("should handle multiple retracts of the same triple", () => {
      db.assert(["1", "name", "Alice"]);
      db.retract(["1", "name", "Alice"]);
      db.retract(["1", "name", "Alice"]); // Retract again
      expect(db.triples()).toEqual([]);
    });
  });

  describe("query", () => {
    beforeEach(() => {
      // Setup test data
      db.assert(["1", "name", "Alice"]);
      db.assert(["1", "age", 30]);
      db.assert(["2", "name", "Bob"]);
      db.assert(["2", "age", 25]);
      db.assert(["3", "name", "Charlie"]);
      db.assert(["3", "age", 35]);
      db.assert(["1", "hobby", "reading"]);
      db.assert(["2", "hobby", "swimming"]);
      db.assert(["3", "hobby", "reading"]);
    });

    it("should query with exact matches", () => {
      const results = db.query([["1", "name", "Alice"]]);
      expect(results).toEqual([{}]);
    });

    it("should query with variables", () => {
      const results = db.query([["?id", "name", "Alice"]]);
      expect(results).toEqual([{ id: "1" }]);
    });

    it("should query with multiple variables", () => {
      const results = db.query([["?id", "?attr", "Alice"]]);
      expect(results).toEqual([{ id: "1", attr: "name" }]);
    });

    it("should query with variable in object position", () => {
      const results = db.query([["1", "name", "?value"]]);
      expect(results).toEqual([{ value: "Alice" }]);
    });

    it("should return multiple results for multiple matches", () => {
      const results = db.query([["?id", "hobby", "reading"]]);
      expect(results).toEqual([{ id: "1" }, { id: "3" }]);
    });

    it("should handle queries with no matches", () => {
      const results = db.query([["?id", "name", "David"]]);
      expect(results).toEqual([]);
    });

    it("should handle queries with non-existent entities", () => {
      const results = db.query([["999", "name", "?value"]]);
      expect(results).toEqual([]);
    });

    it("should handle queries with non-existent attributes", () => {
      const results = db.query([["1", "nonexistent", "?value"]]);
      expect(results).toEqual([]);
    });

    it("should query with multiple patterns", () => {
      const results = db.query([
        ["?id", "name", "?name"],
        ["?id", "age", "?age"],
      ]);

      expect(results).toEqual([
        { id: "1", name: "Alice", age: 30 },
        { id: "2", name: "Bob", age: 25 },
        { id: "3", name: "Charlie", age: 35 },
      ]);
    });

    it("should handle complex multi-pattern queries with constraints", () => {
      const results = db.query([
        ["?id", "hobby", "reading"],
        ["?id", "age", "?age"],
      ]);

      expect(results).toEqual([
        { id: "1", age: 30 },
        { id: "3", age: 35 },
      ]);
    });

    it("should handle queries with mixed variable and literal patterns", () => {
      const results = db.query([
        ["1", "name", "?name"],
        ["1", "age", "?age"],
      ]);

      expect(results).toEqual([{ name: "Alice", age: 30 }]);
    });

    it("should handle queries with repeated variables", () => {
      const results = db.query([
        ["?id", "name", "?name"],
        ["?id", "hobby", "reading"],
      ]);

      expect(results).toEqual([
        { id: "1", name: "Alice" },
        { id: "3", name: "Charlie" },
      ]);
    });

    it("should handle empty query patterns", () => {
      const results = db.query([]);
      expect(results).toEqual([{}]);
    });

    it("should handle queries after data modifications", () => {
      // Initial query
      let results = db.query([["?id", "name", "Alice"]]);
      expect(results).toEqual([{ id: "1" }]);

      // Retract the data
      db.retract(["1", "name", "Alice"]);

      // Query again - should return no results
      results = db.query([["?id", "name", "Alice"]]);
      expect(results).toEqual([]);
    });

    it("should handle queries with multiple attributes for same entity", () => {
      const results = db.query([
        ["?id", "name", "?name"],
        ["?id", "age", "?age"],
        ["?id", "hobby", "?hobby"],
      ]);

      expect(results).toEqual([
        { id: "1", name: "Alice", age: 30, hobby: "reading" },
        { id: "2", name: "Bob", age: 25, hobby: "swimming" },
        { id: "3", name: "Charlie", age: 35, hobby: "reading" },
      ]);
    });
  });
});
