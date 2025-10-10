import { useApi } from '@/api';
import { AlertsQaSampling, AlertsQaSamplingRequest, AlertsQaSamplingUpdateRequest } from '@/apis';
import { message } from '@/components/library/Message';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { QueryResult } from '@/utils/queries/types';

export const useAlertsSamplingCreateMutation = (setIsModalOpen: (isOpen: boolean) => void) => {
  const api = useApi();

  return useMutation<AlertsQaSampling, unknown, AlertsQaSamplingRequest>(
    async (data) => await api.createAlertsQaSampling({ AlertsQaSamplingRequest: data }),
    {
      onSuccess: (data) => {
        setIsModalOpen(false);
        message.success('Sample created successfully with id: ' + data.samplingId);
      },
      onError: () => {
        setIsModalOpen(false);
        message.fatal('Failed to create sample');
      },
    },
  );
};

export const useAlertsSamplingUpdateMutation = (
  setIsModalOpen: (isOpen: boolean) => void,
  messages: { success: string; error: string },
  queryResult: QueryResult<unknown>,
) => {
  const api = useApi();

  const mutation = useMutation<
    AlertsQaSampling,
    unknown,
    { sampleId: string; body: AlertsQaSamplingUpdateRequest }
  >(
    async ({ sampleId, body }) =>
      await api.patchAlertsQaSample({ sampleId, AlertsQaSamplingUpdateRequest: body }),
    {
      onSuccess: () => {
        message.success(messages.success);
        queryResult?.refetch();
        setIsModalOpen(false);
      },
      onError: (error) => {
        message.fatal(messages.error, error);
      },
    },
  );

  return mutation;
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
