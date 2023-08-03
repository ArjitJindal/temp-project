import { useMemo } from 'react';
import { Assignment, CaseStatus, CaseStatusChange } from '@/apis';
import CaseStatusTag from '@/components/library/CaseStatusTag';
import Dropdown from '@/components/library/Dropdown';
import { useAuth0User } from '@/utils/user-utils';

type Props = {
  caseStatus: CaseStatus;
  assignments: Assignment[];
  onSelect: (status: CaseStatus) => void;
  previousStatus?: CaseStatus;
  statusChanges?: CaseStatusChange[];
  reviewAssignments: Assignment[];
};

export const CaseStatusWithDropDown = (props: Props) => {
  const { caseStatus, assignments, reviewAssignments, onSelect, previousStatus, statusChanges } =
    props;

  const isReopened = useMemo(() => {
    return statusChanges?.find((statusChange) => statusChange.caseStatus === 'CLOSED');
  }, [statusChanges]);

  const ifCaseIsEscalated = useMemo(() => {
    return caseStatus.includes('ESCALATED');
  }, [caseStatus]);

  const currentUser = useAuth0User();

  const isCurrentUserAssignee = useMemo(() => {
    const currAssignees = caseStatus.includes('ESCALATED') ? reviewAssignments : assignments;
    return currAssignees?.find((assignment) => assignment.assigneeUserId === currentUser.userId);
  }, [caseStatus, assignments, currentUser, reviewAssignments]);

  return (caseStatus.includes('OPEN') || caseStatus.includes('ESCALATED')) &&
    isCurrentUserAssignee ? (
    <Dropdown<CaseStatus>
      options={(
        (ifCaseIsEscalated
          ? ['ESCALATED', 'ESCALATED_IN_PROGRESS', 'ESCALATED_ON_HOLD']
          : ([
              ...(isReopened || caseStatus === 'REOPENED' ? ['REOPENED'] : ['OPEN']),
              'OPEN_IN_PROGRESS',
              'OPEN_ON_HOLD',
            ] as CaseStatus[])) as CaseStatus[]
      )
        .filter((status) => status !== caseStatus)
        .map((status) => ({
          label: <CaseStatusTag caseStatus={status} />,
          value: status as CaseStatus,
        }))}
      onSelect={(newStatus) => {
        if (newStatus.value !== caseStatus) {
          onSelect(newStatus.value as CaseStatus);
        }
      }}
      arrow
    >
      <div>
        <CaseStatusTag caseStatus={caseStatus ?? 'OPEN'} previousStatus={previousStatus} />
      </div>
    </Dropdown>
  ) : (
    <CaseStatusTag caseStatus={caseStatus ?? 'OPEN'} previousStatus={previousStatus} />
  );
};
