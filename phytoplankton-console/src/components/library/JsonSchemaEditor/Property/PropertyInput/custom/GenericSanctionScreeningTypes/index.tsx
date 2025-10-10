import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { useMemo } from 'react';
import { uniq } from 'lodash';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Select from '@/components/library/Select';
import SelectionGroup from '@/components/library/SelectionGroup';
import { ACURIS_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/AcurisSanctionsSearchType';
import { OPEN_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/OpenSanctionsSearchType';
import { DOW_JONES_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/DowJonesSanctionsSearchType';

interface Props {
  value?: string[];
  onChange?: (value?: string[]) => void;
}

export const GenericSanctionScreeningTypes = (props: Props) => {
  const settings = useSettings();
  const hasFeatureAcuris = useFeatureEnabled('ACURIS');
  const hasFeatureOpenSanctions = useFeatureEnabled('OPEN_SANCTIONS');
  const hasFeatureDowJones = useFeatureEnabled('DOW_JONES');
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

  const options = uniq([...openSanctionsOptions, ...acurisOptions, ...dowJonesOptions]).map(
    (option) => ({
      label: humanizeAuto(option),
      value: option,
    }),
  );
  return options.length > 4 ? (
    <Select options={options} {...props} mode="MULTIPLE_DYNAMIC" />
  ) : (
    <SelectionGroup mode="MULTIPLE" options={options ?? []} {...props} />
  );
};
