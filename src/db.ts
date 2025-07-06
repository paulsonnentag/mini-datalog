// db.ts

import {
  Pattern,
  queryPatterns,
  Statement,
  Field,
  ObjectId,
  $,
} from "./pattern";

export type StatementMap = Map<ObjectId, Map<string, any[]>>;

// Typed callback for rules
export type RuleCallback<P extends readonly Pattern<any, any, any>[]> = (
  match: ReturnType<typeof queryPatterns<P>>[0]
) => Promise<Statement[] | undefined> | Statement[] | undefined;

// Typed rule definition
export type Rule<P extends readonly Pattern<any, any, any>[]> = {
  patterns: P;
  callback: RuleCallback<P>;
};

// Typed callback for queries
export type QueryCallback<P extends readonly Pattern<any, any, any>[]> = (
  match: ReturnType<typeof queryPatterns<P>>
) => void;

// Typed query definition
export type Query<P extends readonly Pattern<any, any, any>[]> = {
  patterns: P;
  callback: QueryCallback<P>;
};

export class DB {
  #base: StatementMap = new Map();
  #computed: StatementMap = new Map();
  #rules = new Set<Rule<any>>();
  #queries = new Set<Query<any>>();
  #epoch = 0;
  #isProcessing = false;

  constructor(statements: Statement[] = []) {
    this.assert(statements);
  }

  assert(statements: Statement[]): () => void {
    const newAsserts: Statement[] = [];

    for (const statement of statements) {
      if (this.#assertStatement(statement, false)) {
        newAsserts.push(statement);
      }
    }

    this.#recompute();

    return () => {
      this.retract(newAsserts);
    };
  }

  #assertStatement(statement: Statement, isComputed: boolean): boolean {
    const [id, fieldValue] = statement;
    const { field, value } = fieldValue;

    const state = isComputed ? this.#computed : this.#base;

    // Get or create the map for this ID
    if (!state.has(id)) {
      state.set(id, new Map());
    }
    const entity = state.get(id)!;

    // Get or create the array for this field
    if (!entity.has(field.key)) {
      entity.set(field.key, []);
    }
    const values = entity.get(field.key)!;

    // Add the value if it's not already there
    if (!values.includes(value)) {
      values.push(value);
      return true;
    }

    return false;
  }

  retract(statements: Statement[]) {
    for (const statement of statements) {
      this.#retractStatement(statement);
    }

    this.#recompute();
  }

  #retractStatement(statement: Statement) {
    const [id, fieldValue] = statement;
    const { field, value } = fieldValue;

    if (!this.#base.has(id)) {
      return;
    }

    const idMap = this.#base.get(id)!;
    if (!idMap.has(field.key)) {
      return;
    }

    const values = idMap.get(field.key)!;
    const index = values.indexOf(value);
    if (index !== -1) {
      values.splice(index, 1);

      // Remove the field map if it's empty
      if (values.length === 0) {
        idMap.delete(field.key);
      }

      // Remove the ID map if it's empty
      if (idMap.size === 0) {
        this.#base.delete(id);
      }
    }
  }

  async #recompute() {
    const epoch = ++this.#epoch;
    let hasAddedFacts: boolean = false;

    this.#isProcessing = true;
    this.#computed = new Map();

    do {
      const statements = this.statements();

      const computedAssertions = (
        await Promise.all(
          Array.from(this.#rules).map(async ({ patterns, callback }) => {
            const contexts = queryPatterns(patterns, statements);

            const assertions = (
              await Promise.all(
                contexts.map(async (context) => (await callback(context)) ?? [])
              )
            ).flat();

            return assertions;
          })
        )
      ).flat();

      // if recompute was called in the meantime, stop
      if (epoch !== this.#epoch) {
        return;
      }

      hasAddedFacts = false;

      for (const assertion of computedAssertions) {
        if (this.#assertStatement(assertion, true)) {
          hasAddedFacts = true;
        }
      }
    } while (hasAddedFacts);

    this.#isProcessing = false;

    for (const query of this.#queries) {
      this.#runQuery(query);
    }
  }

  // Typed when method
  when<const P extends readonly Pattern<any, any, any>[]>(
    patterns: P,
    callback: RuleCallback<P>
  ): () => void {
    const rule: Rule<P> = { patterns, callback };

    this.#rules.add(rule);
    this.#recompute();

    return () => {
      this.#rules.delete(rule);
      this.#recompute();
    };
  }

  query<const P extends readonly Pattern<any, any, any>[]>(
    patterns: P,
    callback: QueryCallback<P>
  ): () => void {
    const query: Query<P> = { patterns, callback };
    this.#queries.add(query);

    if (!this.#isProcessing) {
      this.#runQuery(query);
    }

    return () => {
      this.#queries.delete(query);
    };
  }

  async queryOnce<const P extends readonly Pattern<any, any, any>[]>(
    patterns: P
  ): Promise<ReturnType<typeof queryPatterns<P>>> {
    return new Promise((resolve) => {
      let unsubscribe: (() => void) | undefined;

      unsubscribe = this.query(patterns, (contexts) => {
        if (unsubscribe) {
          unsubscribe();
        }

        resolve(contexts);
      });
    });
  }

  #runQuery<P extends readonly Pattern<any, any, any>[]>(query: Query<P>) {
    const matches = queryPatterns(query.patterns, this.statements());
    query.callback(matches);
  }

  statements(): Statement[] {
    const statements: Statement[] = [];

    for (const [id, idMap] of this.#base) {
      for (const [fieldKey, values] of idMap) {
        for (const value of values) {
          // We need to reconstruct the field - this is a limitation since we only store the key
          // In a real implementation, you might want to store the actual Field objects
          const field = new Field(fieldKey);
          statements.push([id, field.of(value)]);
        }
      }
    }

    for (const [id, idMap] of this.#computed) {
      for (const [fieldKey, values] of idMap) {
        for (const value of values) {
          const field = new Field(fieldKey);
          statements.push([id, field.of(value)]);
        }
      }
    }

    return statements;
  }

  state(): Statement[] {
    return this.statements();
  }
}
