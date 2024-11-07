import { useQueryClient } from '@tanstack/react-query';
import { message } from '@/components/library/Message';
import { Case } from '@/apis';
import { useApi } from '@/api';
import { CASES_ITEM_ALERT_LIST, CASES_LIST } from '@/utils/queries/keys';
import { getErrorMessage } from '@/utils/lang';
import { Mutation } from '@/utils/queries/types';
import { useMutation } from '@/utils/queries/mutations/hooks';

function useCreateNewCaseMutation({ onResetSelection }: { onResetSelection: () => void }): Mutation<
  unknown,
  unknown,
  {
    sourceCaseId: string;
    alertIds: string[];
  },
  unknown
> {
  const api = useApi();
  const queryClient = useQueryClient();

  const createNewCaseMutation = useMutation<
    Case,
    unknown,
    { sourceCaseId: string; alertIds: string[] }
  >(
    async ({ alertIds, sourceCaseId }) => {
      const hideLoading = message.loading('Moving alerts to new case');
      try {
        return await api.alertsNoNewCase({ AlertsToNewCaseRequest: { sourceCaseId, alertIds } });
      } finally {
        hideLoading();
      }
    },
    {
      onSuccess: async (response, variables) => {
        message.success(`New case ${response.caseId} successfully created`);
        const queryKey = CASES_ITEM_ALERT_LIST(variables.sourceCaseId);
        await queryClient.invalidateQueries({ queryKey });
        await queryClient.invalidateQueries({ queryKey: CASES_LIST({}) });
        onResetSelection();
      },
      onError: (e) => {
        message.fatal(`Unable to create a new case! ${getErrorMessage(e)}`, e);
      },
    },
  );
  return createNewCaseMutation;
}

export { useCreateNewCaseMutation };
