import React, { useMemo } from 'react';
import _ from 'lodash';
import { useMutation } from '@tanstack/react-query';
import { CaseStatusWithDropDown } from '../../CaseStatusWithDropDown';
import SubHeader from './SubHeader';
import s from './index.module.less';
import { Case, CaseStatus, Comment } from '@/apis';
import { useApi } from '@/api';
import BriefcaseLineIcon from '@/components/ui/icons/Remix/business/briefcase-line.react.svg';
import * as Form from '@/components/ui/Form';
import LegacyEntityHeader from '@/components/ui/entityPage/LegacyEntityHeader';
import CasesStatusChangeButton from '@/pages/case-management/components/CasesStatusChangeButton';
import { FalsePositiveTag } from '@/pages/case-management/components/FalsePositiveTag';
import CommentButton from '@/components/CommentButton';
import { getUserLink, getUserName } from '@/utils/api/users';
import Id from '@/components/ui/Id';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { makeUrl } from '@/utils/routing';
import { ApproveSendBackButton } from '@/pages/case-management/components/ApproveSendBackButton';
import {
  canReviewCases,
  findLastStatusForInReview,
  isInReviewCases,
  statusInReview,
} from '@/utils/case-utils';
import { useAuth0User, useHasPermissions } from '@/utils/user-utils';
import { CloseMessage, message } from '@/components/library/Message';

interface Props {
  caseItem: Case;
  onReload: () => void;
  onCommentAdded: (newComment: Comment) => void;
  headerStickyElRef?: React.RefCallback<HTMLDivElement>;
}

