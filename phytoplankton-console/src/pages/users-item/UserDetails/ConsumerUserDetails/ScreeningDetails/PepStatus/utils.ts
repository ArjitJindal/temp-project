import { compact, first, flatMap, groupBy, map } from 'lodash';
import { COUNTRIES } from '@flagright/lib/constants';
import { PepFormValues } from './index';
import { PEPStatus, PepRank } from '@/apis';

export function consolidatePEPStatus(array: PEPStatus[]): PepFormValues[] {
  const grouped = groupBy(array, (item) => `${item.isPepHit}-${item.pepRank}`);

  return map(grouped, (items) => {
    const firstItem = first(items) as PEPStatus;
    return {
      isPepHit: firstItem?.isPepHit ?? false,
      pepCountry: compact(map(items, 'pepCountry')),
      pepRank: firstItem?.pepRank,
    };
  });
}

export function expandPEPStatus(array: PepFormValues[]): PEPStatus[] {
  return flatMap(array, (formValue) => {
    const pepCountries = formValue.pepCountry?.length ? formValue.pepCountry : [];
    const pepRank = formValue.pepRank;

    if (pepCountries.length === 0) {
      return [
        {
          isPepHit: formValue.isPepHit ?? false,
          pepRank,
          pepCountry: undefined,
        } as PEPStatus,
      ];
    }

    return map(pepCountries, (country) => ({
      isPepHit: formValue.isPepHit ?? false,
      pepRank,
      pepCountry: country,
    }));
  });
}

export function validatePEPStatus(array: PEPStatus[]): string | null {
  const seenEntries = new Map<string, { isPepHit: boolean; pepRank?: PepRank }>();

  for (const entry of array) {
    const key = `${entry.isPepHit}-${entry.pepRank}-${entry.pepCountry}`;
    const currentEntry = { isPepHit: entry.isPepHit, pepRank: entry.pepRank };
    if (seenEntries.has(key)) {
      return `Conflicting entries found ${
        entry.pepCountry ? `for country: ${COUNTRIES[entry.pepCountry]}` : ''
      }`;
    } else {
      seenEntries.set(key, currentEntry);
    }
  }

  return null;
}
