import React from 'react';
import { Tag } from 'antd';
import _ from 'lodash';
import s from './index.module.less';
import SubHeader from './SubHeader';
import { CaseResponse, Comment } from '@/apis';
import { useApi } from '@/api';
import BriefcaseLineIcon from '@/components/ui/icons/Remix/business/briefcase-line.react.svg';
import * as Form from '@/components/ui/Form';
import EntityHeader from '@/components/ui/entityPage/EntityHeader';
import CasesStatusChangeButton from '@/pages/case-management/components/CasesStatusChangeButton';
import { FalsePositiveTag } from '@/pages/case-management/components/FalsePositiveTag';
import CommentButton from '@/components/CommentButton';
import { getUserLink, getUserName } from '@/utils/api/users';
import Id from '@/components/ui/Id';

interface Props {
  caseItem: CaseResponse;
  onReload: () => void;
  onCommentAdded: (newComment: Comment) => void;
}

export default function Header(props: Props) {
  const { caseItem, onReload, onCommentAdded } = props;
  const { caseId } = caseItem;
  const user = caseItem.caseUsers?.origin ?? caseItem.caseUsers?.destination ?? undefined;

  const api = useApi();

  return (
    <EntityHeader
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
          />
          <CasesStatusChangeButton
            caseIds={[caseId as string]}
            caseStatus={caseItem.caseStatus}
            onSaved={() => {
              onReload();
            }}
          />
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
      <Form.Layout.Label icon={<BriefcaseLineIcon />} title={'Case Status'}>
        <Tag
          className={s.caseStatusTag}
          color={caseItem.caseStatus === 'CLOSED' ? 'success' : 'warning'}
        >
          {_.capitalize(caseItem.caseStatus ? caseItem.caseStatus : 'OPEN')}
        </Tag>
      </Form.Layout.Label>
    </EntityHeader>
  );
}
