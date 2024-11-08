import React, { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { CaseStatusWithDropDown } from '../../CaseStatusWithDropDown';
import ExportButton from './ExportButton';
import SubHeader from './SubHeader';
import StatusChangeMenu from './StatusChangeMenu';
import { Account, Case, CaseStatus, Comment } from '@/apis';
import { useApi } from '@/api';
import CasesStatusChangeButton, {
  CasesStatusChangeButtonProps,
} from '@/pages/case-management/components/CasesStatusChangeButton';
import CommentButton from '@/components/CommentButton';
import {
  canMutateEscalatedCases,
  findLastStatusForInReview,
  statusEscalated,
  statusEscalatedL2,
  statusInReview,
} from '@/utils/case-utils';
import { useAuth0User, useHasPermissions, useUser } from '@/utils/user-utils';
import { message } from '@/components/library/Message';
import EntityHeader from '@/components/ui/entityPage/EntityHeader';
import CaseGenerationMethodTag from '@/components/library/CaseGenerationMethodTag';
import { CASE_AUDIT_LOGS_LIST } from '@/utils/queries/keys';
import { useBackUrl } from '@/utils/backUrl';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { SarButton } from '@/components/Sar';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  isLoading: boolean;
  caseItem: Case;
  onReload: () => void;
  onCommentAdded: (newComment: Comment, groupId: string) => void;
  headerStickyElRef?: React.RefCallback<HTMLDivElement>;
}

function getStatusChangeButtonConfig(
  caseItem: Case,
  caseId: string,
  userAccount: Account | null,
  canMutateCases: boolean,
  isReopenEnabled: boolean,
  isLoading: boolean,
  handleStatusChangeSuccess: () => void,
  isEscalated: boolean,
  isEscalatedL2: boolean,
): CasesStatusChangeButtonProps | null {
  const { caseStatus } = caseItem;
  const isDisabled = (caseStatus === 'CLOSED' && !isReopenEnabled) || isLoading;

  if (isEscalatedL2 && canMutateCases && userAccount?.escalationLevel === 'L2') {
    return {
      caseIds: [caseId],
      caseStatus,
      onSaved: handleStatusChangeSuccess,
      isDisabled,
      statusTransitions: {
        ESCALATED_L2: { status: 'CLOSED', actionLabel: 'Close' },
        ESCALATED_L2_IN_PROGRESS: { status: 'CLOSED', actionLabel: 'Close' },
        ESCALATED_L2_ON_HOLD: { status: 'CLOSED', actionLabel: 'Close' },
      },
    };
  } else if (isEscalated && canMutateCases && !isEscalatedL2) {
    return {
      caseIds: [caseId],
      caseStatus,
      onSaved: handleStatusChangeSuccess,
      isDisabled,
      statusTransitions: {
        ESCALATED_IN_PROGRESS: { status: 'CLOSED', actionLabel: 'Close' },
        ESCALATED_ON_HOLD: { status: 'CLOSED', actionLabel: 'Close' },
      },
    };
  } else if (!isEscalated && !isEscalatedL2) {
    return {
      caseIds: [caseId],
      caseStatus,
      onSaved: handleStatusChangeSuccess,
      isDisabled,
      statusTransitions: {
        OPEN_IN_PROGRESS: { status: 'CLOSED', actionLabel: 'Close' },
        OPEN_ON_HOLD: { status: 'CLOSED', actionLabel: 'Close' },
      },
    };
  }
  return null;
}

interface StatusChangeButtonProps {
  caseItem: Case;
  caseId: string;
  userAccount: Account | null;
  canMutateCases: boolean;
  isReopenEnabled: boolean;
  isLoading: boolean;
  handleStatusChangeSuccess: () => void;
  isEscalated: boolean;
  isEscalatedL2: boolean;
}

