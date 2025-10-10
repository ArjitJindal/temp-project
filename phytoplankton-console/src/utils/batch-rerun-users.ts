import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from './queries/hooks';
import { getOr, isLoading } from './asyncResource';
import { useMutation } from './queries/mutations/hooks';
import { BATCH_RERUN_USERS_STATUS } from './queries/keys';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';

export function useBulkRerunUsersStatus() {
  const api = useApi();
  const queryResults = useQuery(BATCH_RERUN_USERS_STATUS(), () => {
    return api.getBulkRerunRiskScoringBatchJobStatus();
  });

  return {
    data: getOr(queryResults.data, { count: 0, isAnyJobRunning: true }),
    refetch: queryResults.refetch,
    isLoading: isLoading(queryResults.data),
  };
}

export function useTriggerBulkRerunRiskScoring() {
  const api = useApi();
  const queryClient = useQueryClient();
  const bulkRerunUsersStatus = useBulkRerunUsersStatus();
  const mutation = useMutation(
    async () => {
      const messageId = message.info('Triggering bulk re-run for risk scoring...');
      const data = await api.postBatchJobBulkRerunRiskScoring();
      messageId?.();
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: BATCH_RERUN_USERS_STATUS() });
        message.success('Bulk rerun risk scoring triggered');
        bulkRerunUsersStatus.refetch();
      },
      onError: (error: Error) => {
        message.fatal(`Failed to trigger bulk rerun risk scoring: ${error.message}`);
      },
    },
  );

  return mutation;
}
