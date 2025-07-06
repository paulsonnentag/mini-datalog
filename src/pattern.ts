import { Field, Triple } from "./db";

export type Id = string | number;

export type Variable = `?${string}`;

// Extract variable name from variable string
type VariableName<T> = T extends `?${infer Name}` ? Name : never;

// Single pattern: [subject, predicate, object]
export type Pattern<S = any, P = any, O = any> = [S, P, O];

// Helper type to extract Field's generic type
type ExtractFieldType<F> = F extends Field<infer T> ? T : never;

// Extract variables and their types from a single pattern
type ExtractVariables<Pat> = Pat extends Pattern<infer S, infer P, infer O>
  ? (S extends Variable ? { [K in VariableName<S>]: Id } : {}) &
      (P extends Variable ? { [K in VariableName<P>]: string } : {}) &
      (O extends Variable
        ? P extends Field<any>
          ? { [K in VariableName<O>]: ExtractFieldType<P> }
          : { [K in VariableName<O>]: unknown }
        : {})
  : {};

// Merge variables from multiple patterns
type MergeVariables<Patterns extends readonly unknown[]> =
  Patterns extends readonly [infer First, ...infer Rest]
    ? ExtractVariables<First> & MergeVariables<Rest>
    : {};

// Typed Context based on patterns
export type Context<
  P extends readonly Pattern<any, any, any>[] = Pattern<any, any, any>[]
> = P extends readonly Pattern<any, any, any>[]
  ? MergeVariables<P>
  : Record<string, any>;

// Updated function signatures with proper typing
export const queryPatterns = <
  const P extends readonly Pattern<any, any, any>[]
>(
  patterns: P,
  triples: Triple[]
): Context<P>[] => {
  return patterns.reduce(
    (contexts: Context<P>[], pattern) =>
      contexts.flatMap(
        (ctx) => queryPattern(pattern, triples, ctx) as Context<P>[]
      ),
    [{}] as Context<P>[]
  );
};

export const queryPattern = <const P extends Pattern<any, any, any>>(
  pattern: P,
  triples: Triple[],
  context: Context<[P]> = {} as Context<[P]>
): Context<[P]>[] =>
  triples
    .map((triple) => matchPattern(pattern, triple, context))
    .filter((context): context is Context<[P]> => context !== null);

export const matchPattern = <const P extends Pattern<any, any, any>>(
  pattern: P,
  triple: Triple,
  context: Context<[P]> = {} as Context<[P]>
): Context<[P]> | null => {
  const [patternSubject, patternPredicate, patternObject] = pattern;
  const [tripleSubject, triplePredicate, tripleObject] = triple;

  let newContext: Context<[P]> | null = context;

  newContext = matchPart(patternSubject, tripleSubject, newContext);
  if (!newContext) return null;

  newContext = matchPart(patternPredicate, triplePredicate, newContext);
  if (!newContext) return null;

  newContext = matchPart(patternObject, tripleObject, newContext);
  if (!newContext) return null;

  return newContext;
};

const isVariable = (part: any): part is Variable =>
  typeof part === "string" && part.startsWith("?");

const matchPart = <T>(
  patternPart: Variable | Id | string | any,
  triplePart: any,
  context: T
): T | null => {
  if (!context) {
    return null;
  }

  if (isVariable(patternPart)) {
    return matchVariable(patternPart, triplePart, context);
  }

  return patternPart === triplePart ? context : null;
};

const matchVariable = <T>(
  variable: Variable,
  triplePart: any,
  context: T
): T | null => {
  const variableName = variable.slice(1);

  if (context && (context as any).hasOwnProperty(variableName)) {
    const bound = (context as any)[variableName];
    return matchPart(bound, triplePart, context);
  }

  return { ...context, [variableName]: triplePart } as T;
};

const $name = new Field<string>("name");
const $age = new Field<number>("age");

// Example 1: Using a string field
const result = matchPattern(["?person", $name, "?name"], ["1", $name, "Alice"]);

// Example 2: Using a number field
const result2 = matchPattern(["?person", $age, "?age"], ["1", $age, 10]);
