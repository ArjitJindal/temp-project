import React, { useState } from 'react';
import { useUsersUniques } from '@/hooks/api';
import TagSearchButton, { Value } from '@/components/ui/TagSearchButton';

interface Props {
  initialState: Value;
  onConfirm: (newState: Value) => void;
}

export default function UserTagSearchButton(props: Props) {
  const [selectedKey, setSelectedKey] = useState<string>();

  const tagKeysResult = useUsersUniques('TAGS_KEY');
  const tagValuesResult = useUsersUniques('TAGS_VALUE', { filter: selectedKey });

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
