export type ObjectId = string | number | Symbol;

type FieldValue<T> = {
  field: Field<T>;
  value: T;
};

type FieldPattern<T, N extends string> = {
  field: Field<T>;
  variable: Variable<N>;
};

export class Field<_T = unknown> {
  constructor(readonly key: string) {}

  of<T>(value: T): FieldValue<T> {
    return { field: this, value };
  }
}

export const defineField = <T>(
  key: string
): {
  (value: T): FieldValue<T>;
  $: <N extends string>(variableName: N) => FieldPattern<T, N>;
} => {
  const field = new Field<T>(key);

  const createField = (value: T): FieldValue<T> => field.of(value);

  createField.$ = <N extends string>(variableName: N) => ({
    field,
    variable: new Variable(variableName),
  });

  return createField;
};

class Variable<N extends string> {
  constructor(readonly name: N) {}
}

export const $ = <N extends string>(name: N) => {
  return new Variable(name);
};

export type Statement<T = unknown> = [ObjectId, FieldValue<T>];

export type Pattern<
  FieldType = unknown,
  IdName extends string = never,
  FieldName extends string = never
> =
  | [ObjectId, FieldPattern<FieldType, FieldName>]
  | [Variable<IdName>, FieldValue<FieldType>]
  | [Variable<IdName>, FieldPattern<FieldType, FieldName>];

// Type inference for extracting match results
type ExtractMatchResult<P> = P extends [
  ObjectId,
  FieldPattern<infer FieldType, infer FieldName>
]
  ? { [K in FieldName]: FieldType }
  : P extends [Variable<infer IdName>, FieldValue<any>]
  ? { [K in IdName]: ObjectId }
  : P extends [
      Variable<infer IdName>,
      FieldPattern<infer FieldType, infer FieldName>
    ]
  ? { [K in IdName]: ObjectId } & { [K in FieldName]: FieldType }
  : never;

// Union type for multiple patterns
type ExtractMatchResults<P extends readonly Pattern<any, any, any>[]> =
  P extends readonly [infer First, ...infer Rest]
    ? First extends Pattern<any, any, any>
      ? Rest extends readonly Pattern<any, any, any>[]
        ? ExtractMatchResult<First> & ExtractMatchResults<Rest>
        : ExtractMatchResult<First>
      : never
    : {};

type Match<P extends readonly Pattern<any, any, any>[]> =
  ExtractMatchResults<P>;

// Updated function signatures with proper typing
export const queryPatterns = <
  const P extends readonly Pattern<any, any, any>[]
>(
  patterns: P,
  statements: Statement[]
): Match<P>[] => {
  return patterns.reduce(
    (contexts: Match<P>[], pattern) =>
      contexts.flatMap(
        (ctx) => queryPattern(pattern, statements, ctx) as Match<P>[]
      ),
    [{}] as Match<P>[]
  );
};

export const queryPattern = <const P extends Pattern<any, any, any>>(
  pattern: P,
  statements: Statement[],
  match: ExtractMatchResult<P> = {} as ExtractMatchResult<P>
): ExtractMatchResult<P>[] =>
  statements
    .map((triple) => matchPattern(pattern, triple, match))
    .filter((context): context is ExtractMatchResult<P> => context !== null);

export const matchPattern = <const P extends Pattern<any, any, any>>(
  pattern: P,
  triple: Statement,
  match: ExtractMatchResult<P> = {} as ExtractMatchResult<P>
): ExtractMatchResult<P> | null => {
  const [patternSubject, patternPredicate] = pattern;
  const [tripleSubject, tripleField] = triple;

  let newMatch: ExtractMatchResult<P> | null = match;

  // Match the subject (ID or Variable)
  newMatch = matchObject(patternSubject, tripleSubject, newMatch);
  if (!newMatch) return null;

  // Match the predicate (FieldValue or FieldPattern)
  newMatch = matchField(patternPredicate, tripleField, newMatch);
  if (!newMatch) return null;

  return newMatch;
};

const isVariable = (part: any): part is Variable<any> =>
  part instanceof Variable;

const isFieldValue = (part: any): part is FieldValue<any> =>
  part && typeof part === "object" && "field" in part && "value" in part;

const isFieldPattern = (part: any): part is FieldPattern<any, any> =>
  part && typeof part === "object" && "field" in part && "variable" in part;

const matchObject = <T>(
  objectPattern: ObjectId | Variable<any>,
  objectValue: ObjectId,
  context: T
): T | null => {
  if (isVariable(objectPattern)) {
    return matchVariable(objectPattern, objectValue, context);
  }

  return objectPattern === objectValue ? context : null;
};

const matchField = <T>(
  fieldPattern: FieldValue<any> | FieldPattern<any, any>,
  fieldValue: FieldValue<any>,
  context: T
): T | null => {
  if (isFieldValue(fieldPattern)) {
    // Match field and value exactly
    return fieldPattern.field.key === fieldValue.field.key &&
      fieldPattern.value === fieldValue.value
      ? context
      : null;
  }

  if (isFieldPattern(fieldPattern)) {
    // Match field and bind value to variable
    if (fieldPattern.field.key === fieldValue.field.key) {
      return matchVariable(fieldPattern.variable, fieldValue.value, context);
    }
  }

  return null;
};

const matchVariable = <T>(
  variable: Variable<any>,
  value: any,
  context: T
): T | null => {
  const variableName = variable.name;

  if (context && (context as any).hasOwnProperty(variableName)) {
    const bound = (context as any)[variableName];
    return bound === value ? context : null;
  }

  return { ...context, [variableName]: value } as T;
};
