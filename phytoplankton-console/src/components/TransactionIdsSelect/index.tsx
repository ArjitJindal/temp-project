import React, { useState } from 'react';
import { useDebounce } from 'ahooks';
import Select, { Props } from '../library/Select';
import { getOr } from '@/utils/asyncResource';
import { useTransactionList } from '@/utils/api/transactions';

type LocalProps = Omit<
  Extract<Props<string>, { mode: 'SINGLE' | 'MULTIPLE' | 'MULTIPLE_DYNAMIC' }>,
  'options'
>;

function TransactionIdsSelect(props: LocalProps) {
  const [searchTerm, setSearchTerm] = useState<string | undefined>();
  const debouncedSearchTerm = useDebounce(searchTerm, { wait: 500 });

  const queryResult = useTransactionList({
    params: {
      filterId: debouncedSearchTerm ?? '',
    },
  });
  const options = getOr(queryResult.data, { items: [], count: 0 }).items.map((val) => ({
    label: val.transactionId,
    value: val.transactionId,
  }));
  return (
    <Select
      {...props}
      options={options}
      onSearch={(searchTerm: string) => {
        setSearchTerm(searchTerm);
      }}
    />
  );
}

export default TransactionIdsSelect;
