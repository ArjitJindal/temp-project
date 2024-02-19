import { uniq } from 'lodash';

export const ADVERSE_MEDIA = 'adverse-media';
export const PEP = 'pep';
export const SANCTIONS = 'sanctions';
export const TABS_ORDER = [SANCTIONS, PEP, ADVERSE_MEDIA];

export function normalizeAmlTypes(amlTypes: string[]): string[] {
  return uniq(
    amlTypes.map((x) => {
      if (x === 'adverse-media' || x.startsWith('adverse-media-')) {
        return ADVERSE_MEDIA;
      }
      if (x === 'pep' || x.startsWith('pep-')) {
        return PEP;
      }
      return x;
    }),
  );
}
