import React, { useState } from 'react';
import { UseMutationResult } from '@tanstack/react-query';
import cn from 'clsx';
import s from './index.module.less';
import { getMutationAsyncResource } from '@/utils/queries/hooks';
import { isLoading } from '@/utils/asyncResource';
import TextInput from '@/components/library/TextInput';
import ExpandIcon from '@/components/library/ExpandIcon';
import BrainIcon from '@/components/ui/icons/brain-icon.react.svg';
import { QuestionResponse } from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';

export type FormValues = {
  searchString: string;
};

interface Props {
  mutation: UseMutationResult<unknown, unknown, FormValues>;
  items: QuestionResponse[];
}

const SUPPORTED_SEARCHES = [
  'Alert history',
  'Case history',
  'Alerts that resulted in SAR',
  'Transactions by rule action',
  'Transactions by type',
  'TRS score',
  'Payment identifiers of receivers',
  'Payment identifiers of senders',
  'Users money sent to',
  'Users money received from',
  'Alerts related to transaction',
  'Transactions leading to rule hit',
  'Transactions',
];

export default function RequestForm(props: Props) {
  const { mutation, items } = props;
  const mutationRes = getMutationAsyncResource(mutation);

  const [searchText, setSearchText] = useState<string | undefined>('');
  const [showMore, setShowMore] = useState<boolean>(false);
  const filteredSuggestions = SUPPORTED_SEARCHES.filter((x) =>
    searchText ? x.toLowerCase().indexOf(searchText.toLowerCase()) !== -1 : true,
  );

  return (
    <div className={cn(s.root, isLoading(mutationRes) && s.isLoading)}>
      <div className={s.form}>
        <div className={cn(s.suggestions, showMore && s.showMore)}>
          {searchText && searchText?.length > 0 && (
            <button
              key={'Ask AI'}
              onClick={() => {
                mutation.mutate({ searchString: searchText || '' });
                setSearchText(undefined);
              }}
              className={s.askAi}
            >
              Ask AI &nbsp; <BrainIcon />
            </button>
          )}
          {items.length === 0 && (
            <button
              key={'Auto-pilot'}
              onClick={async () => {
                setSearchText(undefined);
                await Promise.all(
                  randomSubset(SUPPORTED_SEARCHES, 3).map(async (search) =>
                    mutation.mutate({ searchString: search }),
                  ),
                );
              }}
              className={s.askAi}
            >
              Auto-pilot &nbsp; <BrainIcon />
            </button>
          )}
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => {
                mutation.mutate({ searchString: suggestion });
                setSearchText(undefined);
              }}
              className={s.suggestion}
            >
              {suggestion}
            </button>
          ))}

          <div className={cn(s.moreButton)}>
            <ExpandIcon
              size="BIG"
              color="BLACK"
              isExpanded={showMore}
              onClick={() => {
                setShowMore((prevState) => !prevState);
              }}
            />
          </div>
        </div>
        <TextInput value={searchText} onChange={setSearchText} />
      </div>
    </div>
  );
}

export function randomSubset<T>(variants: T[], limit: number): T[] {
  const shuffled = [...variants];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, limit);
}
