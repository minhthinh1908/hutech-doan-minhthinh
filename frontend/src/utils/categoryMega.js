/** Cùng layout mega menu 5 cột với CategoryNav / trang chủ. */
export const MEGA_COLS = 5;

export function splitIntoColumns(items, numCols = MEGA_COLS) {
  if (!items?.length) return [];
  const cols = Array.from({ length: numCols }, () => []);
  items.forEach((item, i) => {
    cols[i % numCols].push(item);
  });
  return cols;
}
