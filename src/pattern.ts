export type Triple = [Id, string, any];
export type Variable = `?${string}`;
export type Id = string;

export type Pattern = [Variable | Id, Variable | string, any];

export type Context = Record<string, any> | null;

export const queryPatterns = (
  patterns: Pattern[],
  triples: Triple[],
  context: Context = {}
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
): Context => {
  const [patternSubject, patternPredicate, patternObject] = pattern;
  const [tripleSubject, triplePredicate, tripleObject] = triple;

  context = matchPart(patternSubject, tripleSubject, context);
  if (!context) return null;

  context = matchPart(patternPredicate, triplePredicate, context);
  if (!context) return null;

  context = matchPart(patternObject, tripleObject, context);
  if (!context) return null;

  return context;
};

const isVariable = (part: any): part is Variable =>
  typeof part === "string" && part.startsWith("?");

const matchPart = (
  patternPart: Variable | Id | string | any,
  triplePart: any,
  context: Context
): Context => {
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
): Context => {
  const variableName = variable.slice(1);

  if (context && context.hasOwnProperty(variableName)) {
    const bound = context[variableName];
    return matchPart(bound, triplePart, context);
  }

  return { ...context, [variableName]: triplePart };
};
