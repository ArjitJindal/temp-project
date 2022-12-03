import React, { useCallback, useState } from 'react';
import { message, Tag } from 'antd';
import _ from 'lodash';
import s from './index.module.less';
import { Case } from '@/apis';
import { useApi } from '@/api';
import UserShared2LineIcon from '@/components/ui/icons/Remix/user/user-shared-2-line.react.svg';
import BriefcaseLineIcon from '@/components/ui/icons/Remix/business/briefcase-line.react.svg';
import FileListLineIcon from '@/components/ui/icons/Remix/document/file-list-line.react.svg';
import * as Form from '@/components/ui/Form';
import EntityHeader from '@/components/ui/entityPage/EntityHeader';
import { AssigneesDropdown } from '@/pages/case-management/components/AssigneesDropdown';
import { useAuth0User } from '@/utils/user-utils';
import { ClosingReasonTag } from '@/pages/case-management/components/ClosingReasonTag';
import { CasesStatusChangeForm } from '@/pages/case-management/components/CaseStatusChangeForm';
import CaseTypeTag from '@/components/ui/CaseTypeTag';

interface Props {
  caseItem: Case;
  onReload: () => void;
  showCloseButton?: boolean;
}

export default function Header(props: Props) {
  const { caseItem, onReload, showCloseButton = true } = props;
  const { caseId } = caseItem;

  const api = useApi();
  const user = useAuth0User();
  const currentUserId = user.userId ?? undefined;

  const [assignments, setAssignments] = useState(caseItem.assignments || []);

  const handleUpdateCase = useCallback(
    async (assignments) => {
      const hideMessage = message.loading(`Saving...`, 0);
      try {
        await api.postCases({
          CasesUpdateRequest: {
            caseIds: caseId ? [caseId] : [],
            updates: {
              assignments,
            },
          },
        });
        message.success('Saved');
      } catch (e) {
        message.error('Failed to save');
      } finally {
        hideMessage();
      }
    },
    [api, caseId],
  );

  const handleUpdateAssignments = useCallback(
    (assignees: string[]) => {
      const newAssignments = assignees.map((assigneeUserId) => ({
        assignedByUserId: currentUserId as string,
        assigneeUserId,
        timestamp: Date.now(),
      }));
      setAssignments(newAssignments);
      handleUpdateCase(newAssignments);
    },
    [handleUpdateCase, currentUserId],
  );

  const statusChanges = caseItem.statusChanges ?? [];
  return (
    <>
      <EntityHeader idTitle={'Case ID'} id={caseItem.caseId}>
        <div className={s.items}>
          <Form.Layout.Label icon={<UserShared2LineIcon />} title={'Assigned to'}>
            <AssigneesDropdown
              assignments={assignments}
              editing={true}
              onChange={handleUpdateAssignments}
            />
          </Form.Layout.Label>
          <Form.Layout.Label icon={<BriefcaseLineIcon />} title={'Case Type'}>
            <CaseTypeTag caseType={caseItem.caseType} />
          </Form.Layout.Label>
          <Form.Layout.Label icon={<BriefcaseLineIcon />} title={'Case Status'}>
            <Tag
              className={s.caseStatusTag}
              color={caseItem.caseStatus === 'CLOSED' ? 'success' : 'warning'}
            >
              {_.capitalize(caseItem.caseStatus ? caseItem.caseStatus : 'OPEN')}
            </Tag>
          </Form.Layout.Label>
          {showCloseButton && (
            <CasesStatusChangeForm
              caseIds={[caseId as string]}
              newCaseStatus={
                caseItem.caseStatus === 'OPEN' || caseItem.caseStatus === 'REOPENED'
                  ? 'CLOSED'
                  : 'REOPENED'
              }
              onSaved={() => {
                onReload();
              }}
            />
          )}
        </div>
      </EntityHeader>
      {caseItem.caseStatus === 'CLOSED' && statusChanges.length > 0 && (
        <div className={s.closingReason}>
          <Form.Layout.Label icon={<FileListLineIcon />} title={'Reason for closing'}>
            <ClosingReasonTag
              closingReasons={statusChanges[statusChanges.length - 1].reason}
              otherReason={statusChanges[statusChanges.length - 1].otherReason}
            />
          </Form.Layout.Label>
        </div>
      )}
    </>
  );
}
