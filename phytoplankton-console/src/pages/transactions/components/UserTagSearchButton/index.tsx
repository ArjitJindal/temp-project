import { useState } from 'react';
import TagSearchButton, { Value } from '@/components/ui/TagSearchButton';
import { useUsersUniques } from '@/utils/api/users';

interface Props {
  initialState: Value;
  onConfirm: (newState: Value) => void;
}

export default function UserTagSearchButton(props: Props) {
  const [selectedKey, setSelectedKey] = useState<string>();

  const tagKeysResult = useUsersUniques('TAGS_KEY');

  const tagValuesResult = useUsersUniques('TAGS_VALUE', selectedKey);

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
