import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from '@/components/library/Message';
import { Case } from '@/apis';
import { useApi } from '@/api';
import { CASES_ITEM_ALERT_LIST, CASES_LIST } from '@/utils/queries/keys';
import { getErrorMessage } from '@/utils/lang';

const useCreateNewCaseMutation = ({
  setSelectedEntities,
}: {
  setSelectedEntities: (value: string[]) => void;
}) => {
  const api = useApi();
  const queryClient = useQueryClient();

  const createNewCaseMutation = useMutation<
    Case,
    unknown,
    {
      sourceCaseId: string;
      alertIds: string[];
    }
  >(
    async ({ alertIds, sourceCaseId }) => {
      const hideLoading = message.loading('Moving alerts to new case');
      try {
        return await api.alertsNoNewCase({
          AlertsToNewCaseRequest: {
            sourceCaseId,
            alertIds,
          },
        });
      } finally {
        hideLoading();
      }
    },
    {
      onSuccess: async (response, variables) => {
        message.success(`New case ${response.caseId} successfully created`);
        await queryClient.invalidateQueries({
          queryKey: CASES_ITEM_ALERT_LIST(variables.sourceCaseId),
        });
        await queryClient.invalidateQueries({
          queryKey: CASES_LIST({}),
        });
        setSelectedEntities([]);
      },
      onError: (e) => {
        message.error(`Unable to create a new case! ${getErrorMessage(e)}`);
      },
    },
  );
  return createNewCaseMutation;
};

export { useCreateNewCaseMutation };
