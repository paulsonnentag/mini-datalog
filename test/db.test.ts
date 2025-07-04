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
      db.assert([
        ["1", "name", "Alice"],
        ["1", "age", 30],
        ["2", "name", "Bob"],
        ["1", "hobby", "reading"],
        ["1", "hobby", "swimming"],
      ]);

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
      db.assert([
        ["1", "name", "Alice"],
        ["1", "age", 30],
        ["1", "hobby", "reading"],
        ["1", "hobby", "swimming"],
        ["2", "name", "Bob"],
      ]);

      // Test retract
      db.retract([
        ["1", "age", 30],
        ["1", "hobby", "reading"],
      ]);

      const expectedAfterRetract = [
        ["1", "name", "Alice"],
        ["1", "hobby", "swimming"],
        ["2", "name", "Bob"],
      ];

      expect(db.triples()).toEqual(
        expect.arrayContaining(expectedAfterRetract)
      );
      expect(db.triples()).toHaveLength(expectedAfterRetract.length);
    });

    it("should not add duplicate triples on assert", () => {
      // Setup initial state
      db.assert([
        ["1", "name", "Alice"],
        ["1", "age", 30],
        ["2", "name", "Bob"],
        ["1", "hobby", "reading"],
        ["1", "hobby", "swimming"],
      ]);

      // Retract some triples
      db.retract([
        ["1", "age", 30],
        ["1", "hobby", "reading"],
      ]);

      const expectedAfterRetract = [
        ["1", "name", "Alice"],
        ["2", "name", "Bob"],
        ["1", "hobby", "swimming"],
      ];

      // Test duplicate assert doesn't add
      db.assert([["1", "name", "Alice"]]);

      expect(db.triples()).toEqual(
        expect.arrayContaining(expectedAfterRetract)
      );
      expect(db.triples()).toHaveLength(expectedAfterRetract.length);
    });

    it("should not change state when retracting non-existent triples", () => {
      // Setup initial state
      db.assert([
        ["1", "name", "Alice"],
        ["1", "age", 30],
        ["2", "name", "Bob"],
        ["1", "hobby", "reading"],
        ["1", "hobby", "swimming"],
      ]);

      // Retract some triples
      db.retract([
        ["1", "age", 30],
        ["1", "hobby", "reading"],
      ]);

      const expectedAfterRetract = [
        ["1", "name", "Alice"],
        ["2", "name", "Bob"],
        ["1", "hobby", "swimming"],
      ];

      // Test retract non-existent
      db.retract([["999", "name", "NonExistent"]]);

      expect(db.triples()).toEqual(
        expect.arrayContaining(expectedAfterRetract)
      );
      expect(db.triples()).toHaveLength(expectedAfterRetract.length);
    });

    it("should return a retract function from assert that retracts only the effectively asserted claims", () => {
      // Initial state
      db.assert([
        ["1", "name", "Alice"],
        ["1", "age", 30],
      ]);

      // Assert new triples and get the retract function
      const retractFn = db.assert([
        ["2", "name", "Bob"],
        ["2", "age", 25],
        ["1", "name", "Alice"], // This is a duplicate, should not be retracted
        ["3", "name", "Charlie"],
      ]);

      // Verify the triples were added
      const expectedAfterAssert = [
        ["1", "name", "Alice"],
        ["1", "age", 30],
        ["2", "name", "Bob"],
        ["2", "age", 25],
        ["3", "name", "Charlie"],
      ];

      expect(db.triples()).toEqual(expect.arrayContaining(expectedAfterAssert));
      expect(db.triples()).toHaveLength(expectedAfterAssert.length);

      // Call the retract function
      retractFn();

      // Verify only the effectively asserted triples were retracted
      // (Bob, Charlie, and their attributes, but not Alice's duplicate name)
      const expectedAfterRetract = [
        ["1", "name", "Alice"],
        ["1", "age", 30],
      ];

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
      db.retract([["1", "name", "Alice"]]);
      expect(db.triples()).toEqual([]);
    });

    it("should handle multiple retracts of the same triple", () => {
      db.assert([["1", "name", "Alice"]]);
      db.retract([["1", "name", "Alice"]]);
      db.retract([["1", "name", "Alice"]]); // Retract again
      expect(db.triples()).toEqual([]);
    });
  });

  describe("query", () => {
    beforeEach(() => {
      // Setup test data
      db.assert([
        ["1", "name", "Alice"],
        ["1", "age", 30],
        ["2", "name", "Bob"],
        ["2", "age", 25],
        ["3", "name", "Charlie"],
        ["3", "age", 35],
        ["1", "hobby", "reading"],
        ["2", "hobby", "swimming"],
        ["3", "hobby", "reading"],
      ]);
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
      db.retract([["1", "name", "Alice"]]);

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

  describe("rules", () => {
    beforeEach(() => {
      // Setup test data
      db.assert([
        ["1", "name", "Alice"],
        ["1", "age", 30],
        ["2", "name", "Bob"],
        ["2", "age", 25],
        ["3", "name", "Charlie"],
        ["3", "age", 35],
      ]);
    });

    it("should apply simple rules when conditions are met", () => {
      // Define a rule: if someone is over 30, they are an adult
      db.when([["?id", "age", "?age"]], (context) => {
        if (context && context.age > 30) {
          db.assert([[context.id, "status", "adult"]]);
        }
      });

      const results = db.query([["?id", "status", "adult"]]);
      expect(results).toEqual([{ id: "3" }]); // Charlie is 35
    });

    it("should apply rules with multiple conditions", () => {
      // Define a rule: if someone is over 25 and has a name, they are eligible
      db.when(
        [
          ["?id", "age", "?age"],
          ["?id", "name", "?name"],
        ],
        (context) => {
          if (context && context.age > 25) {
            db.assert([[context.id, "eligible", true]]);
          }
        }
      );

      const results = db.query([["?id", "eligible", true]]);
      expect(results).toEqual([
        { id: "1" }, // Alice is 30
        { id: "3" }, // Charlie is 35
      ]);
    });

    it("should not apply rules when conditions are not met", () => {
      // Define a rule: if someone is over 40, they are senior
      db.when([["?id", "age", "?age"]], (context) => {
        if (context && context.age > 40) {
          db.assert([[context.id, "status", "senior"]]);
        }
      });

      const results = db.query([["?id", "status", "senior"]]);
      expect(results).toEqual([]); // No one is over 40
    });

    it("should apply rules when new facts are added", () => {
      // Define a rule: if someone is over 30, they are an adult
      db.when([["?id", "age", "?age"]], (context) => {
        if (context.age > 30) {
          db.assert([[context.id, "status", "adult"]]);
        }
      });

      // Initially only Charlie should be adult
      let results = db.query([["?id", "status", "adult"]]);
      expect(results).toEqual([{ id: "3" }]);

      // Add a new person over 30
      db.assert([
        ["4", "name", "David"],
        ["4", "age", 45],
      ]);

      // Now David should also be marked as adult
      results = db.query([["?id", "status", "adult"]]);
      expect(results).toEqual([
        { id: "3" }, // Charlie
        { id: "4" }, // David
      ]);
    });

    it("should handle rules that add multiple facts", () => {
      // Define a rule that adds multiple facts
      db.when([["?id", "age", "?age"]], (context) => {
        if (context.age > 30) {
          db.assert([
            [context.id, "status", "adult"],
            [context.id, "canVote", true],
            [context.id, "seniorDiscount", false],
          ]);
        }
      });

      const results = db.query([["?id", "status", "adult"]]);
      expect(results).toEqual([{ id: "3" }]);

      const voteResults = db.query([["?id", "canVote", true]]);
      expect(voteResults).toEqual([{ id: "3" }]);

      const discountResults = db.query([["?id", "seniorDiscount", false]]);
      expect(discountResults).toEqual([{ id: "3" }]);
    });

    it("should handle multiple rules", () => {
      // Rule 1: Over 30 is adult
      db.when([["?id", "age", "?age"]], (context) => {
        if (context.age > 30) {
          db.assert([[context.id, "status", "adult"]]);
        }
      });

      // Rule 2: Adults can vote
      db.when([["?id", "status", "adult"]], (context) => {
        if (context) {
          db.assert([[context.id, "canVote", true]]);
        }
      });

      const results = db.query([["?id", "canVote", true]]);
      expect(results).toEqual([{ id: "3" }]); // Charlie is adult and can vote
    });

    it("should handle chained rules", () => {
      // Rule 1: Over 30 is adult
      db.when([["?id", "age", "?age"]], (context) => {
        if (context && context.age > 30) {
          db.assert([[context.id, "status", "adult"]]);
        }
      });

      // Rule 2: Adults are eligible
      db.when([["?id", "status", "adult"]], (context) => {
        if (context) {
          db.assert([[context.id, "eligible", true]]);
        }
      });

      // Rule 3: Eligible people can apply
      db.when([["?id", "eligible", true]], (context) => {
        if (context) {
          db.assert([[context.id, "canApply", true]]);
        }
      });

      const results = db.query([["?id", "canApply", true]]);
      expect(results).toEqual([{ id: "3" }]); // Charlie: 35 -> adult -> eligible -> canApply
    });

    it("should handle rules with complex conditions", () => {
      // Add some additional data
      db.assert([
        ["1", "city", "New York"],
        ["2", "city", "Boston"],
        ["3", "city", "New York"],
      ]);

      // Rule: People over 30 in New York get a metro card
      db.when(
        [
          ["?id", "age", "?age"],
          ["?id", "city", "New York"],
        ],
        (context) => {
          if (context.age > 30) {
            db.assert([[context.id, "metroCard", true]]);
          }
        }
      );

      const results = db.query([["?id", "metroCard", true]]);
      expect(results).toEqual([{ id: "3" }]); // Only Charlie is over 30 and in NY
    });

    it("should handle rules that depend on variables from multiple patterns", () => {
      // Add some additional data
      db.assert([
        ["1", "salary", 50000],
        ["2", "salary", 60000],
        ["3", "salary", 70000],
      ]);

      // Rule: People over 30 with salary > 60000 are high earners
      db.when(
        [
          ["?id", "age", "?age"],
          ["?id", "salary", "?salary"],
        ],
        (context) => {
          if (context.age > 30 && context.salary > 60000) {
            db.assert([[context.id, "highEarner", true]]);
          }
        }
      );

      const results = db.query([["?id", "highEarner", true]]);
      expect(results).toEqual([{ id: "3" }]); // Charlie: 35 years, 70000 salary
    });

    it("should handle rules that are added after data exists", () => {
      // Add data first
      db.assert([
        ["4", "name", "David"],
        ["4", "age", 45],
      ]);

      // Then add rule
      db.when([["?id", "age", "?age"]], (context) => {
        if (context.age > 40) {
          db.assert([[context.id, "status", "senior"]]);
        }
      });

      const results = db.query([["?id", "status", "senior"]]);
      expect(results).toEqual([{ id: "4" }]); // David should be marked as senior
    });

    it("should handle rules that use bound variables in conditions", () => {
      // Rule: If someone is over 30 and their name starts with 'C', they are special
      db.when(
        [
          ["?id", "age", "?age"],
          ["?id", "name", "?name"],
        ],
        (context) => {
          if (context.age > 30 && context.name.startsWith("C")) {
            db.assert([[context.id, "special", true]]);
          }
        }
      );

      const results = db.query([["?id", "special", true]]);
      expect(results).toEqual([{ id: "3" }]); // Charlie: 35 years, name starts with 'C'
    });

    it("should prevent infinite loops in rule evaluation", () => {
      // This rule could potentially cause infinite loops if not handled properly
      // It should only add the fact once per entity
      db.when([["?id", "name", "?name"]], (context) => {
        // Only add if not already present
        const existing = db.query([["?id", "hasName", true]]);
        const alreadyExists = existing.some(
          (result) => result.id === context.id
        );
        if (!alreadyExists) {
          db.assert([[context.id, "hasName", true]]);
        }
      });

      const results = db.query([["?id", "hasName", true]]);
      expect(results).toEqual([{ id: "1" }, { id: "2" }, { id: "3" }]);
    });

    it("should handle rules that retract facts (should throw error)", () => {
      // Rules should not be able to retract facts
      db.when([["?id", "age", "?age"]], (context) => {
        if (context.age > 30) {
          expect(() => {
            db.retract([[context.id, "name", "Charlie"]]);
          }).toThrow("Cannot retract facts in when block");
        }
      });
    });
  });
});
