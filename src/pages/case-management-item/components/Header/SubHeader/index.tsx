import React, { useCallback, useState } from 'react';
import s from './index.module.less';
import { message } from '@/components/library/Message';
import { CaseResponse } from '@/apis';
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

interface Props {
  caseItem: CaseResponse;
}

export default function SubHeader(props: Props) {
  const { caseItem } = props;
  const { caseId } = caseItem;

  const api = useApi();
  const user = useAuth0User();

  const currentUserId = user.userId ?? undefined;

  const [assignments, setAssignments] = useState(caseItem.assignments || []);

  const handleUpdateCase = useCallback(
    async (assignments) => {
      const hideMessage = message.loading(`Saving...`);
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

  return (
    <>
      <Feature name="PULSE">
        {user?.userId && (
          <div className={s.risks}>
            <KycRiskDisplay userId={user.userId} />
            <DynamicRiskDisplay userId={user.userId} />
          </div>
        )}
      </Feature>
      <Form.Layout.Label icon={<UserShared2LineIcon />} title={'Assigned to'}>
        <AssigneesDropdown
          assignments={assignments}
          editing={true}
          onChange={handleUpdateAssignments}
        />
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
    </>
  );
}
