import { useMemo } from 'react';
import { isLoading, isSuccess } from '@/utils/asyncResource';
import { useQuery } from '@/utils/queries/hooks';
import { RULE_QUEUE, RULE_QUEUES, USERS_UNIQUES } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { RuleQueue } from '@/apis';

export function useRuleQueue(queueId?: string): [RuleQueue | null, boolean] {
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
  const params = { pageSize: 1000 };
  const queryResult = useQuery(RULE_QUEUES(params), async () => {
    return await api.getRuleQueues(params);
  });
  return isSuccess(queryResult.data) ? queryResult.data.value.data : [];
}

export function useBusinessIndustries(): string[] {
  const api = useApi();
  const result = useQuery(USERS_UNIQUES('BUSINESS_INDUSTRY'), () =>
    api.getUsersUniques({ field: 'BUSINESS_INDUSTRY' }),
  );
  return isSuccess(result.data) ? result.data.value : [];
}
