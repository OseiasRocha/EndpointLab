export interface Mismatch {
  path: string;
  expected: unknown;
  received: unknown;
}

export type DiffResult =
  | { ok: true; format: 'json' | 'text' }
  | { ok: false; parseError: string }
  | { ok: false; mismatches: Mismatch[] };

/** Deep-compare two JSON strings. Returns ok:true on match, error details otherwise. */
export function diffJson(expectedStr: string, receivedStr: string): DiffResult {
  let expected: unknown;
  let received: unknown;

  try {
    received = JSON.parse(receivedStr);
  } catch {
    return expectedStr === receivedStr
      ? { ok: true, format: 'text' }
      : { ok: false, parseError: 'Text response does not match expected value' };
  }

  try {
    expected = JSON.parse(expectedStr);
  } catch {
    return expectedStr === receivedStr
      ? { ok: true, format: 'text' }
      : { ok: false, parseError: 'Text response does not match expected value' };
  }

  const mismatches = walk(expected, received, '');
  return mismatches.length === 0 ? { ok: true, format: 'json' } : { ok: false, mismatches };
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
 * Render JSON as line objects annotated with whether they belong to a mismatched
 * path or one of its descendants.
 */
export function annotateLines(
  value: unknown,
  mismatches: Mismatch[],
): { text: string; error: boolean }[] {
  const mismatchPaths = mismatches.map((m) => m.path);
  return renderValue(value, mismatchPaths, '', 0, true);
}

export function formatValue(v: unknown): string {
  if (v === undefined) return '(missing)';
  if (v === null) return 'null';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function renderValue(
  value: unknown,
  mismatchPaths: string[],
  path: string,
  indent: number,
  isLast: boolean,
  propertyName?: string,
): { text: string; error: boolean }[] {
  const prefix = `${' '.repeat(indent)}${propertyName ? `${JSON.stringify(propertyName)}: ` : ''}`;
  const currentPath = path || 'root';

  if (value === null || typeof value !== 'object') {
    return [{
      text: `${prefix}${JSON.stringify(value)}${isLast ? '' : ','}`,
      error: hasMismatch(currentPath, mismatchPaths),
    }];
  }

  if (Array.isArray(value)) {
    const lines = [{
      text: `${prefix}[`,
      error: hasMismatch(currentPath, mismatchPaths),
    }];

    value.forEach((item, index) => {
      const childPath = path ? `${path}.${index}` : String(index);
      lines.push(...renderValue(item, mismatchPaths, childPath, indent + 2, index === value.length - 1));
    });

    lines.push({
      text: `${' '.repeat(indent)}]${isLast ? '' : ','}`,
      error: false,
    });

    return lines;
  }

  const entries = Object.entries(value);
  const lines = [{
    text: `${prefix}{`,
    error: hasMismatch(currentPath, mismatchPaths),
  }];

  entries.forEach(([key, child], index) => {
    const childPath = path ? `${path}.${key}` : key;
    lines.push(...renderValue(child, mismatchPaths, childPath, indent + 2, index === entries.length - 1, key));
  });

  lines.push({
    text: `${' '.repeat(indent)}}${isLast ? '' : ','}`,
    error: false,
  });

  return lines;
}

function hasMismatch(path: string, mismatchPaths: string[]): boolean {
  return mismatchPaths.some(
    (mismatchPath) => mismatchPath === path || mismatchPath.startsWith(`${path}.`),
  );
}
