import { Context, Pattern, queryPatterns } from "./pattern";

export type Triple = [Id, string, any];
export type Id = string | number;

export type TripleMap = Map<Id, Map<string, any[]>>;

export type RuleCallback = (
  context: Context
) => Promise<Triple[] | undefined> | Triple[] | undefined;

export type Rule = {
  patterns: Pattern[];
  callback: RuleCallback;
};

export type QueryCallback = (contexts: Context[]) => void;

export type Query = {
  patterns: Pattern[];
  callback: QueryCallback;
};

export class DB {
  #base: TripleMap = new Map();
  #computed: TripleMap = new Map();
  #rules = new Set<Rule>();
  #queries = new Set<Query>();
  #epoch = 0;
  #isProcessing = false;

  constructor(triples: Triple[] = []) {
    this.assert(triples);
  }

  assert(triples: Triple[]): () => void {
    const newAsserts: Triple[] = [];

    for (const triple of triples) {
      if (this.#assertTriple(triple, false)) {
        newAsserts.push(triple);
      }
    }

    this.#recompute();

    return () => {
      this.retract(newAsserts);
    };
  }

  #assertTriple(triple: Triple, isComputed: boolean): boolean {
    const [id, attribute, value] = triple;

    const state = isComputed ? this.#computed : this.#base;

    // Get or create the map for this ID
    if (!state.has(id)) {
      state.set(id, new Map());
    }
    const entity = state.get(id)!;

    // Get or create the array for this attribute
    if (!entity.has(attribute)) {
      entity.set(attribute, []);
    }
    const values = entity.get(attribute)!;

    // Add the value if it's not already there
    if (!values.includes(value)) {
      values.push(value);
      return true;
    }

    return false;
  }

  retract(triples: Triple[]) {
    for (const triple of triples) {
      this.#retractTriple(triple);
    }

    this.#recompute();
  }

  #retractTriple(triple: Triple) {
    const [id, attribute, value] = triple;

    if (!this.#base.has(id)) {
      return;
    }

    const idMap = this.#base.get(id)!;
    if (!idMap.has(attribute)) {
      return;
    }

    const values = idMap.get(attribute)!;
    const index = values.indexOf(value);
    if (index !== -1) {
      values.splice(index, 1);

      // Remove the attribute map if it's empty
      if (values.length === 0) {
        idMap.delete(attribute);
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
      const triples = this.triples();

      const computedAssertions = (
        await Promise.all(
          Array.from(this.#rules).map(async ({ patterns, callback }) => {
            const contexts = queryPatterns(patterns, triples);

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
        if (this.#assertTriple(assertion, true)) {
          hasAddedFacts = true;
        }
      }
    } while (hasAddedFacts);

    this.#isProcessing = false;

    for (const query of this.#queries) {
      this.#runQuery(query);
    }
  }

  when(patterns: Pattern[], callback: RuleCallback) {
    const rule: Rule = { patterns, callback };

    this.#rules.add(rule);
    this.#recompute();

    return () => {
      this.#rules.delete(rule);
      this.#recompute();
    };
  }

  query(patterns: Pattern[], callback: QueryCallback) {
    const query: Query = { patterns, callback };
    this.#queries.add(query);

    if (!this.#isProcessing) {
      this.#runQuery(query);
    }

    return () => {
      this.#queries.delete(query);
    };
  }

  async queryOnce(patterns: Pattern[]): Promise<Context[]> {
    return new Promise((resolve) => {
      let unsubscribe: () => void | undefined;

      unsubscribe = this.query(patterns, (contexts) => {
        if (unsubscribe) {
          unsubscribe();
        }

        resolve(contexts);
      });
    });
  }

  #runQuery(query: Query) {
    const triples = queryPatterns(query.patterns, this.triples());
    query.callback(triples);
  }

  triples(): Triple[] {
    const triples: Triple[] = [];

    for (const [id, idMap] of this.#base) {
      for (const [attribute, values] of idMap) {
        for (const value of values) {
          triples.push([id, attribute, value]);
        }
      }
    }

    for (const [id, idMap] of this.#computed) {
      for (const [attribute, values] of idMap) {
        for (const value of values) {
          triples.push([id, attribute, value]);
        }
      }
    }

    return triples;
  }

  state(): Triple[] {
    return this.triples();
  }
}
