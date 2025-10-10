import { useMutation } from '@tanstack/react-query';
import { TableItem } from './types';
import { map, QueryResult } from '@/utils/queries/types';
import { TableData, TableDataItem, TableRefType } from '@/components/library/Table/types';
import { Case, CasesAssignmentsUpdateRequest, CasesReviewAssignmentsUpdateRequest } from '@/apis';
import { PaginatedData } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import { statusEscalated } from '@/utils/case-utils';

export function useTableData(
  queryResult: QueryResult<PaginatedData<Case>>,
): QueryResult<TableData<TableItem>> {
  return map(queryResult, (response) => {
    const items: TableDataItem<TableItem>[] = response.items.map(
      (item, index): TableDataItem<TableItem> => {
        const caseUser = item.caseUsers ?? {};
        const user = caseUser.origin ?? caseUser.destination ?? undefined;
        const dataItem: TableItem = {
          index,
          userId: user?.userId ?? null,
          user: user != null && 'type' in user ? user : null,
          lastStatusChangeReasons: {
            reasons: item.lastStatusChange?.reason ?? [],
            otherReason: item.lastStatusChange?.otherReason ?? null,
          },
          proposedAction: item.lastStatusChange?.caseStatus,
          ...item,
          assignments: statusEscalated(item.caseStatus) ? item.reviewAssignments : item.assignments,
          alertComments: item.alerts?.flatMap((alert) => alert.comments ?? []) ?? [],
          userRiskLevel:
            item.caseUsers?.originUserRiskLevel ?? item.caseUsers?.destinationUserRiskLevel,
        };
        return dataItem;
      },
    );
    return {
      items,
      total: response.total,
    };
  });
}

const reloadTable = (ref: React.RefObject<TableRefType>) => {
  if (ref.current) {
    ref.current.reload();
  }
};

export const useCaseReviewAssignmentUpdateMutation = (ref: React.RefObject<TableRefType>) => {
  const api = useApi();

  return useMutation<unknown, Error, CasesReviewAssignmentsUpdateRequest>(
    async ({ caseIds, reviewAssignments }) =>
      await api.patchCasesReviewAssignment({
        CasesReviewAssignmentsUpdateRequest: { caseIds, reviewAssignments },
      }),
    {
      onSuccess: () => {
        reloadTable(ref);
        message.success('Review assignees updated successfully');
      },
      onError: () => {
        message.fatal('Failed to update review assignees');
      },
    },
  );
};

export const useCaseAssignmentUpdateMutation = (ref: React.RefObject<TableRefType>) => {
  const api = useApi();

  return useMutation<unknown, Error, CasesAssignmentsUpdateRequest>(
    async ({ caseIds, assignments }) =>
      await api.patchCasesAssignment({
        CasesAssignmentsUpdateRequest: {
          caseIds,
          assignments,
        },
      }),
    {
      onSuccess: () => {
        reloadTable(ref);
        message.success('Assignees updated successfully');
      },
      onError: () => {
        message.fatal('Failed to update assignees');
      },
    },
  );
};
