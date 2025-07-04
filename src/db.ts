import { Context, Id, Pattern, queryPatterns, Triple } from "./pattern";

type State = Map<Id, Map<string, any[]>>;

type Rule = {
  condition: Pattern[];
  effect: (context: Context) => void;
};

type EvaluationContext = "rule";

class DB {
  #base: State = new Map();
  #all: State = new Map();

  #evaluationContext: EvaluationContext | null = null;
  #addedFacts = 0;
  #rules: Rule[] = [];

  assert(triple: Triple) {
    const [id, attribute, value] = triple;

    const isEvaluatingRule = this.#evaluationContext === "rule";

    const state = isEvaluatingRule ? this.#all : this.#base;

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
    }

    if (!isEvaluatingRule) {
      this.#recompute();
    }
  }

  retract(triple: Triple) {
    const isEvaluatingRule = this.#evaluationContext === "rule";
    if (isEvaluatingRule) {
      throw new Error("Cannot retract facts in when block");
    }

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

    this.#recompute();
  }

  #recompute() {
    this.#all = structuredClone(this.#base);

    this.#evaluationContext = "rule";

    do {
      this.#addedFacts = 0;

      const triples = this.triples();

      this.#rules.forEach(({ condition, effect }) => {
        const contexts = queryPatterns(condition, triples);

        contexts.forEach((context) => effect(context));
      });
    } while (this.#addedFacts > 0);

    this.#evaluationContext = null;
  }

  when(condition: Pattern[], effect: (context: Context) => void) {
    this.#rules.push({ condition, effect });
    this.#recompute();
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
