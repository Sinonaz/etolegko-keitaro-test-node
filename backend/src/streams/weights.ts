/** Share % redistribution for stream offers (equal split + pin). */

export type OfferShare = {
  offer_id: number;
  share: number;
  pinned: boolean;
  removed: boolean;
};

export function redistribute(offers: OfferShare[]): OfferShare[] {
  for (const offer of offers) {
    if (offer.removed) {
      offer.share = 0;
      offer.pinned = false;
    }
  }

  const active = offers.filter((o) => !o.removed);
  if (!active.length) return offers;

  const pinned = active.filter((o) => o.pinned);
  const unpinned = active.filter((o) => !o.pinned);

  if (!pinned.length) {
    equalSplit(active);
    return offers;
  }

  let pinnedTotal = pinned.reduce((sum, o) => sum + Math.max(0, o.share), 0);
  if (pinnedTotal > 100) {
    const scale = 100 / pinnedTotal;
    let allocated = 0;
    for (let i = 0; i < pinned.length; i++) {
      const offer = pinned[i];
      if (i === pinned.length - 1) {
        offer.share = 100 - allocated;
      } else {
        offer.share = Math.floor(offer.share * scale);
        allocated += offer.share;
      }
    }
    pinnedTotal = pinned.reduce((sum, o) => sum + o.share, 0);
  }

  const remaining = 100 - pinnedTotal;
  if (!unpinned.length) return offers;

  if (remaining <= 0) {
    for (const offer of unpinned) offer.share = 0;
    return offers;
  }

  equalSplit(unpinned, remaining);
  return offers;
}

function equalSplit(items: OfferShare[], total = 100): void {
  const n = items.length;
  if (!n) return;
  const base = Math.floor(total / n);
  const rem = total % n;
  for (let i = 0; i < items.length; i++) {
    items[i].share = base + (i < rem ? 1 : 0);
  }
}
