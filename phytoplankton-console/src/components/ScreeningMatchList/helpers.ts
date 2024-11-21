import { useQueryClient } from '@tanstack/react-query';
import { message } from '../library/Message';
import { useApi } from '@/api';
import {
  SanctionHitStatusUpdateRequest,
  SanctionsHit,
  SanctionsHitListResponse,
  SanctionsHitStatus,
} from '@/apis';
import {
  ALERT_ITEM_COMMENTS,
  SANCTIONS_HITS_ALL,
  SANCTIONS_HITS_SEARCH,
} from '@/utils/queries/keys';
import { AllParams } from '@/components/library/Table/types';
import { CursorPaginatedData, useCursorQuery } from '@/utils/queries/hooks';
import { Mutation, QueryResult } from '@/utils/queries/types';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { getErrorMessage } from '@/utils/lang';

export interface SanctionsHitsTableParams {
  statuses?: SanctionsHitStatus[];
  searchTerm?: string;
  fuzziness?: number;
}

export function useSanctionHitsQuery(
  params: AllParams<SanctionsHitsTableParams>,
  alertId?: string,
): QueryResult<CursorPaginatedData<SanctionsHit>> {
  const api = useApi();
  const filters = {
    alertId: alertId,
    filterStatus: params.statuses ?? ['OPEN' as const],
  };
  return useCursorQuery(
    SANCTIONS_HITS_SEARCH({ ...filters, ...params }),
    async (paginationParams): Promise<SanctionsHitListResponse> => {
      if (!filters.alertId) {
        return {
          items: [],
          next: '',
          prev: '',
          last: '',
          hasNext: false,
          hasPrev: false,
          count: 0,
          limit: 100000,
        };
      }
      const request = {
        ...filters,
        ...params,
        ...paginationParams,
      };
      return await api.searchSanctionsHits({
        ...request,
        start: request.from,
      });
    },
  );
}

type ReturnType = {
  changeHitsStatusMutation: Mutation<
    unknown,
    unknown,
    {
      toChange: { alertId: string; sanctionHitIds: string[] }[];
      updates: SanctionHitStatusUpdateRequest;
    }
  >;
};

export const useChangeSanctionsHitsStatusMutation = (): ReturnType => {
  const api = useApi();
  const queryClient = useQueryClient();

  const changeHitsStatusMutation = useMutation<
    unknown,
    unknown,
    {
      toChange: { alertId: string; sanctionHitIds: string[] }[];
      updates: SanctionHitStatusUpdateRequest;
    },
    unknown
  >(
    async (variables: {
      toChange: { alertId: string; sanctionHitIds: string[] }[];
      updates: SanctionHitStatusUpdateRequest;
    }) => {
      const hideMessage = message.loading(`Saving...`);
      const { toChange, updates } = variables;
      try {
        for (const { alertId, sanctionHitIds } of toChange) {
          await api.changeSanctionsHitsStatus({
            SanctionHitsStatusUpdateRequest: {
              alertId,
              sanctionHitIds,
              updates,
            },
          });
        }
      } finally {
        hideMessage();
      }
    },
    {
      onError: (e) => {
        message.error(`Failed to update hits! ${getErrorMessage(e)}`);
      },
      onSuccess: async (_, variables) => {
        message.success(`Done!`);
        await queryClient.invalidateQueries(SANCTIONS_HITS_ALL());
        for (const { alertId } of variables.toChange) {
          await queryClient.invalidateQueries(ALERT_ITEM_COMMENTS(alertId));
        }
      },
    },
  );

  return {
    changeHitsStatusMutation,
  };
};

type SelectedSanctionHits = {
  [alertId: string]: {
    id: string;
    status?: SanctionsHitStatus;
  }[];
};

export const updateSanctionsData = (
  formValues: SanctionHitStatusUpdateRequest & { newStatus: SanctionsHitStatus },
  selectedSanctionHits: SelectedSanctionHits,
) => {
  return {
    toChange: Object.entries(selectedSanctionHits).map(([alertId, sanctionHitIds]) => ({
      alertId,
      sanctionHitIds: sanctionHitIds.map(({ id }) => id),
    })),
    updates: {
      comment: formValues.comment,
      files: formValues.files,
      reasons: formValues.reasons,
      whitelistHits: formValues.whitelistHits,
      removeHitsFromWhitelist: formValues.removeHitsFromWhitelist,
      status: formValues.newStatus,
    },
  };
};
