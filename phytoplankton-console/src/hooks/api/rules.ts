import { useMemo } from 'react';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { useMutation } from '@/utils/queries/mutations/hooks';
import type { FileInfo } from '@/apis';
import {
  NEW_RULE_ID,
  RULE_FILTERS,
  RULE_QUEUE,
  RULE_QUEUES,
  THRESHOLD_RECOMMENDATIONS,
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
