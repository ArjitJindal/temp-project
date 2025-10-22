import { isEqual } from '@/utils/lang';

/*
  At the moment we only keep paths for changed fields, will add support for arrays later
 */
export type DiffPath = string[];

/*
  At the moment, we only need 2-level diff
 */
export function findDiff(a: object = {}, b: object = {}): DiffPath[] {
  const result: DiffPath[] = [];
  for (const [keyA1, valueA1] of Object.entries(a)) {
    const valueB1 = b[keyA1];
    if (valueA1 == null || valueB1 == null) {
      if (
        valueA1 === '' ||
        valueB1 === '' ||
        (Array.isArray(valueA1) && valueA1.length === 0) ||
        (Array.isArray(valueB1) && valueB1.length === 0)
      ) {
        continue;
      }
      if (!isEqual(valueA1, valueB1)) {
        result.push([keyA1]);
      }
    } else if (typeof valueA1 !== 'object' || typeof valueB1 !== 'object') {
      if (!isEqual(valueA1, valueB1)) {
        result.push([keyA1]);
      }
    } else {
      for (const [keyA2, valueA2] of Object.entries(valueA1 ?? {})) {
        const valueB2 = valueB1[keyA2];
        if (!isEqual(valueA2, valueB2)) {
          result.push([keyA1, keyA2]);
        }
      }
    }
  }
  return result;
}
