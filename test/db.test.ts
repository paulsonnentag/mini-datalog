import { describe, it, expect, beforeEach } from "vitest";
import { DB } from "../src/db.js";
import { $, defineField } from "../src/pattern.js";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const hasName = defineField<string>("name");
const hasAge = defineField<number>("age");
const hasHobby = defineField<string>("hobby");
const hasTag = defineField<string>("tag");
const livesIn = defineField<string>("livesIn");
const ALICE = "1";
const BOB = "2";
const CHARLIE = "3";
const DAVID = "4";

describe("DB", () => {
  let db: DB;

  beforeEach(() => {
    db = new DB([
      [ALICE, hasName("Alice")],
      [ALICE, hasAge(14)],
      [ALICE, hasHobby("reading")],
      [ALICE, livesIn("New York")],
      [BOB, hasName("Bob")],
      [BOB, hasAge(17)],
      [BOB, hasHobby("swimming")],
      [BOB, livesIn("Los Angeles")],
      [CHARLIE, hasName("Charlie")],
      [CHARLIE, hasAge(61)],
      [CHARLIE, hasHobby("reading")],
      [CHARLIE, livesIn("New York")],
    ]);
  });

  describe("assert and retract", () => {
    it("should allow to assert statements", () => {
      // start with empty db
      const db = new DB();

      db.assert([
        [ALICE, hasName("Alice")],
        [ALICE, hasAge(14)],
        [ALICE, hasHobby("reading")],
        [ALICE, hasHobby("swimming")],
        [BOB, hasName("Bob")],
      ]);

      const expected = [
        [ALICE, "name", "Alice"],
        [ALICE, "age", 14],
        [ALICE, "hobby", "reading"],
        [ALICE, "hobby", "swimming"],
        [BOB, "name", "Bob"],
      ];

      expect(db.inspect()).toEqual(expect.arrayContaining(expected));
      expect(db.inspect()).toHaveLength(expected.length);
    });

    it("should allow to retract statements", () => {
      // start with empty db
      const db = new DB();

      // assert some statements
      db.assert([
        [ALICE, hasName("Alice")],
        [ALICE, hasAge(14)],
        [ALICE, hasHobby("reading")],
        [ALICE, hasHobby("swimming")],
        [BOB, hasName("Bob")],
      ]);

      // retract some statements
      db.retract([
        [ALICE, hasAge(14)],
        [ALICE, hasHobby("reading")],
        [BOB, hasName("Bob")],
      ]);

      const expected = [
        [ALICE, "name", "Alice"],
        [ALICE, "hobby", "swimming"],
      ];

      expect(db.inspect()).toEqual(expect.arrayContaining(expected));
      expect(db.inspect()).toHaveLength(expected.length);
    });

    it("should not add statements multiple times", () => {
      // start with empty db
      const db = new DB();

      // assert same statement multiple times
      db.assert([
        [ALICE, hasName("Alice")],
        [ALICE, hasName("Alice")],
        [ALICE, hasName("Alice")],
      ]);

      db.assert([[ALICE, hasName("Alice")]]);

      const expected = [[ALICE, "name", "Alice"]];

      expect(db.inspect()).toEqual(expect.arrayContaining(expected));
      expect(db.inspect()).toHaveLength(expected.length);
    });

    it("should not change state when retracting non-existent statements", () => {
      // start with empty db
      const db = new DB();

      // set up initial state
      db.assert([
        [ALICE, hasName("Alice")],
        [ALICE, hasAge(14)],
        [BOB, hasName("Bob")],
      ]);

      // retract non-existent statemsnts
      db.retract([
        [ALICE, hasAge(30)],
        [BOB, hasName("Frank")],
      ]);

      const expected = [
        [ALICE, "name", "Alice"],
        [ALICE, "age", 14],
        [BOB, "name", "Bob"],
      ];

      expect(db.inspect()).toEqual(expect.arrayContaining(expected));
      expect(db.inspect()).toHaveLength(expected.length);
    });

    it("should return a retract function from assert that retracts only the effectively asserted statements", () => {
      // start with empty db
      const db = new DB();

      db.assert([
        [ALICE, hasName("Alice")],
        [ALICE, hasAge(30)],
      ]);

      // assert new statements and get the retract function
      const retract = db.assert([
        [BOB, hasName("Bob")],
        [BOB, hasAge(25)],
        [ALICE, hasName("Alice")], // should not be retracted since this fact already existed before the assert
      ]);

      // verify the statements were added
      let expected = [
        [ALICE, "name", "Alice"],
        [ALICE, "age", 30],
        [BOB, "name", "Bob"],
        [BOB, "age", 25],
      ];

      expect(db.inspect()).toEqual(expect.arrayContaining(expected));
      expect(db.inspect()).toHaveLength(expected.length);

      // call the retract function
      retract();

      expected = [
        ["1", "name", "Alice"],
        ["1", "age", 30],
      ];

      expect(db.inspect()).toEqual(expect.arrayContaining(expected));
      expect(db.inspect()).toHaveLength(expected.length);
    });

    it("should handle retracting from empty database", () => {
      const db = new DB();

      db.retract([[ALICE, hasName("Alice")]]);
      expect(db.inspect()).toEqual([]);
    });
  });

  describe("query", () => {
    it("should handle query with variable in field position", async () => {
      const matches = await db.queryOnce([[ALICE, hasName.$("name")]]);

      expect(matches).toEqual([{ name: "Alice" }]);
    });

    it("should handle query with variable in object position", async () => {
      const matches = await db.queryOnce([[$("id"), hasName("Bob")]]);

      expect(matches).toEqual([{ id: BOB }]);
    });

    it("should handle query with variable in object and field position", async () => {
      const matches = await db.queryOnce([[$("id"), hasName.$("name")]]);

      expect(matches).toEqual([
        { id: ALICE, name: "Alice" },
        { id: BOB, name: "Bob" },
        { id: CHARLIE, name: "Charlie" },
      ]);
    });

    it("should handle query with variable in object and field position", async () => {
      const matches = await db.queryOnce([[$("id"), hasName.$("name")]]);

      expect(matches).toEqual([
        { id: ALICE, name: "Alice" },
        { id: BOB, name: "Bob" },
        { id: CHARLIE, name: "Charlie" },
      ]);
    });

    it("should handle queries with no matches", async () => {
      const matches = await db.queryOnce([[$("id"), hasName("David")]]);

      expect(matches).toEqual([]);
    });

    it("should handle query with multiple patterns", async () => {
      const matches = await db.queryOnce([
        [$("id"), hasName.$("name")],
        [$("id"), hasAge.$("age")],
      ]);

      expect(matches).toEqual([
        { id: ALICE, name: "Alice", age: 14 },
        { id: BOB, name: "Bob", age: 17 },
        { id: CHARLIE, name: "Charlie", age: 61 },
      ]);
    });

    it("should handle queries with mixed variable and literal patterns", async () => {
      const matches = await db.queryOnce([
        [$("id"), hasName.$("name")],
        [$("id"), hasAge(14)],
      ]);

      expect(matches).toEqual([{ id: ALICE, name: "Alice" }]);
    });

    it("should handle empty query patterns", async () => {
      const matches = await db.queryOnce([]);

      expect(matches).toEqual([{}]);
    });

    it("should handle query after retracts", async () => {
      // Initial query
      let matches = await db.queryOnce([[$("id"), hasName("Alice")]]);
      expect(matches).toEqual([{ id: ALICE }]);

      // Retract the data
      db.retract([[ALICE, hasName("Alice")]]);

      // Query again - should return no results
      matches = await db.queryOnce([[$("id"), hasName("Alice")]]);
      expect(matches).toEqual([]);
    });

    it("should handle query after asserts", async () => {
      // Initial query
      let matches = await db.queryOnce([
        [$("id"), hasAge(14)],
        [$("id"), hasName.$("name")],
      ]);
      expect(matches).toEqual([{ id: ALICE, name: "Alice" }]);

      // Change age of bob
      db.assert([[BOB, hasAge(14)]]);

      // Query again - should return bob and alice
      matches = await db.queryOnce([
        [$("id"), hasAge(14)],
        [$("id"), hasName.$("name")],
      ]);
      expect(matches).toEqual([
        { id: ALICE, name: "Alice" },
        { id: BOB, name: "Bob" },
      ]);
    });
  });

  describe("rules", () => {
    it("should apply simple rules when conditions are met", async () => {
      // define a rule: if someone is 18 or older, they are an adult
      db.when([[$("id"), hasAge.$("age")]], ({ age, id }) =>
        age >= 18 ? [[id, hasTag("adult")]] : []
      );

      const results = await db.queryOnce([[$("id"), hasTag("adult")]]);

      expect(results).toEqual([{ id: CHARLIE }]); // Charlie is 35
    });

    it("should apply rules with multiple conditions", async () => {
      // define a rule: if someone is over 60 and are a reader, they are a senior reader
      db.when(
        [
          [$("id"), hasAge.$("age")],
          [$("id"), hasHobby("reading")],
        ],
        ({ age, id }) => {
          if (age > 60) {
            return [[id, hasTag("seniorReader")]];
          }
        }
      );

      const results = await db.queryOnce([[$("id"), hasTag("seniorReader")]]);

      expect(results).toEqual([
        { id: "3" }, // Charlie is 61 and a reader
      ]);
    });

    it("should rerun rules when statements change", async () => {
      // define a rule: if someone is over 18, they are an adult
      db.when([[$("id"), hasAge.$("age")]], ({ age, id }) => {
        if (age >= 18) {
          return [[id, hasTag("adult")]];
        }
      });

      // initially only Charlie should be adult
      let results = await db.queryOnce([[$("id"), hasTag("adult")]]);
      expect(results).toEqual([{ id: CHARLIE }]);

      // add a new person over 18
      db.assert([
        [DAVID, hasName("David")],
        [DAVID, hasAge(45)],
      ]);

      // now David should also be marked as adult
      results = await db.queryOnce([[$("id"), hasTag("adult")]]);

      expect(results).toEqual([
        { id: CHARLIE }, // Charlie
        { id: DAVID }, // David
      ]);

      // remove Charlie's age
      db.retract([[CHARLIE, hasAge(61)]]);

      // now only David should be marked as adult
      results = await db.queryOnce([[$("id"), hasTag("adult")]]);

      expect(results).toEqual([
        { id: DAVID }, // David
      ]);
    });

    it("should handle rules that add multiple facts", async () => {
      // define a rule that adds multiple facts
      db.when([[$("id"), hasAge.$("age")]], ({ age, id }) =>
        age >= 18
          ? [
              [id, hasTag("adult")],
              [id, hasTag("canVote")],
            ]
          : []
      );

      let results = await db.queryOnce([[$("id"), hasTag("adult")]]);
      expect(results).toEqual([{ id: CHARLIE }]);

      let voteResults = await db.queryOnce([[$("id"), hasTag("canVote")]]);
      expect(voteResults).toEqual([{ id: CHARLIE }]);
    });

    it("should handle multiple rules", async () => {
      // rule 1: over 18 is adult
      db.when([[$("id"), hasAge.$("age")]], ({ age, id }) =>
        age >= 18 ? [[id, hasTag("adult")]] : []
      );

      // rule 2: over 18 can vote
      db.when([[$("id"), hasAge.$("age")]], ({ age, id }) =>
        age >= 18 ? [[id, hasTag("canVote")]] : []
      );

      const results = await db.queryOnce([
        [$("id"), hasTag("canVote")],
        [$("id"), hasTag("adult")],
      ]);

      expect(results).toEqual([{ id: CHARLIE }]); // Charlie is adult and can vote
    });

    it("should handle chained rules", async () => {
      // rule 1: 18 or older is adult
      db.when([[$("id"), hasAge.$("age")]], ({ age, id }) =>
        age >= 18 ? [[id, hasTag("adult")]] : []
      );

      // rule 2: adults are eligible
      db.when([[$("id"), hasTag("adult")]], ({ id }) => [
        [id, hasTag("eligible")],
      ]);

      // rule 3: Eligible people can apply
      db.when([[$("id"), hasTag("eligible")]], ({ id }) => [
        [id, hasTag("canApply")],
      ]);

      const results = await db.queryOnce([[$("id"), hasTag("canApply")]]);

      expect(results).toEqual([{ id: CHARLIE }]); // Charlie: 35 -> adult -> eligible -> canApply
    });

    it("should handle async rules", async () => {
      // define a rule: if someone is 18 or older, they are an adult
      db.when([[$("id"), hasAge.$("age")]], async ({ age, id }) => {
        if (age >= 18) {
          await pause(100);
          return [[id, hasTag("adult")]];
        }
      });

      const results = await db.queryOnce([[$("id"), hasTag("adult")]]);

      expect(results).toEqual([{ id: CHARLIE }]); // Charlie is 35
    });

    it("should handle chained async rules", async () => {
      // rule 1: 18 or older is adult
      db.when([[$("id"), hasAge.$("age")]], async ({ age, id }) => {
        if (age >= 18) {
          await pause(100);
          return [[id, hasTag("adult")]];
        }
      });

      // rule 2: adults are eligible
      db.when([[$("id"), hasTag("adult")]], async ({ id }) => {
        await pause(100);
        return [[id, hasTag("eligible")]];
      });

      // rule 3: Eligible people can apply
      db.when([[$("id"), hasTag("eligible")]], async ({ id }) => {
        await pause(100);
        return [[id, hasTag("canApply")]];
      });

      const results = await db.queryOnce([[$("id"), hasTag("canApply")]]);

      expect(results).toEqual([{ id: CHARLIE }]); // Charlie: 35 -> adult -> eligible -> canApply
    });
  });
});
