import React, { useState } from 'react';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { USERS_UNIQUES } from '@/utils/queries/keys';
import TagSearchButton, { Value } from '@/components/ui/TagSearchButton';

interface Props {
  initialState: Value;
  onConfirm: (newState: Value) => void;
}

export default function UserTagSearchButton(props: Props) {
  const [selectedKey, setSelectedKey] = useState<string>();

  const api = useApi();

  const tagKeysResult = useQuery(USERS_UNIQUES('TAGS_KEY'), async () => {
    return await api.getUsersUniques({
      field: 'TAGS_KEY',
    });
  });

  const tagValuesResult = useQuery(
    USERS_UNIQUES('TAGS_VALUE', { filter: selectedKey }),
    async () => {
      if (!selectedKey) {
        return [];
      }
      return await api.getUsersUniques({
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
