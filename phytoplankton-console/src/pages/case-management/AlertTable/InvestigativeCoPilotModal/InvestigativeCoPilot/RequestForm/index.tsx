import React, { useState } from 'react';
import { UseMutationResult } from '@tanstack/react-query';
import cn from 'clsx';
import s from './index.module.less';
import { getMutationAsyncResource } from '@/utils/queries/hooks';
import { isLoading } from '@/utils/asyncResource';
import TextInput from '@/components/library/TextInput';

export type FormValues = {
  searchString: string;
};

interface Props {
  mutation: UseMutationResult<unknown, unknown, FormValues>;
}

const SUPPORTED_SEARCHES = [
  'Case history',
  'Alert history',
  'Transaction details',
  'Tx’n distribution by type',
  'Which alerts have resulted in SARs?',
  'Who are the top 10 users by total amount they have sent money to?',
  'How does the TRS score change over the last week?',
  'Which transactions resulted in this alert?',
  'How are the transactions for this user distributed by type?',
  'What different payment identifiers have been used by this user?',
  'How are the transactions for this user distributed by rule action?',
  'What is the case history for this user?',
];

export default function RequestForm(props: Props) {
  const { mutation } = props;
  const mutationRes = getMutationAsyncResource(mutation);

  const [searchText, setSearchText] = useState<string | undefined>('');
  const filteredSuggestions = SUPPORTED_SEARCHES.filter((x) =>
    searchText ? x.indexOf(searchText) !== -1 : true,
  );

  return (
    <div className={cn(s.root, isLoading(mutationRes) && s.isLoading)}>
      <div className={s.form}>
        {filteredSuggestions.length > 0 && (
          <div className={s.suggestions}>
            {filteredSuggestions.map((suggestion) => (
              <button
                onClick={() => {
                  mutation.mutate({ searchString: suggestion });
                  setSearchText(undefined);
                }}
                key={suggestion}
                className={s.suggestion}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        <TextInput value={searchText} onChange={setSearchText} />
      </div>
    </div>
  );
}
