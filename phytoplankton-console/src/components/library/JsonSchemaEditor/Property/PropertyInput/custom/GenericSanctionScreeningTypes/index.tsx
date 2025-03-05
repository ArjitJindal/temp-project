import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { useMemo } from 'react';
import { uniq } from 'lodash';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Select, { MultipleProps } from '@/components/library/Select';
import SelectionGroup from '@/components/library/SelectionGroup';
import { ACURIS_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/AcurisSanctionsSearchType';
import { OPEN_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/OpenSanctionsSearchType';
import { SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/SanctionsSearchType';

interface Props extends Pick<MultipleProps<string>, 'value' | 'onChange'> {}

export const GenericSanctionScreeningTypes = (props: Props) => {
  const settings = useSettings();
  const hasFeatureAcuris = useFeatureEnabled('ACURIS');
  const hasFeatureOpenSanctions = useFeatureEnabled('OPEN_SANCTIONS');
  const hasFeatureSanctions = useFeatureEnabled('SANCTIONS');
  const acurisOptions = useMemo(() => {
    if (!hasFeatureAcuris) {
      return [];
    }
    return (
      settings?.sanctions?.providerScreeningTypes?.find((type) => type.provider === 'acuris')
        ?.screeningTypes ?? ACURIS_SANCTIONS_SEARCH_TYPES
    );
  }, [settings, hasFeatureAcuris]);
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
  const sanctionsOptions = useMemo(() => {
    if (!hasFeatureSanctions || hasFeatureOpenSanctions || hasFeatureAcuris) {
      return [];
    }
    return (
      settings?.sanctions?.providerScreeningTypes?.find(
        (type) => type.provider === 'comply-advantage',
      )?.screeningTypes ?? SANCTIONS_SEARCH_TYPES
    );
  }, [settings, hasFeatureSanctions, hasFeatureOpenSanctions, hasFeatureAcuris]);
  const options = uniq([...openSanctionsOptions, ...acurisOptions, ...sanctionsOptions]).map(
    (option) => ({
      label: humanizeAuto(option),
      value: option,
    }),
  );
  return options.length > 4 ? (
    <Select options={options} {...props} mode="MULTIPLE" />
  ) : (
    <SelectionGroup mode="MULTIPLE" options={options ?? []} {...props} />
  );
};
