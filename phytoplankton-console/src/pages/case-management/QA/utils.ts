import { AlertsQaSampling } from '@/apis';
import { message } from '@/components/library/Message';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { useCreateQaSample, useUpdateQaSample } from '@/hooks/api/alerts';
import type { QueryResult } from '@/utils/queries/types';
import { useApi } from '@/api';

export const useAlertsSamplingCreateMutation = (setIsModalOpen: (isOpen: boolean) => void) => {
  return useCreateQaSample({
    onSuccess: (data) => {
      const sampling = data as AlertsQaSampling;
      setIsModalOpen(false);
      message.success('Sample created successfully with id: ' + sampling.samplingId);
    },
    onError: () => {
      setIsModalOpen(false);
      message.fatal('Failed to create sample');
    },
  }) as any;
};

export const useAlertsSamplingUpdateMutation = (
  setIsModalOpen: (isOpen: boolean) => void,
  messages: { success: string; error: string },
  queryResult: QueryResult<unknown>,
) => {
  return useUpdateQaSample({
    onSuccess: () => {
      message.success(messages.success);
      queryResult?.refetch();
      setIsModalOpen(false);
    },
    onError: (error: any) => {
      message.fatal(messages.error, error);
    },
  }) as any;
};

export const useDeleteAlertsSamplingMutation = (
  callback: () => void,
  messages: { success: string; error: string },
  queryResult?: QueryResult<unknown>,
) => {
  const api = useApi();

  return useMutation<void, unknown, string>(
    async (sampleId) => await api.deleteAlertsQaSample({ sampleId }),
    {
      onSuccess: () => {
        message.success(messages.success);
        queryResult?.refetch();
        callback();
      },
      onError: (error) => {
        message.fatal(messages.error, error);
      },
    },
  );
};
