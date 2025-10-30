import React, { useState } from 'react';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import TagSearchButton, { Value } from '@/components/ui/TagSearchButton';
import { CASES_UNIQUES } from '@/utils/queries/keys';

interface Props {
  initialState: Value;
  onConfirm: (newState: Value) => void;
  type: 'CASE' | 'ALERT';
}

export default function CaseTagSearchButton(props: Props) {
  const [selectedKey, setSelectedKey] = useState<string>();
  const { type } = props;
  const api = useApi();

  const tagKeysResult = useQuery(CASES_UNIQUES('TAGS_KEY', { type }), async () => {
    return await api.getCasesUniques({
      field: 'TAGS_KEY',
      type,
    });
  });

  const tagValuesResult = useQuery(
    CASES_UNIQUES('TAGS_VALUE', { filter: selectedKey, type }),
    async () => {
      if (!selectedKey) {
        return [];
      }
      return await api.getCasesUniques({
        field: 'TAGS_VALUE',
        filter: selectedKey,
        type,
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
