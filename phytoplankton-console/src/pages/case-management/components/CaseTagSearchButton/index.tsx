import React, { useState } from 'react';
import TagSearchButton, { Value } from '@/components/ui/TagSearchButton';
import { useCasesUniques } from '@/utils/api/cases';

interface Props {
  initialState: Value;
  onConfirm: (newState: Value) => void;
  type: 'CASE' | 'ALERT';
}

export default function CaseTagSearchButton(props: Props) {
  const [selectedKey, setSelectedKey] = useState<string | undefined>();
  const { type } = props;

  const tagKeysResult = useCasesUniques('TAGS_KEY', { field: 'TAGS_KEY', type });

  const tagValuesResult = useCasesUniques('TAGS_VALUE', {
    field: 'TAGS_VALUE',
    filter: selectedKey,
    type,
  });

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
