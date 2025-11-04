import { useState } from 'react';
import TagSearchButton, { Value } from '@/components/ui/TagSearchButton';
import { useTransactionsUniques } from '@/utils/api/transactions';
import { QueryResult } from '@/utils/queries/types';

interface Props {
  initialState: Value;
  onConfirm: (newState: Value) => void;
  onUpdateFilterClose?: (status: boolean) => void;
}

export default function TransactionTagSearchButton(props: Props) {
  const [selectedKey, setSelectedKey] = useState<string>();

  const tagKeysResult = useTransactionsUniques({ field: 'TAGS_KEY' }) as QueryResult<string[]>;

  const tagValuesResult = useTransactionsUniques({
    field: 'TAGS_VALUE',
    params: { filter: selectedKey },
  }) as QueryResult<string[]>;

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
