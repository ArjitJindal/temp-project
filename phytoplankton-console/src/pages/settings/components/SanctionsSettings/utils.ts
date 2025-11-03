import { intersection, uniq } from 'lodash';
import {
  Feature,
  SanctionsDataProviderName,
  SanctionsSettings,
  SanctionsSettingsProviderScreeningTypes,
} from '@/apis';
import { ACURIS_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/AcurisSanctionsSearchType';
import { DOW_JONES_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/DowJonesSanctionsSearchType';
import { OPEN_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/OpenSanctionsSearchType';
import { GenericSanctionsSearchType } from '@/apis/models/GenericSanctionsSearchType';
import { GENERIC_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/GenericSanctionsSearchType';

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

export const getProviders = (features: Feature[]) => {
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

export const getProvidersOptions = (
  features: Feature[],
): { label: string; value: SanctionsDataProviderName }[] => {
  const providers = getProviders(features);
  return providers.map((provider) => ({
    label: getProviderLabel(provider),
    value: provider,
  }));
};

function getProviderLabel(provider: SanctionsDataProviderName): string {
  switch (provider) {
    case 'acuris':
      return 'KYC6';
    case 'open-sanctions':
      return 'Open Sanctions';
    case 'dowjones':
      return 'Dow Jones';
    default:
      return provider;
  }
}

export const getProviderScreeningInfo = (
  sanctions: SanctionsSettings | undefined,
  provider?: SanctionsDataProviderName,
): {
  screeningTypes: GenericSanctionsSearchType[];
} => {
  if (!provider) {
    return {
      screeningTypes: [],
    };
  }
  const providerScreeningTypes = sanctions?.providerScreeningTypes?.find(
    (type) => type.provider === provider,
  );
  return {
    screeningTypes: GENERIC_SANCTIONS_SEARCH_TYPES.filter((type) =>
      (providerScreeningTypes?.screeningTypes ?? DEFAULT_PROVIDER_TYEPS_MAP[provider]).includes(
        type,
      ),
    ),
  };
};
