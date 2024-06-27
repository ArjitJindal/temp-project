import { UseMutationResult } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import cn from 'clsx';
import { useDebounce } from 'ahooks';
import { COPILOT_QUESTIONS, QuestionId } from '@flagright/lib/utils';
import { useFinishedSuccessfully } from '../../../utils/asyncResource';
import s from './styles.module.less';
import ExpandIcon from '@/components/library/ExpandIcon';
import Form from '@/components/library/Form';
import { getOr } from '@/utils/asyncResource';
import { getMutationAsyncResource } from '@/utils/queries/mutations/helpers';
import TextInput from '@/components/library/TextInput';
import BrainIcon from '@/components/ui/icons/brain-icon-colored.react.svg';
import BrainIconWhite from '@/components/ui/icons/brain-icon.react.svg';
import ShineIcon from '@/components/ui/icons/shining-stars.react.svg';
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { useDemoMode } from '@/components/AppWrapper/Providers/DemoModeProvider';
import { QuestionResponse } from '@/apis';
import { QuestionResponseSkeleton } from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';
import { COPILOT_SUGGESTIONS } from '@/utils/queries/keys';

type FormValues = {
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
  searchMutation: UseMutationResult<unknown, unknown, FormValues[]>;
  alertId: string;
  history: (QuestionResponse | QuestionResponseSkeleton)[];
}

export const SearchBar = (props: Props) => {
  const { searchMutation, alertId, history } = props;
  const [showMore, setShowMore] = useState<boolean>(false);
  const [demoMode] = useDemoMode();
  const mutationRes = getMutationAsyncResource(searchMutation);
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
  const highlightedSuggestion =
    highlightedSuggestionIndex != null ? suggestions[highlightedSuggestionIndex] : undefined;

  const isResponseReceived = useFinishedSuccessfully(mutationRes);

  useEffect(() => {
    setHighlightedSuggestionIndex(undefined);
  }, [searchText]);
  useEffect(() => {
    if (isResponseReceived) {
      setSearchText('');
    }
  }, [isResponseReceived]);
  const searchInputText = highlightedSuggestion ?? searchText;

  return (
    <div className={s.root}>
      {suggestions.length > 0 && (
        <div className={cn(s.grid, showMore && s.showMore)}>
          <div className={s.suggestions}>
            {suggestions.map((suggestion, i) => (
              <button
                data-cy="investigation-suggestion-button"
                key={suggestion}
                className={cn(s.suggestion, highlightedSuggestionIndex === i && s.isHighlighted)}
                onClick={() => {
                  searchMutation.mutate([{ searchString: suggestion }]);
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
          <div className={s.moreButton}>
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
      <Form initialValues={{}} className={s.form}>
        <ShineIcon height={14} />
        <div className={s.textInput}>
          <TextInput
            testName={'investigation-input'}
            placeholder="Ask ‘AI Forensics’ for investigative data using natural language"
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
        <button
          data-cy="ask-ai-button"
          type="submit"
          onClick={() => {
            setSearchText('');
            searchMutation.mutate([{ searchString: searchText }]);
          }}
          disabled={!searchInputText}
        >
          <BrainIcon height={16} />
        </button>
        {demoMode && history.length === 0 && (
          <>
            <div className={s.divider} />
            <button
              className={s.autoButton}
              onClick={() => {
                setSearchText('');
                searchMutation.mutate(SUGGESTIONS_ORDER.map((searchString) => ({ searchString })));
              }}
            >
              <BrainIconWhite height={14} /> Autopilot
            </button>
          </>
        )}
      </Form>
    </div>
  );
};
