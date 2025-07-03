import { assertEqual } from "./assert";

function matchPattern(pattern, triple, context) {
  for (let i = 0; i < pattern.length; i++) {
    const patternPart = pattern[i];
    const triplePart = triple[i];

    context = matchPart(patternPart, triplePart, context);
  }

  return context;
}

function matchPart(patternPart, triplePart, context) {
  if (!context) {
    return null;
  }

  if (isVariable(patternPart)) {
    return matchVariable(patternPart, triplePart, context);
  }

  return patternPart === triplePart ? context : null;
}

function matchVariable(variable, triplePart, context) {
  const variableName = variable.slice(1);

  if (context.hasOwnProperty(variableName)) {
    const bound = context[variableName];
    return matchPart(bound, triplePart, context);
  }

  return { ...context, [variableName]: triplePart };
}

function isVariable(part) {
  return part.startsWith("?");
}

const db = [
  ["1", "name", "bob"],
  ["1", "age", "20"],
  ["2", "name", "sandra"],
  ["2", "age", "25"],
];

function querySingle(pattern, db, context) {
  const result = [];

  for (const triple of db) {
    const context = matchPattern(pattern, triple, {});

    if (context !== null) {
      result.push(context);
    }
  }

  return result;
}

assertEqual(matchPattern(["?a", "?b", "?c"], ["1", "name", "bob"], {}), { a: "1", b: "name", c: "bob" });
assertEqual(matchPattern(["?a", "age", "10"], ["1", "name", "bob"], {}), null);
assertEqual(matchPattern(["?a", "name", "bob"], ["1", "name", "bob"], {}), { a: "1" });
assertEqual(matchPattern(["1", "name", "?b"], ["1", "name", "bob"], {}), { b: "bob" });

assertEqual(querySingle(["?e", "age", "?age"], db, {}), [
  { e: "1", age: "20" },
  { e: "2", age: "25" },
]);

assertEqual(querySingle(["1", "?k", "?v"], db, {}), [
  { k: "name", v: "bob" },
  { k: "age", v: "20" },
]);
