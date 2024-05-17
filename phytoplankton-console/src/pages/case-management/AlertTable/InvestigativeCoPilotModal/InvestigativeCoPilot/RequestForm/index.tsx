import React, { useEffect, useState } from 'react';
import { UseMutationResult } from '@tanstack/react-query';
import cn from 'clsx';
import { useDebounce } from 'ahooks';
import { COPILOT_QUESTIONS, QuestionId } from '@flagright/lib/utils';
import s from './index.module.less';
import { useQuery } from '@/utils/queries/hooks';
import { getMutationAsyncResource } from '@/utils/queries/mutations/helpers';
import { getOr, isLoading, useFinishedSuccessfully } from '@/utils/asyncResource';
import TextInput from '@/components/library/TextInput';
import ExpandIcon from '@/components/library/ExpandIcon';
import BrainIcon from '@/components/ui/icons/brain-icon.react.svg';
import {
  QuestionResponse,
  QuestionResponseSkeleton,
} from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';
import { useApi } from '@/api';
import { COPILOT_SUGGESTIONS } from '@/utils/queries/keys';
import Form from '@/components/library/Form';
import Button from '@/components/library/Button';
import { useDemoMode } from '@/components/AppWrapper/Providers/DemoModeProvider';

export type FormValues = {
  searchString: string;
};

const SUGGESTIONS_ORDER: readonly QuestionId[] = [
  COPILOT_QUESTIONS.USER_DETAILS,
  COPILOT_QUESTIONS.ALERTS,
  COPILOT_QUESTIONS.TRS_SCORE,
  COPILOT_QUESTIONS.TRANSACTIONS,
  COPILOT_QUESTIONS.TRANSACTION_INSIGHTS,
  COPILOT_QUESTIONS.PAYMENT_IDENTIFIERS,
  COPILOT_QUESTIONS.USERS_TRANSACTED_WITH,
  COPILOT_QUESTIONS.WEBSITE,
  COPILOT_QUESTIONS.ALERTS_THAT_RESULTED_IN_SAR,
  COPILOT_QUESTIONS.ONTOLOGY,
  COPILOT_QUESTIONS.RECOMMENDATION,
];

interface Props {
  mutation: UseMutationResult<unknown, unknown, FormValues[]>;
  history: (QuestionResponse | QuestionResponseSkeleton)[];
  alertId: string;
}

export default function RequestForm(props: Props) {
  const { mutation, history, alertId } = props;
  const [demoMode] = useDemoMode();
  const mutationRes = getMutationAsyncResource(mutation);

  const [showMore, setShowMore] = useState<boolean>(false);

  const [searchText, setSearchText] = useState<string>('');
  const debouncedSearch = useDebounce(searchText, { wait: 500 });

  const api = useApi();
  const suggestionsQueryResult = useQuery<string[]>(
    COPILOT_SUGGESTIONS(debouncedSearch),
    async () => {
      const response = await api.getQuestionAutocomplete({
        question: debouncedSearch,
        alertId,
      });
      return response.suggestions ?? [];
    },
  );

  const suggestions = getOr(suggestionsQueryResult.data, []);
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState<number>();
  const highlightedSuggestion = highlightedSuggestionIndex
    ? suggestions[highlightedSuggestionIndex]
    : undefined;

  const searchInputText = highlightedSuggestion ?? searchText;

  useEffect(() => {
    setHighlightedSuggestionIndex(undefined);
  }, [searchText]);

  const isResponseReceived = useFinishedSuccessfully(mutationRes);
  useEffect(() => {
    if (isResponseReceived) {
      setSearchText('');
    }
  }, [isResponseReceived]);

  return (
    <div className={cn(s.root, isLoading(mutationRes) && s.isLoading)}>
      <div className={s.grid}>
        {suggestions.length != 0 && (
          <div className={cn(s.suggestions, showMore && s.showMore)}>
            {suggestions.map((suggestion, i) => (
              <button
                data-cy="investigation-suggestion-button"
                key={suggestion}
                onClick={() => {
                  mutation.mutate([{ searchString: suggestion }]);
                }}
                className={cn(s.suggestion, highlightedSuggestionIndex === i && s.isHighlighted)}
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
                  if (showMore) {
                    setHighlightedSuggestionIndex(undefined);
                  }
                  setShowMore((prevState) => !prevState);
                }}
              />
            </div>
          </div>
        )}
        <Form
          initialValues={{}}
          className={s.form}
          onSubmit={() => {
            if (!isLoading(mutationRes)) {
              mutation.mutate([{ searchString: searchText }]);
            }
          }}
        >
          <div className={s.textInput}>
            <TextInput
              testName={'investigation-input'}
              value={searchInputText}
              onChange={(newValue) => {
                setHighlightedSuggestionIndex(undefined);
                setSearchText(newValue ?? '');
              }}
              onArrowUp={() => {
                setShowMore(true);
                setHighlightedSuggestionIndex((prevState) => {
                  if (prevState == null || prevState === 0) {
                    return suggestions.length - 1;
                  }
                  return prevState - 1;
                });
              }}
              onArrowDown={() => {
                setShowMore(true);
                setHighlightedSuggestionIndex((prevState) => {
                  if (prevState == null) {
                    return 0;
                  }
                  return (prevState + 1) % suggestions.length;
                });
              }}
            />
          </div>
          <Button
            testName={'ask-ai-button'}
            isDisabled={searchInputText === ''}
            isLoading={isLoading(mutationRes)}
            onClick={() => {
              if (!isLoading(mutationRes)) {
                mutation.mutate([{ searchString: searchText }]);
              }
            }}
          >
            Ask AI &nbsp; <BrainIcon className={s.brainIcon} />
          </Button>
          {demoMode && history.length === 0 && (
            <Button
              key={'Auto-pilot'}
              htmlType="button"
              onClick={async () => {
                setSearchText('');
                mutation.mutate(SUGGESTIONS_ORDER.map((searchString) => ({ searchString })));
              }}
              className={s.askAi}
            >
              Auto-pilot &nbsp; <BrainIcon className={s.brainIcon} />
            </Button>
          )}
        </Form>
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
