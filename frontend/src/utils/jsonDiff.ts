export interface Mismatch {
  path: string;
  expected: unknown;
  received: unknown;
}

export type DiffResult =
  | { ok: true }
  | { ok: false; parseError: string }
  | { ok: false; mismatches: Mismatch[] };

/** Deep-compare two JSON strings. Returns ok:true on match, error details otherwise. */
export function diffJson(expectedStr: string, receivedStr: string): DiffResult {
  let expected: unknown;
  let received: unknown;

  try {
    received = JSON.parse(receivedStr);
  } catch {
    return { ok: false, parseError: 'Received response is not valid JSON' };
  }

  try {
    expected = JSON.parse(expectedStr);
  } catch {
    return { ok: false, parseError: 'Expected response body is not valid JSON' };
  }

  const mismatches = walk(expected, received, '');
  return mismatches.length === 0 ? { ok: true } : { ok: false, mismatches };
}

function walk(expected: unknown, received: unknown, path: string): Mismatch[] {
  const label = path || 'root';

  if (typeof expected !== typeof received || Array.isArray(expected) !== Array.isArray(received)) {
    return [{ path: label, expected, received }];
  }

  if (expected === null || typeof expected !== 'object') {
    return expected === received ? [] : [{ path: label, expected, received }];
  }

  const exp = expected as Record<string, unknown>;
  const rec = received as Record<string, unknown>;
  const keys = new Set([...Object.keys(exp), ...Object.keys(rec)]);
  const results: Mismatch[] = [];

  for (const key of keys) {
    const child = path ? `${path}.${key}` : key;
    if (!(key in exp)) {
      results.push({ path: child, expected: undefined, received: rec[key] });
    } else if (!(key in rec)) {
      results.push({ path: child, expected: exp[key], received: undefined });
    } else {
      results.push(...walk(exp[key], rec[key], child));
    }
  }

  return results;
}

/**
 * Given a formatted JSON string and a list of mismatched paths, returns each
 * line annotated with whether it should be highlighted.
 */
export function annotateLines(
  formatted: string,
  mismatches: Mismatch[],
): { text: string; error: boolean }[] {
  const errorKeys = new Set(
    mismatches.flatMap(m => m.path.split('.')),
  );

  return formatted.split('\n').map(line => {
    const match = line.match(/^\s*"([^"]+)"\s*:/);
    const key = match?.[1];
    return { text: line, error: !!key && errorKeys.has(key) };
  });
}

export function formatValue(v: unknown): string {
  if (v === undefined) return '(missing)';
  if (v === null) return 'null';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
