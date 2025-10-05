import { useMemo } from 'react';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { useMutation } from '@/utils/queries/mutations/hooks';
import type { FileInfo, Rule, RuleInstance } from '@/apis';
import {
  NEW_RULE_ID,
  RULE_FILTERS,
  RULE_QUEUE,
  RULE_QUEUES,
  THRESHOLD_RECOMMENDATIONS,
  GET_RULE,
  GET_RULE_INSTANCE,
  RULES_UNIVERSAL_SEARCH,
  MACHINE_LEARNING_MODELS,
} from '@/utils/queries/keys';
import { isLoading, isSuccess } from '@/utils/asyncResource';
import { RuleQueue } from '@/apis';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';

export function useRuleQueue(
  queueId?: string,
): [ruleQueue: RuleQueue | null, isLoadingState: boolean] {
  const api = useApi();
  const ruleQueueResult = useQuery(RULE_QUEUE(queueId), async () => {
    if (!queueId) {
      return null;
    }
    return api.getRuleQueue({
      ruleQueueId: queueId,
    });
  });
  const ruleQueue = useMemo(() => {
    return isSuccess(ruleQueueResult.data) ? ruleQueueResult.data.value : null;
  }, [ruleQueueResult.data]);
  return [ruleQueue, isLoading(ruleQueueResult.data)];
}

export function useRuleQueues(): RuleQueue[] {
  const api = useApi();
  const params = { pageSize: 1000 } as const;
  const queryResult = useQuery(RULE_QUEUES(params), async () => {
    return await api.getRuleQueues(params);
  });
  return isSuccess(queryResult.data) ? queryResult.data.value.data : [];
}

export function useBusinessIndustries(): string[] {
  const api = useApi();
  const result = useQuery(['users', 'uniques', 'BUSINESS_INDUSTRY'], async () => {
    return await api.getUsersUniques({ field: 'BUSINESS_INDUSTRY' as any });
  });
  return isSuccess(result.data) ? (result.data.value as unknown as string[]) : [];
}

export function useImportRules() {
  const api = useApi();
  return useMutation((file: FileInfo) =>
    api.postRulesImport({
      ImportConsoleDataRequest: { file },
    }),
  );
}

export function useRuleFilters() {
  const api = useApi();
  return useQuery(RULE_FILTERS(), () => api.getRuleFilters());
}

export function useNewRuleId(ruleId?: string) {
  const api = useApi();
  return useQuery(NEW_RULE_ID(ruleId), async () => {
    return await api.getRuleInstancesNewRuleId({ ruleId });
  });
}

export function useRuleThresholdRecommendations(ruleInstanceId: string) {
  const api = useApi();
  return useQuery(
    THRESHOLD_RECOMMENDATIONS(ruleInstanceId),
    async () => {
      const result = await api.getRuleInstanceRuleInstanceIdRecommendation({ ruleInstanceId });
      return result;
    },
    {
      onError: (e) => {
        message.fatal(
          `Failed to calculate recommendations for the rule. ${getErrorMessage(e as any)}`,
          e as any,
        );
      },
    },
  );
}

export function useRule(ruleId?: string) {
  const api = useApi();
  return useQuery<Rule | null>(GET_RULE(ruleId as any), async () => {
    if (ruleId == null) {
      return null;
    }
    const rule = await api.getRule({ ruleId });
    return rule;
  });
}

export function useRuleInstance(ruleInstanceId?: string) {
  const api = useApi();
  return useQuery<RuleInstance>(GET_RULE_INSTANCE(ruleInstanceId as any), async () => {
    if (ruleInstanceId == null) {
      throw new Error('ruleInstanceId can not be null');
    }
    const ruleInstance = await api.getRuleInstancesItem({ ruleInstanceId });
    return ruleInstance;
  });
}

export function useRulesUniversalSearch(
  search: string,
  filters: {
    typologies: string[];
    checksFor: string[];
    defaultNature: string[];
    types: string[] | string;
    tags: any[];
  },
  options?: { isAISearch?: boolean; disableGptSearch?: boolean },
) {
  const api = useApi();
  return useQuery(RULES_UNIVERSAL_SEARCH(search ?? ''), async () => {
    const result = await api.getRulesSearch({
      queryStr: search || '',
      filterTypology: filters.typologies,
      filterChecksFor: filters.checksFor,
      filterNature: filters.defaultNature as any,
      filterTypes: Array.isArray(filters.types) ? filters.types : [filters.types],
      filterTags: filters.tags,
      isAISearch: options?.isAISearch,
      disableGptSearch: options?.disableGptSearch,
    });
    return result;
  });
}

export function useMachineLearningModels() {
  const api = useApi();
  return useQuery(MACHINE_LEARNING_MODELS(), async () => await api.getRuleMlModels());
}
