import React, { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CaseStatusWithDropDown } from '../../CaseStatusWithDropDown';
import SubHeader from './SubHeader';
import StatusChangeMenu from './StatusChangeMenu';
import { Case, CaseStatus, Comment } from '@/apis';
import { useApi } from '@/api';
import CasesStatusChangeButton from '@/pages/case-management/components/CasesStatusChangeButton';
import CommentButton from '@/components/CommentButton';
import { findLastStatusForInReview, statusInReview } from '@/utils/case-utils';
import { useHasPermissions } from '@/utils/user-utils';
import { message } from '@/components/library/Message';
import EntityHeader from '@/components/ui/entityPage/EntityHeader';
import CaseGenerationMethodTag from '@/components/library/CaseGenerationMethodTag';
import { CASE_AUDIT_LOGS_LIST } from '@/utils/queries/keys';

interface Props {
  caseItem: Case;
  onReload: () => void;
  onCommentAdded: (newComment: Comment) => void;
  headerStickyElRef?: React.RefCallback<HTMLDivElement>;
}

export default function Header(props: Props) {
  const { caseItem, onReload, headerStickyElRef, onCommentAdded } = props;
  const { caseId } = caseItem;

  const isReopenEnabled = useHasPermissions(['case-management:case-reopen:write']);

  const api = useApi();
  const queryClient = useQueryClient();

  const previousStatus = useMemo(() => {
    return findLastStatusForInReview(caseItem.statusChanges ?? []);
  }, [caseItem]);

  const isReview = useMemo(() => statusInReview(caseItem.caseStatus), [caseItem]);
  const statusChangeMutation = useMutation(
    async (newStatus: CaseStatus) => {
      if (caseId == null) {
        throw new Error(`Case ID is not defined`);
      }
      const hideMessage = message.loading('Changing case status...');
      try {
        await api.patchCasesStatusChange({
          CasesStatusUpdateRequest: {
            caseIds: [caseId],
            updates: {
              reason: [],
              caseStatus: newStatus,
            },
          },
        });
      } finally {
        hideMessage();
      }
    },
    {
      onSuccess: async () => {
        if (caseId != null) {
          await queryClient.invalidateQueries(CASE_AUDIT_LOGS_LIST(caseId, {}));
        }
        onReload();
      },
      onError: () => {
        message.error('Failed to change case status');
      },
    },
  );

  return (
    <EntityHeader
      stickyElRef={headerStickyElRef}
      breadcrumbItems={[
        {
          title: 'Cases',
          to: '/case-management/cases',
        },
        {
          title: caseItem.caseId ?? '',
        },
      ]}
      chips={[
        ...(caseItem.caseType === 'MANUAL' || caseItem.caseType === 'EXTERNAL'
          ? [<CaseGenerationMethodTag method={caseItem.caseType} />]
          : []),
        ...(caseItem.caseStatus
          ? [
              <CaseStatusWithDropDown
                caseStatus={caseItem.caseStatus}
                statusChanges={caseItem.statusChanges ?? []}
                previousStatus={previousStatus}
                assignments={caseItem.assignments ?? []}
                onSelect={(newStatus) => {
                  statusChangeMutation.mutate(newStatus);
                }}
                reviewAssignments={caseItem.reviewAssignments ?? []}
              />,
            ]
          : []),
      ]}
      buttons={[
        <CommentButton
          onSuccess={onCommentAdded}
          submitRequest={async (commentFormValues) => {
            if (caseId == null) {
              throw new Error(`Case ID is not defined`);
            }
            const commentData = {
              Comment: { body: commentFormValues.comment, files: commentFormValues.files },
            };
            return await api.postCaseComments({
              caseId: caseId,
              ...commentData,
            });
          }}
          requiredPermissions={['case-management:case-overview:write']}
        />,
        ...(!isReview && caseId
          ? [
              <CasesStatusChangeButton
                caseIds={[caseId]}
                caseStatus={caseItem.caseStatus}
                onSaved={onReload}
                isDisabled={caseItem.caseStatus === 'CLOSED' && !isReopenEnabled}
                statusTransitions={{
                  OPEN_IN_PROGRESS: { status: 'CLOSED', actionLabel: 'Close' },
                  OPEN_ON_HOLD: { status: 'CLOSED', actionLabel: 'Close' },
                  ESCALATED_IN_PROGRESS: { status: 'CLOSED', actionLabel: 'Close' },
                  ESCALATED_ON_HOLD: { status: 'CLOSED', actionLabel: 'Close' },
                }}
              />,
            ]
          : []),
        <StatusChangeMenu caseItem={caseItem} onReload={onReload} />,
      ]}
      subHeader={<SubHeader caseItem={caseItem} />}
    />
  );
}
