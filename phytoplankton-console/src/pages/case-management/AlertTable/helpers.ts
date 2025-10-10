import { useQueryClient } from '@tanstack/react-query';
import { capitalizeNameFromEmail } from '@flagright/lib/utils/humanize';
import { message } from '@/components/library/Message';
import { Case } from '@/apis';
import { useApi } from '@/api';
import { CASES_ITEM_ALERT_LIST, CASES_LIST } from '@/utils/queries/keys';
import { getErrorMessage } from '@/utils/lang';
import { Mutation } from '@/utils/queries/types';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { useAuth0User } from '@/utils/user-utils';
import { makeUrl } from '@/utils/routing';

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
  const user = useAuth0User();

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
        message.success('A new case is created successfully', {
          link: makeUrl(`/case-management/case/${response.caseId}`),
          linkTitle: 'View case',
          details: `${capitalizeNameFromEmail(user?.name || '')} created a new manual case ${
            response.caseId
          }.`,
          copyFeedback: 'Case URL copied to clipboard',
        });
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
