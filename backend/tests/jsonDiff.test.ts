import { describe, expect, it } from 'vitest';

import { annotateLines, diffJson } from '../../frontend/src/utils/jsonDiff';

describe('diffJson', () => {
  it('treats matching plain-text payloads as equal', () => {
    expect(diffJson('plain text', 'plain text')).toEqual({
      ok: true,
      format: 'text',
    });
  });

  it('only highlights the mismatched branch for nested JSON paths', () => {
    const lines = annotateLines(
      {
        order: { id: 9, status: 'ok' },
        user: { id: 2, status: 'ok' },
      },
      [{ path: 'order.id', expected: 1, received: 9 }],
    );

    expect(lines.find((line) => line.text.includes('"order"'))?.error).toBe(true);
    expect(lines.find((line) => line.text.includes('"user"'))?.error).toBe(false);

    const highlightedIds = lines.filter(
      (line) => line.error && line.text.includes('"id":'),
    );

    expect(highlightedIds).toHaveLength(1);
    expect(highlightedIds[0]?.text).toContain('9');
  });
});
