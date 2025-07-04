export type Triple = [Id, string, any];
export type Variable = `?${string}`;
export type Id = string;

export type Pattern = [Variable | Id, Variable | string, any];

export type Context = Record<string, any>;

export const queryPatterns = (
  patterns: Pattern[],
  triples: Triple[]
): Context[] => {
  return patterns.reduce(
    (contexts: Context[], pattern) =>
      contexts.flatMap((ctx) => queryPattern(pattern, triples, ctx)),
    [{}]
  );
};

export const queryPattern = (
  pattern: Pattern,
  triples: Triple[],
  context: Context = {}
): Context[] =>
  triples
    .map((triple) => matchPattern(pattern, triple, context))
    .filter((context) => context !== null);

export const matchPattern = (
  pattern: Pattern,
  triple: Triple,
  context: Context = {}
): Context | null => {
  const [patternSubject, patternPredicate, patternObject] = pattern;
  const [tripleSubject, triplePredicate, tripleObject] = triple;

  let newContext: Context | null = context;

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

const matchPart = (
  patternPart: Variable | Id | string | any,
  triplePart: any,
  context: Context
): Context | null => {
  if (!context) {
    return null;
  }

  if (isVariable(patternPart)) {
    return matchVariable(patternPart, triplePart, context);
  }

  return patternPart === triplePart ? context : null;
};

const matchVariable = (
  variable: Variable,
  triplePart: any,
  context: Context
): Context | null => {
  const variableName = variable.slice(1);

  if (context && context.hasOwnProperty(variableName)) {
    const bound = context[variableName];
    return matchPart(bound, triplePart, context);
  }

  return { ...context, [variableName]: triplePart };
};
