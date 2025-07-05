import { describe, it, expect, beforeEach } from "vitest";
import { DB } from "../src/db.js";

// Utility function for making async tests more readable
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
        ["1", "age", 14],
        ["2", "name", "Bob"],
        ["2", "age", 17],
        ["3", "name", "Charlie"],
        ["3", "age", 61],
        ["1", "hobby", "reading"],
        ["2", "hobby", "swimming"],
        ["3", "hobby", "reading"],
      ]);
    });

    it("should query with exact matches", () => {
      let results: any[] = [];
      db.query([["1", "name", "Alice"]], (contexts) => {
        results = contexts;
      });
      expect(results).toEqual([{}]);
    });

    it("should query with variables", () => {
      let results: any[] = [];
      db.query([["?id", "name", "Alice"]], (contexts) => {
        results = contexts;
      });
      expect(results).toEqual([{ id: "1" }]);
    });

    it("should query with multiple variables", () => {
      let results: any[] = [];
      db.query([["?id", "?attr", "Alice"]], (contexts) => {
        results = contexts;
      });
      expect(results).toEqual([{ id: "1", attr: "name" }]);
    });

    it("should query with variable in object position", () => {
      let results: any[] = [];
      db.query([["1", "name", "?value"]], (contexts) => {
        results = contexts;
      });
      expect(results).toEqual([{ value: "Alice" }]);
    });

    it("should return multiple results for multiple matches", () => {
      let results: any[] = [];
      db.query([["?id", "hobby", "reading"]], (contexts) => {
        results = contexts;
      });
      expect(results).toEqual([{ id: "1" }, { id: "3" }]);
    });

    it("should handle queries with no matches", () => {
      let results: any[] = [];
      db.query([["?id", "name", "David"]], (contexts) => {
        results = contexts;
      });
      expect(results).toEqual([]);
    });

    it("should handle queries with non-existent entities", () => {
      let results: any[] = [];
      db.query([["999", "name", "?value"]], (contexts) => {
        results = contexts;
      });
      expect(results).toEqual([]);
    });

    it("should handle queries with non-existent attributes", () => {
      let results: any[] = [];
      db.query([["1", "nonexistent", "?value"]], (contexts) => {
        results = contexts;
      });
      expect(results).toEqual([]);
    });

    it("should query with multiple patterns", async () => {
      let results = await db.queryOnce([
        ["?id", "name", "?name"],
        ["?id", "age", "?age"],
      ]);

      expect(results).toEqual([
        { id: "1", name: "Alice", age: 14 },
        { id: "2", name: "Bob", age: 17 },
        { id: "3", name: "Charlie", age: 61 },
      ]);
    });

    it("should handle complex multi-pattern queries with constraints", async () => {
      let results = await db.queryOnce([
        ["?id", "hobby", "reading"],
        ["?id", "age", "?age"],
      ]);

      expect(results).toEqual([
        { id: "1", age: 14 },
        { id: "3", age: 61 },
      ]);
    });

    it("should handle queries with mixed variable and literal patterns", async () => {
      let results = await db.queryOnce([
        ["1", "name", "?name"],
        ["1", "age", "?age"],
      ]);

      expect(results).toEqual([{ name: "Alice", age: 14 }]);
    });

    it("should handle queries with repeated variables", () => {
      let results: any[] = [];
      db.query(
        [
          ["?id", "name", "?name"],
          ["?id", "hobby", "reading"],
        ],
        (contexts) => {
          results = contexts;
        }
      );

      expect(results).toEqual([
        { id: "1", name: "Alice" },
        { id: "3", name: "Charlie" },
      ]);
    });

    it("should handle empty query patterns", () => {
      let results: any[] = [];
      db.query([], (contexts) => {
        results = contexts;
      });
      expect(results).toEqual([{}]);
    });

    it("should handle queries after data modifications", () => {
      // Initial query
      let results: any[] = [];
      db.query([["?id", "name", "Alice"]], (contexts) => {
        results = contexts;
      });
      expect(results).toEqual([{ id: "1" }]);

      // Retract the data
      db.retract([["1", "name", "Alice"]]);

      // Query again - should return no results
      results = [];
      db.query([["?id", "name", "Alice"]], (contexts) => {
        results = contexts;
      });
      expect(results).toEqual([]);
    });

    it("should handle queries with multiple attributes for same entity", async () => {
      let results = await db.queryOnce([
        ["?id", "name", "?name"],
        ["?id", "age", "?age"],
        ["?id", "hobby", "?hobby"],
      ]);

      expect(results).toEqual([
        { id: "1", name: "Alice", age: 14, hobby: "reading" },
        { id: "2", name: "Bob", age: 17, hobby: "swimming" },
        { id: "3", name: "Charlie", age: 61, hobby: "reading" },
      ]);
    });
  });

  describe("rules", () => {
    beforeEach(() => {
      // Setup test data
      db.assert([
        ["1", "name", "Alice"],
        ["1", "age", 12],
        ["2", "name", "Bob"],
        ["2", "age", 16],
        ["3", "hobby", "reading"],
        ["3", "name", "Charlie"],
        ["3", "age", 61],
        ["3", "hobby", "reading"],
      ]);
    });

    it("should apply simple rules when conditions are met", async () => {
      // Define a rule: if someone is 18 or older, they are an adult
      db.when([["?id", "age", "?age"]], (context) => {
        if (context && context.age >= 18) {
          return [[context.id, "status", "adult"]];
        }
      });

      const results = await db.queryOnce([["?id", "status", "adult"]]);

      expect(results).toEqual([{ id: "3" }]); // Charlie is 35
    });

    it("should apply rules with multiple conditions", async () => {
      // Define a rule: if someone is over 18 and are a reader, they are eligible
      db.when(
        [
          ["?id", "age", "?age"],
          ["?id", "hobby", "reading"],
        ],
        (context) => {
          if (context && context.age > 60) {
            return [[context.id, "seniorReader", true]];
          }
        }
      );

      const results = await db.queryOnce([["?id", "seniorReader", true]]);

      expect(results).toEqual([
        { id: "3" }, // Charlie is 61 and a reader
      ]);
    });

    it("should not apply rules when conditions are not met", async () => {
      // Define a rule: if someone is over 100, they are a centenarian
      db.when([["?id", "age", "?age"]], (context) => {
        if (context && context.age > 100) {
          return [[context.id, "status", "centenarian"]];
        }
      });

      const results = await db.queryOnce([["?id", "status", "centenarian"]]);

      expect(results).toEqual([]); // No one is over 40
    });

    it("should apply rules when new facts are added", async () => {
      // Define a rule: if someone is over 18, they are an adult
      db.when([["?id", "age", "?age"]], (context) => {
        if (context.age >= 18) {
          return [[context.id, "status", "adult"]];
        }
      });

      // Initially only Charlie should be adult
      let results = await db.queryOnce([["?id", "status", "adult"]]);
      expect(results).toEqual([{ id: "3" }]);

      // Add a new person over 18
      db.assert([
        ["4", "name", "David"],
        ["4", "age", 45],
      ]);

      // Now David should also be marked as adult
      results = await db.queryOnce([["?id", "status", "adult"]]);

      expect(results).toEqual([
        { id: "3" }, // Charlie
        { id: "4" }, // David
      ]);
    });

    it("should handle rules that add multiple facts", async () => {
      // Define a rule that adds multiple facts
      db.when([["?id", "age", "?age"]], (context) => {
        if (context.age >= 18) {
          return [
            [context.id, "status", "adult"],
            [context.id, "canVote", true],
            [context.id, "seniorDiscount", false],
          ];
        }
      });

      let results: any[] = await db.queryOnce([["?id", "status", "adult"]]);
      expect(results).toEqual([{ id: "3" }]);

      let voteResults: any[] = await db.queryOnce([["?id", "canVote", true]]);
      expect(voteResults).toEqual([{ id: "3" }]);

      let discountResults: any[] = [];
      db.query([["?id", "seniorDiscount", false]], (contexts) => {
        discountResults = contexts;
      });
      expect(discountResults).toEqual([{ id: "3" }]);
    });

    it("should handle multiple rules", async () => {
      // Rule 1: Over 18 is adult
      db.when([["?id", "age", "?age"]], (context) => {
        if (context.age >= 18) {
          return [[context.id, "status", "adult"]];
        }
      });

      // Rule 2: Adults can vote
      db.when([["?id", "status", "adult"]], (context) => {
        if (context) {
          return [[context.id, "canVote", true]];
        }
      });

      const results: any[] = await db.queryOnce([["?id", "canVote", true]]);

      expect(results).toEqual([{ id: "3" }]); // Charlie is adult and can vote
    });

    it("should handle chained rules", async () => {
      // Rule 1: 18 or older is adult
      db.when([["?id", "age", "?age"]], (context) => {
        if (context && context.age >= 18) {
          return [[context.id, "status", "adult"]];
        }
      });

      // Rule 2: Adults are eligible
      db.when([["?id", "status", "adult"]], (context) => {
        if (context) {
          return [[context.id, "eligible", true]];
        }
      });

      // Rule 3: Eligible people can apply
      db.when([["?id", "eligible", true]], (context) => {
        if (context) {
          return [[context.id, "canApply", true]];
        }
      });

      const results: any[] = await db.queryOnce([["?id", "canApply", true]]);

      expect(results).toEqual([{ id: "3" }]); // Charlie: 35 -> adult -> eligible -> canApply
    });

    it("should handle rules with complex conditions", async () => {
      // Add some additional data
      db.assert([
        ["1", "city", "New York"],
        ["2", "city", "Boston"],
        ["3", "city", "New York"],
      ]);

      // Rule: People over 60 in New York get a metro card
      db.when(
        [
          ["?id", "age", "?age"],
          ["?id", "city", "New York"],
        ],
        (context) => {
          if (context.age > 60) {
            return [[context.id, "metroCard", true]];
          }
        }
      );

      const results: any[] = await db.queryOnce([["?id", "metroCard", true]]);

      expect(results).toEqual([{ id: "3" }]); // Only Charlie is over 60 and in NY
    });

    it("should handle rules that depend on variables from multiple patterns", async () => {
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
            return [[context.id, "highEarner", true]];
          }
        }
      );

      let results: any[] = await db.queryOnce([["?id", "highEarner", true]]);
      expect(results).toEqual([{ id: "3" }]); // Charlie: 35 years, 70000 salary
    });

    it("should handle rules that are added after data exists", async () => {
      // Add data first
      db.assert([
        ["4", "name", "David"],
        ["4", "age", 70],
      ]);

      // Then add rule
      db.when([["?id", "age", "?age"]], (context) => {
        if (context.age > 60) {
          return [[context.id, "status", "senior"]];
        }
      });

      const results: any[] = await db.queryOnce([["?id", "status", "senior"]]);

      expect(results).toEqual([{ id: "3" }, { id: "4" }]); // David should be marked as senior
    });

    it("should handle rules that use bound variables in conditions", async () => {
      // Rule: If someone is over 30 and their name starts with 'C', they are special
      db.when(
        [
          ["?id", "age", "?age"],
          ["?id", "name", "?name"],
        ],
        (context) => {
          if (context.age > 30 && context.name.startsWith("C")) {
            return [[context.id, "special", true]];
          }
        }
      );

      const results: any[] = await db.queryOnce([["?id", "special", true]]);

      expect(results).toEqual([{ id: "3" }]); // Charlie: 35 years, name starts with 'C'
    });

    it("should prevent infinite loops in rule evaluation", async () => {
      // This rule could potentially cause infinite loops if not handled properly
      // It should only add the fact once per entity
      db.when([["?id", "name", "?name"]], (context) => {
        // Only add if not already present
        let existing: any[] = [];
        db.query([["?id", "hasName", true]], (contexts) => {
          existing = contexts;
        });
        const alreadyExists = existing.some(
          (result) => result.id === context.id
        );
        if (!alreadyExists) {
          return [[context.id, "hasName", true]];
        }
      });

      const results: any[] = await db.queryOnce([["?id", "hasName", true]]);

      expect(results).toEqual([{ id: "1" }, { id: "2" }, { id: "3" }]);
    });
  });

  describe("async rules", () => {
    beforeEach(() => {
      // Setup test data
      db.assert([
        ["1", "name", "Alice"],
        ["1", "age", 25],
        ["2", "name", "Bob"],
        ["2", "age", 30],
        ["3", "name", "Charlie"],
        ["3", "age", 35],
        ["1", "city", "New York"],
        ["2", "city", "Boston"],
        ["3", "city", "Chicago"],
      ]);
    });

    it("should handle simple async rules", async () => {
      // Define an async rule: if someone is over 25, they are mature
      db.when([["?id", "age", "?age"]], async (context) => {
        if (context.age > 25) {
          // Simulate async operation
          await pause(10);
          return [[context.id, "mature", true]];
        }
        return [];
      });

      const results = await db.queryOnce([["?id", "mature", true]]);

      expect(results).toEqual([
        { id: "2" }, // Bob is 30
        { id: "3" }, // Charlie is 35
      ]);
    });

    it("should handle async rules that return multiple facts", async () => {
      // Define an async rule that adds multiple facts
      db.when([["?id", "age", "?age"]], async (context) => {
        if (context.age >= 30) {
          await pause(5);
          return [
            [context.id, "status", "senior"],
            [context.id, "canVote", true],
            [context.id, "seniorDiscount", true],
          ];
        }
        return [];
      });

      const results = await db.queryOnce([["?id", "status", "senior"]]);
      expect(results).toEqual([
        { id: "2" }, // Bob is 30
        { id: "3" }, // Charlie is 35
      ]);

      const voteResults = await db.queryOnce([["?id", "canVote", true]]);
      expect(voteResults).toEqual([{ id: "2" }, { id: "3" }]);

      const discountResults = await db.queryOnce([
        ["?id", "seniorDiscount", true],
      ]);
      expect(discountResults).toEqual([{ id: "2" }, { id: "3" }]);
    });

    it("should handle async rules with complex conditions", async () => {
      // Simulate async validation
      const isValidCity = async (city: string) => {
        await pause(10);
        return ["New York", "Boston"].includes(city);
      };

      // Define an async rule with complex logic
      db.when(
        [
          ["?id", "age", "?age"],
          ["?id", "city", "?city"],
        ],
        async (context) => {
          if (await isValidCity(context.city)) {
            return [[context.id, "eligible", true]];
          }
          return [];
        }
      );

      const results = await db.queryOnce([["?id", "eligible", true]]);

      expect(results).toEqual([
        { id: "1" }, // Alice: 25, New York
        { id: "2" }, // Bob: 30, Boston
      ]);
    });

    it("should handle async rules that depend on external data", async () => {
      // Simulate external API call
      const mockApiCall = async (name: string): Promise<number> => {
        await pause(10);
        const scores: Record<string, number> = {
          Alice: 85,
          Bob: 92,
          Charlie: 78,
        };
        return scores[name] || 0;
      };

      // Define an async rule that fetches external data
      db.when([["?id", "name", "?name"]], async (context) => {
        const score = await mockApiCall(context.name);
        if (score >= 80) {
          return [[context.id, "highPerformer", true]];
        }
        return [];
      });

      const results = await db.queryOnce([["?id", "highPerformer", true]]);

      expect(results).toEqual([
        { id: "1" }, // Alice: 85
        { id: "2" }, // Bob: 92
      ]);
    });

    it("should handle async rules that return empty arrays", async () => {
      // Define an async rule that sometimes returns nothing
      db.when([["?id", "age", "?age"]], async (context) => {
        await pause(5);
        if (context.age < 20) {
          return [[context.id, "minor", true]];
        }
        return []; // Return empty array for adults
      });

      const results = await db.queryOnce([["?id", "minor", true]]);

      expect(results).toEqual([]); // No one is under 20
    });

    it("should handle async rules that return undefined", async () => {
      // Define an async rule that returns undefined
      db.when([["?id", "age", "?age"]], async (context) => {
        await pause(5);
        if (context.age > 40) {
          return [[context.id, "veteran", true]];
        }
        // Return undefined for others
      });

      const results = await db.queryOnce([["?id", "veteran", true]]);

      expect(results).toEqual([]); // No one is over 40
    });

    it("should handle multiple async rules working together", async () => {
      // Rule 1: Async rule for age-based classification
      db.when([["?id", "age", "?age"]], async (context) => {
        await pause(10);
        if (context.age >= 30) {
          return [[context.id, "category", "senior"]];
        } else if (context.age >= 25) {
          return [[context.id, "category", "mid"]];
        }
      });

      // Rule 2: Async rule that depends on category
      db.when([["?id", "category", "?category"]], async (context) => {
        await pause(5);
        if (context.category === "senior") {
          return [[context.id, "benefits", "full"]];
        } else if (context.category === "mid") {
          return [[context.id, "benefits", "partial"]];
        }
      });

      const seniorResults = await db.queryOnce([["?id", "category", "senior"]]);
      expect(seniorResults).toEqual([
        { id: "2" }, // Bob: 30
        { id: "3" }, // Charlie: 35
      ]);

      const midResults = await db.queryOnce([["?id", "category", "mid"]]);
      expect(midResults).toEqual([
        { id: "1" }, // Alice: 25
      ]);

      const fullBenefits = await db.queryOnce([["?id", "benefits", "full"]]);
      expect(fullBenefits).toEqual([{ id: "2" }, { id: "3" }]);

      const partialBenefits = await db.queryOnce([
        ["?id", "benefits", "partial"],
      ]);
      expect(partialBenefits).toEqual([{ id: "1" }]);
    });

    it("should handle async rules with error handling", async () => {
      // Define an async rule that might fail
      db.when([["?id", "name", "?name"]], async (context) => {
        try {
          await pause(10);

          // Simulate potential failure
          if (context.name === "Charlie") {
            throw new Error("Processing failed for Charlie");
          }

          return [[context.id, "processed", true]];
        } catch (error) {
          // Return empty array on error
          return [];
        }
      });

      const results = await db.queryOnce([["?id", "processed", true]]);

      expect(results).toEqual([
        { id: "1" }, // Alice: processed successfully
        { id: "2" }, // Bob: processed successfully
      ]);
      // Charlie should not appear due to error
    });

    it("should handle async rules that are added after data exists", async () => {
      // Add new data first
      db.assert([
        ["4", "name", "David"],
        ["4", "age", 28],
      ]);

      // Then add async rule
      db.when([["?id", "age", "?age"]], async (context) => {
        await pause(10);
        if (context.age >= 25) {
          return [[context.id, "qualified", true]];
        }
      });

      const results = await db.queryOnce([["?id", "qualified", true]]);

      expect(results).toEqual([
        { id: "1" }, // Alice: 25
        { id: "2" }, // Bob: 30
        { id: "3" }, // Charlie: 35
        { id: "4" }, // David: 28
      ]);
    });

    it("should handle async rules with mixed sync and async operations", async () => {
      // Define a rule that mixes sync and async operations
      db.when(
        [
          ["?id", "age", "?age"],
          ["?id", "city", "?city"],
        ],
        async (context) => {
          // Sync operation
          const isMajorCity = ["New York", "Boston", "Chicago"].includes(
            context.city
          );

          if (!isMajorCity) {
            return []; // Early return for non-major cities
          }

          // Async operation
          await pause(10);

          if (context.age >= 30) {
            return [[context.id, "seniorCitizen", true]];
          } else if (context.age >= 25) {
            return [[context.id, "youngProfessional", true]];
          }
        }
      );

      const seniorResults = await db.queryOnce([
        ["?id", "seniorCitizen", true],
      ]);
      expect(seniorResults).toEqual([
        { id: "2" }, // Bob: 30, Boston
        { id: "3" }, // Charlie: 35, Chicago
      ]);

      const youngResults = await db.queryOnce([
        ["?id", "youngProfessional", true],
      ]);
      expect(youngResults).toEqual([
        { id: "1" }, // Alice: 25, New York
      ]);
    });

    it("should handle async rules with database queries", async () => {
      // Simulate async database lookup
      const mockDbLookup = async (city: string): Promise<string[]> => {
        await pause(15);
        const amenities: Record<string, string[]> = {
          "New York": ["subway", "parks", "museums"],
          Boston: ["subway", "universities"],
          Chicago: ["subway", "lakes"],
        };
        return amenities[city] || [];
      };

      // Define an async rule that queries external database
      db.when([["?id", "city", "?city"]], async (context) => {
        const amenities = await mockDbLookup(context.city);

        return amenities.map((amenity) => [context.id, "hasAmenity", amenity]);
      });

      const subwayResults = await db.queryOnce([
        ["?id", "hasAmenity", "subway"],
      ]);
      expect(subwayResults).toEqual([
        { id: "1" }, // Alice: New York
        { id: "2" }, // Bob: Boston
        { id: "3" }, // Charlie: Chicago
      ]);

      const parksResults = await db.queryOnce([["?id", "hasAmenity", "parks"]]);
      expect(parksResults).toEqual([
        { id: "1" }, // Alice: New York
      ]);

      const universitiesResults = await db.queryOnce([
        ["?id", "hasAmenity", "universities"],
      ]);
      expect(universitiesResults).toEqual([
        { id: "2" }, // Bob: Boston
      ]);
    });

    it("should handle async rules with conditional async operations", async () => {
      // Define an async rule with conditional async operations
      db.when([["?id", "age", "?age"]], async (context) => {
        if (context.age >= 30) {
          // Only perform async operation for seniors
          await pause(20);
          return [[context.id, "seniorStatus", "confirmed"]];
        } else if (context.age >= 25) {
          // Quick sync operation for young adults
          return [[context.id, "youngAdultStatus", "confirmed"]];
        }
      });

      const seniorResults = await db.queryOnce([
        ["?id", "seniorStatus", "confirmed"],
      ]);
      expect(seniorResults).toEqual([
        { id: "2" }, // Bob: 30
        { id: "3" }, // Charlie: 35
      ]);

      const youngResults = await db.queryOnce([
        ["?id", "youngAdultStatus", "confirmed"],
      ]);
      expect(youngResults).toEqual([
        { id: "1" }, // Alice: 25
      ]);
    });

    it("should handle async rules that modify existing facts", async () => {
      // Add some initial computed facts
      db.when([["?id", "age", "?age"]], (context) => {
        if (context.age >= 25) {
          return [[context.id, "status", "adult"]];
        }
      });

      // Add async rule that modifies the status
      db.when([["?id", "status", "adult"]], async (context) => {
        await pause(10);
        return [[context.id, "status", "verified_adult"]];
      });

      const results = await db.queryOnce([["?id", "status", "verified_adult"]]);

      expect(results).toEqual([
        { id: "1" }, // Alice: 25
        { id: "2" }, // Bob: 30
        { id: "3" }, // Charlie: 35
      ]);
    });
  });
});
