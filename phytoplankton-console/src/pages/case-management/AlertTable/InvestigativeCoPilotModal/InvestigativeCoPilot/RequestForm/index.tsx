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
  'Alert history',
  'Case history',
  'Which alerts have resulted in SARs?',
  'How are the transactions for this user distributed by rule action?',
  'How are the transactions for this user distributed by type?',
  'How has the TRS score changed over the last week?',
  'What are the top 10 payment identifiers they have received money from?',
  'What are the top 10 payment identifiers they have send money to?',
  'Who are the top 10 users they have received money from?',
  'Who are the top 10 users they have sent money to?',
];

export default function RequestForm(props: Props) {
  const { mutation } = props;
  const mutationRes = getMutationAsyncResource(mutation);

  const [searchText, setSearchText] = useState<string | undefined>('');
  const filteredSuggestions = SUPPORTED_SEARCHES.filter((x) =>
    searchText ? x.toLowerCase().indexOf(searchText.toLowerCase()) !== -1 : true,
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
