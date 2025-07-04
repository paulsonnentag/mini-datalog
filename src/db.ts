import { Context, Id, Pattern, queryPatterns, Triple } from "./pattern";

type State = Map<Id, Map<string, any[]>>;

type Rule = {
  condition: Pattern[];
  effect: (context: Context) => Promise<void> | void;
};

class DB {
  #base: State = new Map();
  #all: State = new Map();

  #isEvaluatingRule = false;
  #addedFacts = 0;
  #rules: Rule[] = [];

  constructor(triples: Triple[] = []) {
    this.assert(triples);
  }

  assert(triples: Triple[]): () => void {
    const effectivelyAsserted: Triple[] = [];

    for (const triple of triples) {
      const [id, attribute, value] = triple;

      const state = this.#isEvaluatingRule ? this.#all : this.#base;

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
        this.#addedFacts++;
        effectivelyAsserted.push(triple);
      }
    }

    if (!this.#isEvaluatingRule) {
      this.recompute();
    }

    return () => {
      this.retract(effectivelyAsserted);
    };
  }

  retract(triples: Triple[]) {
    if (this.#isEvaluatingRule) {
      throw new Error("Cannot retract facts in when block");
    }

    for (const triple of triples) {
      const [id, attribute, value] = triple;

      if (!this.#base.has(id)) {
        continue;
      }

      const idMap = this.#base.get(id)!;
      if (!idMap.has(attribute)) {
        continue;
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

    this.recompute();
  }

  recompute() {
    this.#all = structuredClone(this.#base);

    this.#isEvaluatingRule = true;

    do {
      this.#addedFacts = 0;

      const triples = this.triples();

      this.#rules.forEach(({ condition, effect }) => {
        const contexts = queryPatterns(condition, triples);

        contexts.forEach((context) => effect(context));
      });
    } while (this.#addedFacts > 0);

    this.#isEvaluatingRule = false;
  }

  when(
    condition: Pattern[],
    effect: (context: Context) => Promise<void> | void
  ) {
    this.#rules.push({ condition, effect });
    this.recompute();
  }

  query(patterns: Pattern[]) {
    return queryPatterns(patterns, this.triples());
  }

  triples(): Triple[] {
    const triples: Triple[] = [];

    for (const [id, idMap] of this.#all) {
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

export { DB, type Triple, type Id };
