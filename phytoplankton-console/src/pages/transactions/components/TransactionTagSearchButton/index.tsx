import React, { useState } from 'react';
import TagSearchButton, { Value } from '@/components/ui/TagSearchButton';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { TRANSACTIONS_UNIQUES } from '@/utils/queries/keys';

interface Props {
  initialState: Value;
  onConfirm: (newState: Value) => void;
  onUpdateFilterClose?: (status: boolean) => void;
}

export default function TransactionTagSearchButton(props: Props) {
  const [selectedKey, setSelectedKey] = useState<string>();

  const api = useApi();

  const tagKeysResult = useQuery(TRANSACTIONS_UNIQUES('TAGS_KEY'), async () => {
    return await api.getTransactionsUniques({
      field: 'TAGS_KEY',
    });
  });

  const tagValuesResult = useQuery(
    TRANSACTIONS_UNIQUES('TAGS_VALUE', { filter: selectedKey }),
    async () => {
      if (!selectedKey) {
        return [];
      }
      return await api.getTransactionsUniques({
        field: 'TAGS_VALUE',
        filter: selectedKey,
      });
    },
    {
      enabled: !!selectedKey,
    },
  );

  return (
    <TagSearchButton
      {...props}
      keyQueryResult={tagKeysResult}
      valueQueryResult={tagValuesResult}
      onChangeFormValues={(values) => {
        setSelectedKey(values.key);
      }}
    />
  );
}
