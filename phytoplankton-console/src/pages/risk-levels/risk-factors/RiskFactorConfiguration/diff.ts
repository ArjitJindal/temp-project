import { RiskFactorConfigurationFormValues } from './utils';
import { isEqual } from '@/utils/lang';

/*
  At the moment we only keep paths for changed fields, will add support for arrays later
 */
export type DiffPath = string[];

/*
  At the moment, we only need 2-level diff
 */
export function findDiff(
  a: Partial<RiskFactorConfigurationFormValues> = {},
  b: Partial<RiskFactorConfigurationFormValues> = {},
): DiffPath[] {
  const result: DiffPath[] = [];
  for (const [keyA1, valueA1] of Object.entries(a)) {
    const valueB1 = b[keyA1];
    for (const [keyA2, valueA2] of Object.entries(valueA1 ?? {})) {
      const valueB2 = valueB1[keyA2];
      if (!isEqual(valueA2, valueB2)) {
        result.push([keyA1, keyA2]);
      }
    }
  }
  return result;
}