const StatusChangeButton: React.FC<StatusChangeButtonProps> = ({
  caseItem,
  caseId,
  userAccount,
  canMutateCases,
  isReopenEnabled,
  isLoading,
  handleStatusChangeSuccess,
  isEscalated,
  isEscalatedL2,
}) => {
  const config = getStatusChangeButtonConfig(
    caseItem,
    caseId,
    userAccount,
    canMutateCases,
    isReopenEnabled,
    isLoading,
    handleStatusChangeSuccess,
    isEscalated,
    isEscalatedL2,
  );

  return config ? <CasesStatusChangeButton {...config} /> : null;
};

export default function Header(props: Props) {
  const { isLoading, caseItem, onReload, headerStickyElRef, onCommentAdded } = props;
  const { caseId } = caseItem;
  const backUrl = useBackUrl();
  const isMultiLevelEscalationEnabled = useFeatureEnabled('MULTI_LEVEL_ESCALATION');
  const navigate = useNavigate();
  const user = useAuth0User();
  const userAccount = useUser(user.userId);
  const isReopenEnabled = useHasPermissions(['case-management:case-reopen:write']);

  const api = useApi();
  const queryClient = useQueryClient();

  const previousStatus = useMemo(() => {
    return findLastStatusForInReview(caseItem.statusChanges ?? []);
  }, [caseItem]);

  const handleStatusChangeSuccess = (updatedStatus?: CaseStatus) => {
    if (updatedStatus === 'CLOSED') {
      if (backUrl && backUrl.startsWith('/case-management/cases')) {
        navigate(backUrl);
      } else {
        navigate('/case-management/cases');
      }
    } else {
      onReload();
    }
  };

  const isReview = useMemo(() => statusInReview(caseItem.caseStatus), [caseItem]);
  const isEscalated = useMemo(() => statusEscalated(caseItem.caseStatus), [caseItem]);
  const isEscalatedL2 = useMemo(() => statusEscalatedL2(caseItem.caseStatus), [caseItem]);
  const canMutateCases = useMemo(
    () =>
      canMutateEscalatedCases(
        { [caseItem.caseId ?? '']: caseItem },
        user.userId,
        isMultiLevelEscalationEnabled,
      ),
    [caseItem, isMultiLevelEscalationEnabled, user.userId],
  );
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
        handleStatusChangeSuccess(newStatus);
      } finally {
        hideMessage();
      }
    },
    {
      onSuccess: async () => {
        if (caseId != null) {
          await queryClient.invalidateQueries(CASE_AUDIT_LOGS_LIST(caseId, {}));
        }
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
          disabled={isLoading}
          onSuccess={(newComment) => {
            onCommentAdded(newComment, caseId ?? '');
          }}
          submitRequest={async (commentFormValues) => {
            if (caseId == null) {
              throw new Error(`Case ID is not defined`);
            }
            const commentData = {
              CommentRequest: { body: commentFormValues.comment, files: commentFormValues.files },
            };
            return await api.postCaseComments({
              caseId: caseId,
              ...commentData,
            });
          }}
          requiredPermissions={['case-management:case-overview:write']}
        />,
        <ExportButton caseItem={caseItem} />,
        ...(caseId != null
          ? [<SarButton caseId={caseId} alertIds={[]} transactionIds={[]} />]
          : []),
        ...(!isReview && caseId
          ? [
              <StatusChangeButton
                caseItem={caseItem}
                caseId={caseId}
                userAccount={userAccount}
                canMutateCases={canMutateCases}
                isReopenEnabled={isReopenEnabled}
                isLoading={isLoading}
                handleStatusChangeSuccess={handleStatusChangeSuccess}
                isEscalated={isEscalated}
                isEscalatedL2={isEscalatedL2}
              />,
            ]
          : []),
        <StatusChangeMenu
          isDisabled={isLoading}
          caseItem={caseItem}
          onReload={handleStatusChangeSuccess}
        />,
      ]}
      subHeader={<SubHeader caseItem={caseItem} />}
    />
  );
}
