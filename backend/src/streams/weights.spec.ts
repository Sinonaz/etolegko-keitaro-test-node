import { OfferShare, redistribute } from './weights';

function shares(...items: Array<[number, number, boolean?, boolean?]>): OfferShare[] {
  return items.map(([offer_id, share, pinned = false, removed = false]) => ({
    offer_id,
    share,
    pinned,
    removed,
  }));
}

describe('redistribute', () => {
  it('splits equally with remainder to the first items', () => {
    const rows = shares([1, 0], [2, 0], [3, 0]);
    redistribute(rows);
    expect(rows.map((r) => r.share)).toEqual([34, 33, 33]);
  });

  it('keeps pinned share and splits the rest', () => {
    const rows = shares([1, 25, true], [2, 0], [3, 0]);
    redistribute(rows);
    expect(rows.map((r) => r.share)).toEqual([25, 38, 37]);
  });

  it('zeros removed offers', () => {
    const rows = shares([1, 50], [2, 50, false, true]);
    redistribute(rows);
    expect(rows[1].share).toBe(0);
    expect(rows[0].share).toBe(100);
  });
});
