import { Alert } from 'antd';
import React from 'react';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { SCREENING_PROFILES } from '@/utils/queries/keys';
import { isFailed, getOr, isSuccess } from '@/utils/asyncResource';
import Select, { SingleProps } from '@/components/library/Select';

interface Props extends Pick<SingleProps<string>, 'value' | 'onChange'> {
  listType?: string;
}

export default function ScreeningProfileSelect(props: Props) {
  const api = useApi();
  const queryResults = useQuery(SCREENING_PROFILES(), () => {
    return api.getScreeningProfiles();
  });
  const res = queryResults.data;
  if (isFailed(res)) {
    return <Alert message={res.message} type="error" />;
  }

  const options = getOr(res, { items: [] }).items.map((list) => ({
    value: list.screeningProfileId,
    label: list.screeningProfileName ?? list.screeningProfileId,
    alternativeLabels: [list.screeningProfileId],
  }));

  return (
    <Select<string>
      portaled={true}
      mode="SINGLE"
      allowClear={true}
      options={options}
      {...props}
      isLoading={!isSuccess(res)}
    />
  );
}
