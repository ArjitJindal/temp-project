import React from 'react';
import { useLists } from '@/hooks/api';
import { isFailed, getOr, isSuccess } from '@/utils/asyncResource';
import Select, { MultipleProps as SelectProps } from '@/components/library/Select';
import Alert from '@/components/library/Alert';

interface Props extends Pick<SelectProps<string>, 'value' | 'onChange'> {
  listType?: string;
}

export default function ListSelect(props: Props) {
  const { listType } = props;
  const queryResults = useLists(listType as any);
  const res = queryResults.data;
  if (isFailed(res)) {
    return <Alert type="ERROR">{res.message}</Alert>;
  }
  return (
    <Select<string>
      mode={'MULTIPLE'}
      allowNewOptions={true}
      allowClear={true}
      options={getOr(res, [])
        .filter((list) => list.subtype !== 'CUSTOM')
        .map((list) => ({
          value: list.listId,
          label: list.metadata?.name ?? list.listId,
          alternativeLabels: [list.listId],
        }))}
      {...props}
      isLoading={!isSuccess(res)}
    />
  );
}
