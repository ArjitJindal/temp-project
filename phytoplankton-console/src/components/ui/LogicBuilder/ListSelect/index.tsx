import { Alert } from 'antd';
import React from 'react';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { LISTS } from '@/utils/queries/keys';
import { isFailed, getOr, isSuccess } from '@/utils/asyncResource';
import Select, { TagsProps as SelectProps } from '@/components/library/Select';

interface Props extends Pick<SelectProps<string>, 'value' | 'onChange'> {
  listType?: string;
}

export default function ListSelect(props: Props) {
  const { listType } = props;
  const api = useApi();
  const queryResults = useQuery(LISTS(), () => {
    if (listType === 'WHITELIST') {
      return api.getWhitelist();
    }
    if (listType === 'BLACKLIST') {
      return api.getBlacklist();
    }
    return api.getLists();
  });
  const res = queryResults.data;
  if (isFailed(res)) {
    return <Alert message={res.message} type="error" />;
  }
  return (
    <Select<string>
      portaled={true}
      mode={'MULTIPLE'}
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
