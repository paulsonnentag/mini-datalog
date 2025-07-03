export function assertEqual(actual, expected, message) {
  if (!deepEqual(actual, expected)) {
    console.error(message ? `failed: ${message}` : "failed:", "expected", expected, "actual", actual);
  }
}

function deepEqual(a, b) {
  if (a === b) return true;

  if (a == null || b == null) return false;

  if (typeof a !== "object" || typeof b !== "object") return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (let key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}
