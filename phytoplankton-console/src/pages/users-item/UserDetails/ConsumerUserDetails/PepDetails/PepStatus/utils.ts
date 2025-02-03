import { compact, first, flatMap, groupBy, map } from 'lodash';
import { COUNTRIES } from '@flagright/lib/constants';
import { FormValues } from './index';
import { PEPStatus, PepRank } from '@/apis';
import { message } from '@/components/library/Message';

export function consolidatePEPStatus(array: PEPStatus[]): FormValues[] {
  const grouped = groupBy(array, (item) => `${item.isPepHit}-${item.pepRank}`);

  return map(grouped, (items) => {
    const firstItem = first(items) as PEPStatus;
    return {
      isPepHit: firstItem?.isPepHit,
      pepCountry: compact(map(items, 'pepCountry')),
      pepRank: firstItem?.pepRank,
    };
  });
}

export function expandPEPStatus(array: FormValues[]): PEPStatus[] {
  return flatMap(array, (formValue) => {
    const pepCountries = formValue.pepCountry?.length ? formValue.pepCountry : [undefined];
    const pepRank = formValue.pepRank;

    return map(pepCountries, (country) => ({
      isPepHit: formValue.isPepHit,
      pepRank,
      pepCountry: country,
    }));
  });
}

export function validatePEPStatus(array: PEPStatus[]) {
  const seenEntries = new Map<string, { isPepHit: boolean; pepRank?: PepRank }>();

  for (const entry of array) {
    const key = `${entry.isPepHit}-${entry.pepRank}-${entry.pepCountry}`;
    const currentEntry = { isPepHit: entry.isPepHit, pepRank: entry.pepRank };
    if (seenEntries.has(key)) {
      message.error(
        `Conflicting entries found ${
          entry.pepCountry ? `for country: ${COUNTRIES[entry.pepCountry]}` : ''
        }`,
      );
      return false;
    } else {
      seenEntries.set(key, currentEntry);
    }
  }

  return true;
}
