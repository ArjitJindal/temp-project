import React, { useEffect, useRef } from 'react';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { SCREENING_PROFILES } from '@/utils/queries/keys';
import { isFailed, getOr, isSuccess } from '@/utils/asyncResource';
import Select, { SingleProps } from '@/components/library/Select';
import Alert from '@/components/library/Alert';

interface Props extends Pick<SingleProps<string>, 'value' | 'onChange'> {
  listType?: string;
}

export default function ScreeningProfileSelect({ value, onChange, ...props }: Props) {
  const setDefaultProfile = useRef<boolean>(false);
  const api = useApi();
  const queryResults = useQuery(SCREENING_PROFILES(), () => {
    return api.getScreeningProfiles();
  });

  useEffect(() => {
    if (isSuccess(queryResults.data) && !setDefaultProfile.current && !value) {
      const profiles = getOr(queryResults.data, { items: [] }).items;
      const defaultProfile = profiles.find((profile) => profile.isDefault);
      if (defaultProfile) {
        onChange?.(defaultProfile.screeningProfileId);
        setDefaultProfile.current = true;
      }
    }
  }, [queryResults.data, value, onChange]);

  const res = queryResults.data;
  if (isFailed(res)) {
    return <Alert type="ERROR">{res.message}</Alert>;
  }

  const options = getOr(res, { items: [] }).items.map((list) => ({
    value: list.screeningProfileId,
    label: list.screeningProfileName ?? list.screeningProfileId,
    alternativeLabels: [list.screeningProfileId],
  }));

  return (
    <Select<string>
      mode="SINGLE"
      allowClear={true}
      options={options}
      value={value}
      onChange={onChange}
      {...props}
      isLoading={!isSuccess(res)}
    />
  );
}
