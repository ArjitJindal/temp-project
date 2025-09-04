import { intersection, uniq } from 'lodash';
import {
  Feature,
  SanctionsDataProviderName,
  SanctionsSettingsProviderScreeningTypes,
} from '@/apis';
import { ACURIS_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/AcurisSanctionsSearchType';
import { DOW_JONES_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/DowJonesSanctionsSearchType';
import { OPEN_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/OpenSanctionsSearchType';
import { GenericSanctionsSearchType } from '@/apis/models/GenericSanctionsSearchType';

export const DEFAULT_PROVIDER_TYEPS_MAP: {
  [key: string]: GenericSanctionsSearchType[];
} = {
  acuris: ACURIS_SANCTIONS_SEARCH_TYPES,
  'open-sanctions': OPEN_SANCTIONS_SEARCH_TYPES,
  dowjones: DOW_JONES_SANCTIONS_SEARCH_TYPES,
};

export function getSanctionsSearchTypeOptions(
  features: Feature[],
  providerScreeningTypes?: SanctionsSettingsProviderScreeningTypes[],
): GenericSanctionsSearchType[] {
  const providers = getProviders(features);
  return intersection(
    uniq(
      providers.flatMap((p) => {
        const providerSettings = providerScreeningTypes?.find((t) => t.provider === p);
        return (providerSettings?.screeningTypes ??
          DEFAULT_PROVIDER_TYEPS_MAP[p]) as GenericSanctionsSearchType[];
      }),
    ),
    uniq(providers.flatMap((p) => DEFAULT_PROVIDER_TYEPS_MAP[p])),
  );
}

const getProviders = (features: Feature[]) => {
  const providers: SanctionsDataProviderName[] = [];
  features.forEach((f) => {
    if (f === 'ACURIS') {
      providers.push('acuris');
    } else if (f === 'OPEN_SANCTIONS') {
      providers.push('open-sanctions');
    } else if (f === 'DOW_JONES') {
      providers.push('dowjones');
    }
  });
  return providers;
};
