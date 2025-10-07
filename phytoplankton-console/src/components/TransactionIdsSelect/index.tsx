import React, { useState } from 'react';
import { useDebounce } from 'ahooks';
import Select, { Props } from '../library/Select';
import { getOr } from '@/utils/asyncResource';
import { useApi } from '@/api';
import { TRANSACTIONS_LIST } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';

type LocalProps = Omit<
  Extract<Props<string>, { mode: 'SINGLE' | 'MULTIPLE' | 'MULTIPLE_DYNAMIC' }>,
  'options'
>;

function TransactionIdsSelect(props: LocalProps) {
  const [searchTerm, setSearchTerm] = useState<string | undefined>();
  const debouncedSearchTerm = useDebounce(searchTerm, { wait: 500 });
  const api = useApi();
  const queryResult = useQuery(TRANSACTIONS_LIST(debouncedSearchTerm), async () => {
    return api.getTransactionsList({ filterId: debouncedSearchTerm });
  });
  const options = getOr(queryResult.data, {
    items: [],
    count: 0,
  }).items.map((val) => ({
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
