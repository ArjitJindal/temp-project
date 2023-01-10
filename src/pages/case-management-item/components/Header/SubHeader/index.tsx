import React, { useCallback, useState } from 'react';
import { message } from 'antd';
import { Case } from '@/apis';
import { useApi } from '@/api';
import FileListLineIcon from '@/components/ui/icons/Remix/document/file-list-line.react.svg';
import * as Form from '@/components/ui/Form';
import { useAuth0User } from '@/utils/user-utils';
import { ClosingReasonTag } from '@/pages/case-management/components/ClosingReasonTag';
import UserShared2LineIcon from '@/components/ui/icons/Remix/user/user-shared-2-line.react.svg';
import { AssigneesDropdown } from '@/pages/case-management/components/AssigneesDropdown';

interface Props {
  caseItem: Case;
}

export default function SubHeader(props: Props) {
  const { caseItem } = props;
  const { caseId } = caseItem;

  const api = useApi();
  const user = useAuth0User();
  const statusChanges = caseItem.statusChanges ?? [];
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

  return (
    <>
      <Form.Layout.Label icon={<UserShared2LineIcon />} title={'Assigned to'}>
        <AssigneesDropdown
          assignments={assignments}
          editing={true}
          onChange={handleUpdateAssignments}
        />
      </Form.Layout.Label>
      {caseItem.caseStatus === 'CLOSED' && statusChanges.length > 0 && (
        <Form.Layout.Label icon={<FileListLineIcon />} title={'Reason for closing'}>
          <div>
            <ClosingReasonTag
              closingReasons={statusChanges[statusChanges.length - 1].reason}
              otherReason={statusChanges[statusChanges.length - 1].otherReason}
            />
          </div>
        </Form.Layout.Label>
      )}
    </>
  );
}
