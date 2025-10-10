/**
 * Function accept array of ranges and check if some of them are overlapping.
 * Min number is always the start and inclusive, max number is awlays the end and exclusive
 * @param ranges
 */
export function hasOverlaps(ranges: [number, number][]): boolean {
  for (let i = 0; i < ranges.length; i += 1) {
    const [x1, x2] = ranges[i];
    const min1 = Math.min(x1, x2);
    const max1 = Math.max(x1, x2);
    for (let j = i + 1; j < ranges.length; j += 1) {
      const [y1, y2] = ranges[j];
      const min2 = Math.min(y1, y2);
      const max2 = Math.max(y1, y2);

      if (min1 < min2) {
        if (max1 > min2) {
          return true;
        }
      } else {
        if (max2 > min1) {
          return true;
        }
      }
    }
  }
  return false;
}