export default function Header(props: Props) {
  const { caseItem, onReload, headerStickyElRef, onCommentAdded } = props;
  const { caseId } = caseItem;

  const user = caseItem.caseUsers?.origin?.userId
    ? caseItem.caseUsers?.origin
    : caseItem.caseUsers?.destination?.userId
    ? caseItem.caseUsers?.destination
    : undefined;
  const escalationEnabled = useFeatureEnabled('ESCALATION');
  const isReopenEnabled = useHasPermissions(['case-management:case-reopen:write']);

  const caseClosedBefore = Boolean(
    caseItem.statusChanges?.find((statusChange) => statusChange.caseStatus === 'CLOSED'),
  );
  const api = useApi();

  const currentUser = useAuth0User();

  const displayApproveButtons = useMemo(() => {
    return (
      isInReviewCases({ [caseId as string]: caseItem }) &&
      canReviewCases({ [caseId as string]: caseItem }, currentUser.userId)
    );
  }, [caseItem, caseId, currentUser]);

  const previousStatus = useMemo(() => {
    return findLastStatusForInReview(caseItem.statusChanges ?? []);
  }, [caseItem]);

  const isReview = useMemo(() => statusInReview(caseItem.caseStatus), [caseItem]);
  let messageText: CloseMessage | undefined;
  const statusChangeMutation = useMutation(
    async (newStatus: CaseStatus) => {
      if (caseId == null) {
        throw new Error(`Case ID is not defined`);
      }
      messageText = message.loading('Changing case status...');
      await api.patchCasesStatusChange({
        CasesStatusUpdateRequest: {
          caseIds: [caseId],
          updates: {
            reason: [],
            caseStatus: newStatus,
          },
        },
      });
    },
    {
      onSuccess: () => {
        onReload();
        messageText?.();
      },
      onError: () => {
        message.error('Failed to change case status');
        messageText?.();
      },
    },
  );

  return (
    <LegacyEntityHeader
      stickyElRef={headerStickyElRef}
      idTitle={'Case ID'}
      tag={
        caseItem.falsePositiveDetails &&
        caseId &&
        caseItem.falsePositiveDetails.isFalsePositive && (
          <FalsePositiveTag
            caseIds={[caseId]}
            onSaved={() => {
              // todo: implement in-place update instead of reloading
              onReload();
            }}
            newCaseStatus={caseItem.caseStatus === 'OPEN' ? 'CLOSED' : 'REOPENED'}
            confidence={caseItem.falsePositiveDetails.confidenceScore}
          />
        )
      }
      id={caseId}
      buttons={
        <>
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
          />
          {isReview && caseId && displayApproveButtons && (
            <ApproveSendBackButton
              ids={[caseId as string]}
              onReload={onReload}
              type="CASE"
              status={caseItem.caseStatus ?? 'OPEN'}
              previousStatus={previousStatus}
            />
          )}
          {!isReview && caseId && (
            <CasesStatusChangeButton
              caseIds={[caseId as string]}
              caseStatus={caseItem.caseStatus}
              onSaved={onReload}
              isDisabled={caseItem.caseStatus === 'CLOSED' && !isReopenEnabled}
              statusTransitions={{
                OPEN_IN_PROGRESS: { status: 'CLOSED', actionLabel: 'Close' },
                OPEN_ON_HOLD: { status: 'CLOSED', actionLabel: 'Close' },
                ESCALATED_IN_PROGRESS: { status: 'CLOSED', actionLabel: 'Close' },
                ESCALATED_ON_HOLD: { status: 'CLOSED', actionLabel: 'Close' },
              }}
            />
          )}
          {escalationEnabled && !isReview && caseId && (
            <CasesStatusChangeButton
              caseIds={[caseId as string]}
              caseStatus={caseItem.caseStatus}
              onSaved={onReload}
              statusTransitions={{
                OPEN: { status: 'ESCALATED', actionLabel: 'Escalate' },
                REOPENED: { status: 'ESCALATED', actionLabel: 'Escalate' },
                ESCALATED: {
                  status: caseClosedBefore ? 'REOPENED' : 'OPEN',
                  actionLabel: 'Send back',
                },
                CLOSED: { status: 'ESCALATED', actionLabel: 'Escalate' },
                OPEN_IN_PROGRESS: { status: 'ESCALATED', actionLabel: 'Escalate' },
                OPEN_ON_HOLD: { status: 'ESCALATED', actionLabel: 'Escalate' },
                ESCALATED_IN_PROGRESS: {
                  status: caseClosedBefore ? 'REOPENED' : 'OPEN',
                  actionLabel: 'Send back',
                },
                ESCALATED_ON_HOLD: {
                  status: caseClosedBefore ? 'REOPENED' : 'OPEN',
                  actionLabel: 'Send back',
                },
              }}
            />
          )}
        </>
      }
      subHeader={<SubHeader caseItem={caseItem} />}
    >
      <Form.Layout.Label title={'User Name'}>{getUserName(user)}</Form.Layout.Label>
      <Form.Layout.Label title={'User ID'}>
        <Id to={getUserLink(user)} alwaysShowCopy>
          {user?.userId}
        </Id>
      </Form.Layout.Label>
      {caseItem.caseStatus && (
        <Form.Layout.Label
          icon={<BriefcaseLineIcon />}
          title={'Case Status'}
          className={s.preventShrinkage}
        >
          <CaseStatusWithDropDown
            caseStatus={caseItem.caseStatus}
            statusChanges={caseItem.statusChanges ?? []}
            previousStatus={previousStatus}
            assignments={caseItem.assignments ?? []}
            onSelect={(newStatus) => {
              statusChangeMutation.mutate(newStatus);
            }}
          />
        </Form.Layout.Label>
      )}

      {caseItem.caseHierarchyDetails?.parentCaseId && (
        <Form.Layout.Label title={'Parent Case ID'}>
          <Id
            to={makeUrl(`/case-management/case/:caseId`, {
              caseId: caseItem.caseHierarchyDetails?.parentCaseId,
            })}
            alwaysShowCopy
          >
            {caseItem.caseHierarchyDetails?.parentCaseId}
          </Id>
        </Form.Layout.Label>
      )}

      {caseItem.caseHierarchyDetails?.childCaseIds && (
        <Form.Layout.Label title={'Child Case IDs'}>
          {caseItem.caseHierarchyDetails?.childCaseIds.map((caseId) => (
            <Id
              to={makeUrl(`/case-management/case/:caseId`, {
                caseId,
              })}
            >
              {caseId}
            </Id>
          ))}
        </Form.Layout.Label>
      )}
    </LegacyEntityHeader>
  );
}
