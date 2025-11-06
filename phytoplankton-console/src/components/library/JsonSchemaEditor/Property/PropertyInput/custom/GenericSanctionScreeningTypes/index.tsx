import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { useMemo } from 'react';
import { uniq } from 'lodash';
import {
  useFeatureEnabled,
  useFeatures,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Select from '@/components/library/Select';
import SelectionGroup from '@/components/library/SelectionGroup';
import { ACURIS_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/AcurisSanctionsSearchType';
import { OPEN_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/OpenSanctionsSearchType';
import { DOW_JONES_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/DowJonesSanctionsSearchType';
import { useFormContext } from '@/components/library/Form/utils/hooks';
import { useScreeningProfiles } from '@/utils/api/screening';
import { map } from '@/utils/queries/types';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { LSEG_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/LSEGSanctionsSearchType';
import { getProviders } from '@/pages/settings/components/SanctionsSettings/utils';
import { SanctionsDataProviderName } from '@/apis';
import { GENERIC_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/GenericSanctionsSearchType';

interface Props {
  value?: string[];
  onChange?: (value?: string[]) => void;
}

const UNKNOWN_PROVIDER_NAME = '_UNKNOWN_';

export const GenericSanctionScreeningTypes = (props: Props) => {
  const settings = useSettings();
  const formContext = useFormContext();
  const screeningProfileId = formContext?.values?.['screeningProfileId'];
  const features = useFeatures();
  const screeningProfilesResult = useScreeningProfiles(
    screeningProfileId ? { filterScreeningProfileId: [screeningProfileId] } : {},
  );
  const screeningProfileProvider = map(screeningProfilesResult, (data) => {
    if (!screeningProfileId) {
      return getProviders(features)?.[0] ?? UNKNOWN_PROVIDER_NAME;
    }
    return data.items[0]?.provider ?? UNKNOWN_PROVIDER_NAME;
  });
  const hasFeatureAcuris = useFeatureEnabled('ACURIS');
  const hasFeatureOpenSanctions = useFeatureEnabled('OPEN_SANCTIONS');
  const hasFeatureDowJones = useFeatureEnabled('DOW_JONES');
  const hasFeatureLSEG = useFeatureEnabled('LSEG');
  const acurisOptions = useMemo(() => {
    if (!hasFeatureAcuris) {
      return [];
    }
    return (
      settings?.sanctions?.providerScreeningTypes?.find((type) => type.provider === 'acuris')
        ?.screeningTypes ?? ACURIS_SANCTIONS_SEARCH_TYPES
    );
  }, [settings, hasFeatureAcuris]);
  const dowJonesOptions = useMemo(() => {
    if (!hasFeatureDowJones) {
      return [];
    }
    return (
      settings?.sanctions?.providerScreeningTypes?.find((type) => type.provider === 'dowjones')
        ?.screeningTypes ?? DOW_JONES_SANCTIONS_SEARCH_TYPES
    );
  }, [settings, hasFeatureDowJones]);
  const openSanctionsOptions = useMemo(() => {
    if (!hasFeatureOpenSanctions) {
      return [];
    }
    return (
      settings?.sanctions?.providerScreeningTypes?.find(
        (type) => type.provider === 'open-sanctions',
      )?.screeningTypes ?? OPEN_SANCTIONS_SEARCH_TYPES
    );
  }, [settings, hasFeatureOpenSanctions]);

  const lsegOptions = useMemo(() => {
    if (!hasFeatureLSEG) {
      return [];
    }
    return (
      settings?.sanctions?.providerScreeningTypes?.find((type) => type.provider === 'lseg')
        ?.screeningTypes ?? LSEG_SANCTIONS_SEARCH_TYPES
    );
  }, [settings, hasFeatureLSEG]);

  const getOptions = (provider: SanctionsDataProviderName | typeof UNKNOWN_PROVIDER_NAME) => {
    if (provider === UNKNOWN_PROVIDER_NAME) {
      return GENERIC_SANCTIONS_SEARCH_TYPES;
    }
    if (provider === 'open-sanctions') {
      return openSanctionsOptions;
    }
    if (provider === 'acuris') {
      return acurisOptions;
    }
    if (provider === 'lseg') {
      return lsegOptions;
    }
    if (provider === 'dowjones') {
      return dowJonesOptions;
    }
    return [];
  };

  return (
    <AsyncResourceRenderer
      resource={screeningProfileProvider.data}
      children={(provider) => {
        const options = uniq(
          GENERIC_SANCTIONS_SEARCH_TYPES.filter((type) => getOptions(provider).includes(type)),
        ).map((option) => ({
          label: humanizeAuto(option),
          value: option,
        }));
        return options.length > 4 ? (
          <Select
            options={options}
            {...props}
            mode="MULTIPLE_DYNAMIC"
            isDisabled={!screeningProfileId}
          />
        ) : (
          <SelectionGroup
            mode="MULTIPLE"
            options={options ?? []}
            {...props}
            isDisabled={!screeningProfileId}
          />
        );
      }}
    />
  );
};
