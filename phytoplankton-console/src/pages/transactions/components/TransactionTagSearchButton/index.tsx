import React, { useState } from 'react';
import TagSearchButton, { Value } from '@/components/ui/TagSearchButton';
import { useTransactionsUniques } from '@/hooks/api';

interface Props {
  initialState: Value;
  onConfirm: (newState: Value) => void;
  onUpdateFilterClose?: (status: boolean) => void;
}

export default function TransactionTagSearchButton(props: Props) {
  const [selectedKey, setSelectedKey] = useState<string>();

  const tagKeysResult = useTransactionsUniques('TAGS_KEY');
  const tagValuesResult = useTransactionsUniques('TAGS_VALUE', { filter: selectedKey });

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
