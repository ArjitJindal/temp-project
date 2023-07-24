import React from 'react';
import { Tag } from 'antd';
import _ from 'lodash';
import s from './index.module.less';
import SubHeader from './SubHeader';
import { Case, Comment } from '@/apis';
import { useApi } from '@/api';
import BriefcaseLineIcon from '@/components/ui/icons/Remix/business/briefcase-line.react.svg';
import * as Form from '@/components/ui/Form';
import EntityHeader from '@/components/ui/entityPage/EntityHeader';
import CasesStatusChangeButton from '@/pages/case-management/components/CasesStatusChangeButton';
import { FalsePositiveTag } from '@/pages/case-management/components/FalsePositiveTag';
import CommentButton from '@/components/CommentButton';
import { getUserLink, getUserName } from '@/utils/api/users';
import Id from '@/components/ui/Id';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { makeUrl } from '@/utils/routing';
import { useHasPermissions } from '@/utils/user-utils';

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
  return (
    <EntityHeader
      stickyElRef={headerStickyElRef}
      idTitle={'Case ID'}
      tag={
        caseItem.falsePositiveDetails &&
        caseItem.caseId &&
        caseItem.falsePositiveDetails.isFalsePositive && (
          <FalsePositiveTag
            caseIds={[caseItem.caseId]}
            onSaved={() => {
              // todo: implement in-place update instead of reloading
              onReload();
            }}
            newCaseStatus={caseItem.caseStatus === 'OPEN' ? 'CLOSED' : 'REOPENED'}
            confidence={caseItem.falsePositiveDetails.confidenceScore}
          />
        )
      }
      id={caseItem.caseId}
      buttons={
        <>
          <CommentButton
            onSuccess={onCommentAdded}
            submitRequest={async (commentFormValues) => {
              if (caseItem.caseId == null) {
                throw new Error(`Case ID is not defined`);
              }
              const commentData = {
                Comment: { body: commentFormValues.comment, files: commentFormValues.files },
              };
              return await api.postCaseComments({
                caseId: caseItem.caseId,
                ...commentData,
              });
            }}
            requiredPermissions={['case-management:case-overview:write']}
          />
          <CasesStatusChangeButton
            caseIds={[caseId as string]}
            caseStatus={caseItem.caseStatus}
            onSaved={onReload}
            isDisabled={caseItem.caseStatus === 'CLOSED' && !isReopenEnabled}
          />
          {escalationEnabled && (
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
      <Form.Layout.Label
        icon={<BriefcaseLineIcon />}
        title={'Case Status'}
        className={s.preventShrinkage}
      >
        <Tag
          className={s.caseStatusTag}
          color={caseItem.caseStatus === 'CLOSED' ? 'success' : 'warning'}
        >
          {_.capitalize(caseItem.caseStatus ? caseItem.caseStatus : 'OPEN')}
        </Tag>
      </Form.Layout.Label>
      {caseItem.caseHierarchyDetails?.parentCaseId && (
        <Form.Layout.Label title={'Parent Case ID'}>
          <Id
            id={caseItem.caseHierarchyDetails?.parentCaseId}
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
          {caseItem.caseHierarchyDetails?.childCaseIds.map((caseId) => {
            return (
              <Id
                id={caseId}
                to={makeUrl(`/case-management/case/:caseId`, {
                  caseId,
                })}
              >
                {caseId}
              </Id>
            );
          })}
        </Form.Layout.Label>
      )}
    </EntityHeader>
  );
}
