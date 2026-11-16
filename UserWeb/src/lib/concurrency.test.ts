import { describe, expect, it } from 'vitest';
import { mapWithLimit } from './concurrency';

describe('mapWithLimit', () => {
  it('never runs more than the limit at once and keeps result order', async () => {
    let active = 0;
    let peak = 0;
    const out = await mapWithLimit([1, 2, 3, 4, 5, 6, 7, 8, 9], 4, async (n) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return n * 10;
    });
    expect(peak).toBe(4);
    expect(out).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90]);
  });

  it('handles an empty list and rejects on the first failure', async () => {
    expect(await mapWithLimit([], 4, async (n: number) => n)).toEqual([]);
    await expect(
      mapWithLimit([1, 2], 4, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      }),
    ).rejects.toThrow('boom');
  });
});
