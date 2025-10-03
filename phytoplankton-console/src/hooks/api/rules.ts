import { useMemo } from 'react';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { useMutation } from '@/utils/queries/mutations/hooks';
import type { FileInfo } from '@/apis';
import { RULE_QUEUE, RULE_QUEUES } from '@/utils/queries/keys';
import { isLoading, isSuccess } from '@/utils/asyncResource';
import { RuleQueue } from '@/apis';

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
