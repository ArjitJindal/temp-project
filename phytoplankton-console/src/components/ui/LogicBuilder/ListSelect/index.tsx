import React from 'react';
import { isFailed, getOr, isSuccess } from '@/utils/asyncResource';
import Select, { MultipleProps as SelectProps } from '@/components/library/Select';
import Alert from '@/components/library/Alert';
import { useLists } from '@/utils/api/lists';
import { ListType } from '@/apis';

interface Props extends Pick<SelectProps<string>, 'value' | 'onChange'> {
  listType?: string;
}

export default function ListSelect(props: Props) {
  const { listType } = props;
  const queryResults = useLists({ listType: listType as ListType });
  const res = queryResults.data;
  if (isFailed(res)) {
    return <Alert type="ERROR">{res.message}</Alert>;
  }
  return (
    <Select<string>
      mode={'MULTIPLE_DYNAMIC'}
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
