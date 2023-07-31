import { useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import s from './index.module.less';
import { message } from '@/components/library/Message';
import { Assignment, Case, CaseStatus } from '@/apis';
import { useApi } from '@/api';
import FileListLineIcon from '@/components/ui/icons/Remix/document/file-list-line.react.svg';
import * as Form from '@/components/ui/Form';
import { useAuth0User } from '@/utils/user-utils';
import { ClosingReasonTag } from '@/pages/case-management/components/ClosingReasonTag';
import UserShared2LineIcon from '@/components/ui/icons/Remix/user/user-shared-2-line.react.svg';
import { AssigneesDropdown } from '@/pages/case-management/components/AssigneesDropdown';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import KycRiskDisplay from '@/pages/users-item/UserDetails/KycRiskDisplay';
import DynamicRiskDisplay from '@/pages/users-item/UserDetails/DynamicRiskDisplay';
import { CASES_ITEM } from '@/utils/queries/keys';
import { getErrorMessage } from '@/utils/lang';
import { useUpdateCaseQueryData } from '@/utils/api/cases';
import { isOnHoldOrInProgress, statusInReview } from '@/utils/case-utils';

interface Props {
  caseItem: Case;
}

export default function SubHeader(props: Props) {
  const { caseItem } = props;
  const { caseId } = caseItem;

  const api = useApi();
  const user = useAuth0User();
  const currentUserId = user.userId ?? undefined;
  const caseUser = caseItem.caseUsers?.origin ?? caseItem.caseUsers?.destination ?? undefined;
  const isCaseEscalated = caseItem.caseStatus === 'ESCALATED';
  const isCaseInReview = useMemo(() => statusInReview(caseItem.caseStatus), [caseItem.caseStatus]);
  const otherStatuses = useMemo(
    () => isOnHoldOrInProgress(caseItem.caseStatus as CaseStatus),
    [caseItem.caseStatus],
  );

  const assignments = useMemo(
    () => (isCaseEscalated || isCaseInReview ? caseItem.reviewAssignments : caseItem.assignments),
    [caseItem.assignments, caseItem.reviewAssignments, isCaseInReview, isCaseEscalated],
  );

  const queryClient = useQueryClient();

  const updateCaseQueryData = useUpdateCaseQueryData();
  const handleUpdateCaseMutation = useMutation<
    unknown,
    unknown,
    Assignment[],
    { previousCaseItem: Case | undefined }
  >(
    async (assignments): Promise<void> => {
      const hideMessage = message.loading(`Saving...`);
      try {
        if (caseId == null) {
          message.fatal('Case ID is missing');
          return;
        }

        if (isCaseEscalated) {
          await api.patchCasesReviewAssignment({
            CasesReviewAssignmentsUpdateRequest: {
              caseIds: [caseId],
              reviewAssignments: assignments,
            },
          });
        } else {
          await api.patchCasesAssignment({
            CasesAssignmentsUpdateRequest: {
              caseIds: [caseId],
              assignments,
            },
          });
        }

        message.success('Saved');
      } catch (error) {
        message.fatal(`Failed to save ${getErrorMessage(error)}`, error);
      } finally {
        hideMessage();
      }
    },
    {
      onMutate: async (assignments) => {
        const previousCaseItem = queryClient.getQueryData<Case>(CASES_ITEM(caseId!));
        updateCaseQueryData(caseId, (caseItem) => {
          if (caseItem == null) {
            return caseItem;
          }
          if (isCaseEscalated) {
            return {
              ...caseItem,
              reviewAssignments: assignments,
            };
          } else {
            return {
              ...caseItem,
              assignments,
            };
          }
        });
        return { previousCaseItem };
      },
      onError: async (error, _event, context) => {
        message.fatal(`Failed to save ${getErrorMessage(error)}`, error);
        updateCaseQueryData(caseId, () => context?.previousCaseItem);
      },
    },
  );

  const handleUpdateAssignments = useCallback(
    (assignees: string[]) => {
      const newAssignments = assignees.map((assigneeUserId) => ({
        assignedByUserId: currentUserId as string,
        assigneeUserId,
        timestamp: Date.now(),
      }));
      handleUpdateCaseMutation.mutate(newAssignments);
    },
    [handleUpdateCaseMutation, currentUserId],
  );

  return (
    <>
      <Feature name="PULSE">
        {caseUser?.userId && (
          <div className={s.risks}>
            <KycRiskDisplay userId={caseUser.userId} />
            <DynamicRiskDisplay userId={caseUser.userId} />
          </div>
        )}
      </Feature>
      <Form.Layout.Label icon={<UserShared2LineIcon />} title={'Assigned to'}>
        <div style={{ marginLeft: 0, marginTop: 8 }}>
          <AssigneesDropdown
            assignments={assignments ?? []}
            editing={!(statusInReview(caseItem.caseStatus) || otherStatuses)}
            onChange={handleUpdateAssignments}
          />
        </div>
      </Form.Layout.Label>
      {caseItem.caseStatus === 'CLOSED' && caseItem.lastStatusChange && (
        <Form.Layout.Label icon={<FileListLineIcon />} title={'Reason for closing'}>
          <div>
            <ClosingReasonTag
              closingReasons={caseItem.lastStatusChange.reason}
              otherReason={caseItem.lastStatusChange.otherReason}
            />
          </div>
        </Form.Layout.Label>
      )}
      {caseItem.caseStatus === 'ESCALATED' && caseItem.lastStatusChange && (
        <Form.Layout.Label icon={<FileListLineIcon />} title={'Reason for escalating'}>
          <div>
            <ClosingReasonTag
              closingReasons={caseItem.lastStatusChange.reason}
              otherReason={caseItem.lastStatusChange.otherReason}
            />
          </div>
        </Form.Layout.Label>
      )}
    </>
  );
}
