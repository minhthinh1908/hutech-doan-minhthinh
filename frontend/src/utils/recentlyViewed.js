const KEY = "bd_recent_snapshots";

/**
 * @param {{ id: string, name: string, price?: number, image?: string | null, brand?: string }} snapshot
 */
export function addRecentlyViewed(snapshot) {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    const next = [
      { ...snapshot, id: String(snapshot.id) },
      ...list.filter((s) => String(s.id) !== String(snapshot.id))
    ].slice(0, 8);
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("bd-recent-updated"));
  } catch {
    /* ignore */
  }
}

export function getRecentlyViewedSnapshots() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
