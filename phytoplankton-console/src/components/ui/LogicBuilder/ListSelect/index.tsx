import { Alert } from 'antd';
import React from 'react';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { LISTS } from '@/utils/queries/keys';
import { isFailed, getOr, isSuccess } from '@/utils/asyncResource';
import Select, { TagsProps as SelectProps } from '@/components/library/Select';

export default function ListSelect(props: Pick<SelectProps<string>, 'value' | 'onChange'>) {
  const api = useApi();
  const queryResults = useQuery(LISTS(), () => {
    return api.getLists();
  });
  const res = queryResults.data;
  if (isFailed(res)) {
    return <Alert message={res.message} type="error" />;
  }
  return (
    <Select<string>
      portaled={true}
      mode={'TAGS'}
      allowClear={true}
      options={getOr(res, []).map((list) => ({
        value: list.listId,
        label: list.metadata?.name ?? list.listId,
        alternativeLabels: [list.listId],
      }))}
      {...props}
      isLoading={!isSuccess(res)}
    />
  );
}
