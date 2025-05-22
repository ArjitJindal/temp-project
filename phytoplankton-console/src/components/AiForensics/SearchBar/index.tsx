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
import BrainIconWhite from '@/components/ui/icons/brain-icon.react.svg';
import ShineIcon from '@/components/ui/icons/shining-stars.react.svg';
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { useDemoMode } from '@/components/AppWrapper/Providers/DemoModeProvider';
import {
  QuestionResponse,
  QuestionResponseSkeleton,
} from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';
import { ALERT_ITEM, COPILOT_SUGGESTIONS } from '@/utils/queries/keys';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import AiForensicsLogo from '@/components/ui/AiForensicsLogo';

type FormValues = {
  searchString: string;
};

let SUGGESTIONS_ORDER: QuestionId[] = [
  COPILOT_QUESTIONS.USER_DETAILS,
  COPILOT_QUESTIONS.ALERTS,
  COPILOT_QUESTIONS.TRS_SCORE,
  COPILOT_QUESTIONS.TRANSACTIONS,
  COPILOT_QUESTIONS.TRANSACTION_INSIGHTS,
  COPILOT_QUESTIONS.PAYMENT_IDENTIFIERS,
  COPILOT_QUESTIONS.USERS_TRANSACTED_WITH,
  COPILOT_QUESTIONS.ALERTS_THAT_RESULTED_IN_SAR,
];

interface Props {
  searchMutation: UseMutationResult<unknown, unknown, FormValues[]>;
  alertId: string;
  history: (QuestionResponse | QuestionResponseSkeleton)[];
}

export const SearchBar = (props: Props) => {
  const { searchMutation, alertId, history } = props;
  const isClickhouseEnabled = useFeatureEnabled('CLICKHOUSE_ENABLED');
  const [showMore, setShowMore] = useState<boolean>(false);
  const [isDemoModeRes] = useDemoMode();
  const isDemoMode = getOr(isDemoModeRes, false);
  const mutationRes = getMutationAsyncResource(searchMutation);
  const [searchText, setSearchText] = useState<string>('');
  const debouncedSearch = useDebounce(searchText, { wait: 500 });
  const [clickedSuggestions, setClickedSuggestions] = useState<Set<string>>(new Set());

  const api = useApi();
  const alertQueryResult = useQuery(ALERT_ITEM(alertId), async () => {
    const response = await api.getAlert({ alertId });
    return response;
  });
  const alert = getOr(alertQueryResult.data, undefined);
  const suggestionsQueryResult = useQuery<string[]>(
    COPILOT_SUGGESTIONS(debouncedSearch, alertId),
    async () => {
      const response = await api.getQuestionAutocomplete({
        question: debouncedSearch,
        alertId,
      });
      return response.suggestions ?? [];
    },
  );

  const handleSuggestionClick = (suggestion: string) => {
    setClickedSuggestions((prev) => new Set(prev).add(suggestion));
    setHighlightedSuggestionIndex(undefined);
    searchMutation.mutate([{ searchString: suggestion }]);
  };

  const rawSuggestions = getOr(suggestionsQueryResult.data, []);
  const displayedSuggestions = rawSuggestions.filter((s) => !clickedSuggestions.has(s));

  const isOntologyEnabled = useFeatureEnabled('ENTITY_LINKING');
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState<number>();
  const highlightedSuggestion =
    highlightedSuggestionIndex != null
      ? displayedSuggestions[highlightedSuggestionIndex]
      : undefined;

  const isResponseReceived = useFinishedSuccessfully(mutationRes);

  useEffect(() => {
    setHighlightedSuggestionIndex(undefined);
  }, [searchText]);
  useEffect(() => {
    if (isResponseReceived) {
      setSearchText('');
    }
  }, [isResponseReceived]);
  useEffect(() => {
    setClickedSuggestions(new Set());
    setHighlightedSuggestionIndex(undefined);
  }, [debouncedSearch]);
  const searchInputText = highlightedSuggestion ?? searchText;

  if (!isClickhouseEnabled) {
    return null;
  }

  return (
    <div className={s.root}>
      {displayedSuggestions.length > 0 && (
        <div className={cn(s.grid, showMore && s.showMore)}>
          <div className={s.suggestions}>
            {displayedSuggestions.map((suggestion, i) => (
              <button
                data-cy="investigation-suggestion-button"
                key={suggestion}
                className={cn(s.suggestion, highlightedSuggestionIndex === i && s.isHighlighted)}
                onClick={() => handleSuggestionClick(suggestion)}
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
            disableBorders={true}
            placeholder="Ask 'AI Forensics' for investigative data using natural language"
            value={searchInputText}
            onChange={(newValue) => {
              setHighlightedSuggestionIndex(undefined);
              setSearchText(newValue ?? '');
            }}
            onArrowUp={() => {
              setShowMore(true);
              setHighlightedSuggestionIndex((prevState) => {
                if (displayedSuggestions.length === 0) {
                  return undefined;
                }
                if (prevState == null || prevState === 0) {
                  return displayedSuggestions.length - 1;
                }
                return prevState - 1;
              });
            }}
            onArrowDown={() => {
              setShowMore(true);
              setHighlightedSuggestionIndex((prevState) => {
                if (displayedSuggestions.length === 0) {
                  return undefined;
                }
                if (prevState == null) {
                  return 0;
                }
                return (prevState + 1) % displayedSuggestions.length;
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
          <AiForensicsLogo />
        </button>
        {history.length === 0 && (
          <>
            <div className={s.divider} />
            <button
              className={s.autoButton}
              onClick={() => {
                setSearchText('');
                if (isOntologyEnabled) {
                  SUGGESTIONS_ORDER.push(COPILOT_QUESTIONS.ONTOLOGY);
                }

                if (isDemoMode) {
                  SUGGESTIONS_ORDER.push(COPILOT_QUESTIONS.RECOMMENDATION);
                }

                // is any search id is present in the alert
                const isSearchIdPresent = alert?.ruleHitMeta?.sanctionsDetails?.some(
                  (detail) => !!detail.searchId,
                );

                if (isSearchIdPresent) {
                  SUGGESTIONS_ORDER = [
                    COPILOT_QUESTIONS.USER_DETAILS,
                    COPILOT_QUESTIONS.OPEN_HITS,
                    COPILOT_QUESTIONS.CLEARED_HITS,
                  ];
                }

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
