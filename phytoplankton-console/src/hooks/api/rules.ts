import { useMemo } from 'react';
import { useApi } from '@/api';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import { useMutation } from '@/utils/queries/mutations/hooks';
import type { FileInfo, Rule, RuleQueue } from '@/apis';
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
  RULE_STATS,
  RULES,
  RULES_WITH_ALERTS,
  GET_RULES,
  GET_RULE_INSTANCES,
} from '@/utils/queries/keys';
import { isLoading, isSuccess } from '@/utils/asyncResource';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';

export function useRulesList() {
  const api = useApi();
  return useQuery(RULES(), (): Promise<Rule[]> => api.getRules({}));
}

export function useRulesWithAlerts(options?: { enabled?: boolean }) {
  const api = useApi();
  return useQuery<string[]>(RULES_WITH_ALERTS(), () => api.getRulesWithAlerts({}), {
    enabled: options?.enabled ?? true,
  });
}

export function useRuleInstanceStats(params: {
  ruleInstanceId: string;
  afterTimestamp: number;
  beforeTimestamp: number;
}) {
  const api = useApi();
  const { ruleInstanceId, afterTimestamp, beforeTimestamp } = params;
  return useQuery(
    RULE_STATS({ ruleInstanceId, startTimestamp: afterTimestamp, endTimestamp: beforeTimestamp }),
    () =>
      api.getRuleInstancesRuleInstanceIdStats({
        ruleInstanceId,
        afterTimestamp,
        beforeTimestamp,
      }),
  );
}

export function useRuleInstances() {
  const api = useApi();
  return useQuery(['rules', 'instances', 'ALL'], async () => {
    return await api.getRuleInstances({});
  });
}

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
    return await api.getUsersUniques({ field: 'BUSINESS_INDUSTRY' });
  });
  return isSuccess(result.data) ? (result.data.value as string[]) : [];
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
    const res = await api.getRuleInstancesNewRuleId({ ruleId });
    return res.id;
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
        message.fatal(`Failed to calculate recommendations for the rule. ${getErrorMessage(e)}`, e);
      },
    },
  );
}

export function useRule(ruleId?: string) {
  const api = useApi();
  return useQuery(GET_RULE(ruleId ?? ''), async () => {
    if (ruleId == null) {
      return null;
    }
    const rule = await api.getRule({ ruleId });
    return rule;
  });
}

export function useRuleInstance(ruleInstanceId?: string) {
  const api = useApi();
  return useQuery(GET_RULE_INSTANCE(ruleInstanceId ?? ''), async () => {
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
      filterNature: filters.defaultNature as ('AML' | 'FRAUD' | 'CTF' | 'SCREENING')[] | undefined,
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

export function useMachineLearningModelsPaginated(params?: {
  modelId?: string;
  modelType?: string;
  modelName?: string;
}) {
  const api = useApi();
  return usePaginatedQuery(MACHINE_LEARNING_MODELS(params), async (paginationParams) => {
    const all = await api.getRuleMlModels({
      modelId: params?.modelId,
      modelType: params?.modelType,
      modelName: params?.modelName,
    });
    const page = paginationParams.page ?? 1;
    const pageSize = paginationParams.pageSize ?? all.length;
    const start = (page - 1) * pageSize;
    const items = all.slice(start, start + pageSize);
    return { items, total: all.length };
  });
}

export function useRulesTable(params: any) {
  const api = useApi();
  return usePaginatedQuery(GET_RULES(params), async (_paginationParams) => {
    const rules = await api.getRules();
    const result = [...rules];
    if (params.sort.length > 0) {
      const [key, order] = params.sort[0];
      result.sort((a, b) => {
        let result = 0;
        if (key === 'id') {
          result = parseInt(a.id.split('-')[1]) - parseInt(b.id.split('-')[1]);
        } else if (key === 'defaultAction') {
          const RULE_ACTION_VALUES = ['ALLOW', 'BLOCK', 'REVIEW'];
          result =
            RULE_ACTION_VALUES.indexOf(a.defaultAction) -
            RULE_ACTION_VALUES.indexOf(b.defaultAction);
        } else {
          result = a[key] > b[key] ? 1 : -1;
        }
        result *= order === 'descend' ? -1 : 1;
        return result;
      });
    }

    return {
      items: result,
      total: rules.length,
    };
  });
}

export function useRulesResults({ params, ruleMode, focusId, onViewRule }: any) {
  const api = useApi();
  return usePaginatedQuery(GET_RULE_INSTANCES({ ruleMode, params }), async (paginationParams) => {
    const ruleInstances = await api.getRuleInstances({ ...paginationParams, mode: ruleMode });
    if (focusId) {
      const ruleInstance = ruleInstances.find((r) => r.id === focusId);
      if (ruleInstance) {
        onViewRule?.(ruleInstance);
      }
    }

    // TODO: To be refactored by FR-2677
    const result = [...ruleInstances];
    if (params.sort.length > 0) {
      const [key, order] = params.sort[0];
      result.sort((a, b) => {
        let result = 0;
        if (key === 'ruleId') {
          result =
            (a.ruleId ? parseInt(a.ruleId.split('-')[1]) : 0) -
            (b.ruleId ? parseInt(b.ruleId.split('-')[1]) : 0);
        } else if (key === 'hitCount') {
          result =
            (a.hitCount && a.runCount ? a.hitCount / a.runCount : 0) -
            (b.hitCount && b.runCount ? b.hitCount / b.runCount : 0);
        } else if (key === 'createdAt') {
          result =
            a.createdAt !== undefined && b.createdAt !== undefined ? a.createdAt - b.createdAt : -1;
        } else if (key === 'updatedAt') {
          result =
            a.updatedAt !== undefined && b.updatedAt !== undefined ? a.updatedAt - b.updatedAt : -1;
        } else if (key === 'queueId') {
          result = (b.queueId || 'default') > (a.queueId || 'default') ? 1 : -1;
        } else {
          result = a[key] > b[key] ? 1 : -1;
        }

        result *= order === 'descend' ? -1 : 1;
        return result;
      });
    }

    return {
      items: result,
      total: result.length,
    };
  });
}
