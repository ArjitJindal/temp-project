import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Updater } from '@tanstack/react-table';
import { capitalizeNameFromEmail } from '@flagright/lib/utils/humanize';
import { UseQueryOptions } from '@/utils/api/types';
import { useQuery, usePaginatedQuery } from '@/utils/queries/hooks';
import { CASES_ITEM, CASES_LIST, CASES_USERS_CASEIDS } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { Case, CaseType } from '@/apis';
import { notFound } from '@/utils/errors';
import { DefaultApiGetCaseListRequest } from '@/apis/types/ObjectParamAPI';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { makeUrl } from '@/utils/routing';
import { useAuth0User } from '@/utils/user-utils';

export const useCaseDetails = (caseId: string | undefined, options?: UseQueryOptions<Case>) => {
  const api = useApi();
  return useQuery(
    CASES_ITEM(caseId),
    async () => {
      try {
        return await api.getCase({ caseId: caseId ?? '' });
      } catch (error: any) {
        if (error.code === 404) {
          notFound(`Case with ID "${caseId}" not found`);
        }
        throw error;
      }
    },
    {
      enabled: !!caseId,
      ...options,
    },
  );
};

export const useCaseList = (params: DefaultApiGetCaseListRequest) => {
  const api = useApi({ debounce: 500 });
  return usePaginatedQuery(
    CASES_LIST(params),
    async (paginationParams) => {
      const response = await api.getCaseList({ ...params, ...paginationParams });
      return {
        total: response.total,
        items: response.data,
      };
    },
    { meta: { atf: true } },
  );
};

export const useCaseItems = (params: DefaultApiGetCaseListRequest) => {
  const api = useApi();
  return useQuery(CASES_LIST(params), async () => api.getCaseList(params));
};

export const useUserCases = ({ userId, caseType }: { userId: string; caseType: CaseType }) => {
  const api = useApi();
  return useQuery(CASES_USERS_CASEIDS({ userId, caseType }), async () =>
    api.getCaseIds({ userId, filterCaseTypes: caseType }),
  );
};

export const useCaseUpdates = () => {
  const queryClient = useQueryClient();

  const updateCaseQueryData = useCallback(
    (caseId: string | undefined, updater: Updater<Case | undefined>) => {
      if (caseId) {
        queryClient.setQueryData<Case>(CASES_ITEM(caseId), updater);
      }
    },
    [queryClient],
  );

  return { updateCaseQueryData };
};

export const useCreateNewCaseMutation = ({
  onResetSelection,
}: {
  onResetSelection: () => void;
}) => {
  const api = useApi();
  const queryClient = useQueryClient();
  const user = useAuth0User();

  return useMutation<Case, unknown, { sourceCaseId: string; alertIds: string[] }>(
    async ({ sourceCaseId, alertIds }) => {
      const hideLoading = message.loading('Moving alerts to new case');
      try {
        return await api.alertsNoNewCase({
          AlertsToNewCaseRequest: { sourceCaseId, alertIds },
        });
      } finally {
        hideLoading();
      }
    },
    {
      onSuccess: async (response) => {
        message.success('A new case is created successfully', {
          link: makeUrl(`/case-management/case/${response.caseId}`),
          linkTitle: 'View case',
          details: `${capitalizeNameFromEmail(user?.name || '')} created a new manual case ${
            response.caseId
          }.`,
          copyFeedback: 'Case URL copied to clipboard',
        });
        await queryClient.invalidateQueries({ queryKey: CASES_LIST({}) });
        onResetSelection();
      },
      onError: (e) => {
        message.fatal(`Unable to create a new case! ${getErrorMessage(e)}`, e);
      },
    },
  );
};
