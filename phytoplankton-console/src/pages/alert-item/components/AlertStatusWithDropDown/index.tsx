import { useMemo } from 'react';
import { Assignment, AlertStatus, CaseStatusChange } from '@/apis';
import CaseStatusTag from '@/components/library/Tag/CaseStatusTag';
import Dropdown from '@/components/library/Dropdown';
import { useAuth0User } from '@/utils/user-utils';
import { statusEscalated, statusEscalatedL2 } from '@/utils/case-utils';
import { useAlertStatusesFromPermissions } from '@/utils/permissions/alert-permission-filter';

type Props = {
  alertStatus: AlertStatus;
  assignments: Assignment[];
  onSelect: (status: AlertStatus) => void;
  previousStatus?: AlertStatus;
  statusChanges?: CaseStatusChange[];
  reviewAssignments: Assignment[];
};

/**
 * Statuses that support dropdown editing
 */
const EDITABLE_ALERT_STATUSES: AlertStatus[] = [
  'OPEN',
  'OPEN_IN_PROGRESS',
  'OPEN_ON_HOLD',
  'REOPENED',
  'ESCALATED',
  'ESCALATED_IN_PROGRESS',
  'ESCALATED_ON_HOLD',
  'ESCALATED_L2',
  'ESCALATED_L2_IN_PROGRESS',
  'ESCALATED_L2_ON_HOLD',
];

export const AlertStatusWithDropDown = (props: Props) => {
  const { alertStatus, assignments, reviewAssignments, onSelect, previousStatus, statusChanges } =
    props;

  const allowedStatuses = useAlertStatusesFromPermissions();
  const currentUser = useAuth0User();

  const isReopened = useMemo(() => {
    return statusChanges?.some((statusChange) => statusChange?.caseStatus === 'CLOSED');
  }, [statusChanges]);

  const isEscalated = useMemo(() => statusEscalated(alertStatus), [alertStatus]);
  const isEscalatedL2 = useMemo(() => statusEscalatedL2(alertStatus), [alertStatus]);
  const isInEscalatedState = isEscalated || isEscalatedL2;

  const isCurrentUserAssignee = useMemo(() => {
    const currentAssignments = isInEscalatedState ? reviewAssignments : assignments;
    return currentAssignments.some(
      (assignment) => assignment.assigneeUserId === currentUser.userId,
    );
  }, [isInEscalatedState, reviewAssignments, assignments, currentUser.userId]);

  const availableStatuses = useMemo(() => {
    let baseStatuses: AlertStatus[];
    if (isEscalatedL2) {
      baseStatuses = ['ESCALATED_L2', 'ESCALATED_L2_IN_PROGRESS', 'ESCALATED_L2_ON_HOLD'];
    } else if (isEscalated) {
      baseStatuses = ['ESCALATED', 'ESCALATED_IN_PROGRESS', 'ESCALATED_ON_HOLD'];
    } else {
      const initialStatus = isReopened || alertStatus === 'REOPENED' ? 'REOPENED' : 'OPEN';
      baseStatuses = [initialStatus, 'OPEN_IN_PROGRESS', 'OPEN_ON_HOLD'];
    }

    return baseStatuses.filter((status) => allowedStatuses.includes(status));
  }, [isEscalated, isEscalatedL2, isReopened, alertStatus, allowedStatuses]);

  const isEditable =
    EDITABLE_ALERT_STATUSES.includes(alertStatus) &&
    isCurrentUserAssignee &&
    availableStatuses.length > 0;

  const dropdownOptions = useMemo(
    () =>
      availableStatuses
        .filter((status) => status !== alertStatus)
        .map((status) => ({
          label: <CaseStatusTag caseStatus={status} />,
          value: status,
        })),
    [availableStatuses, alertStatus],
  );

  if (!isEditable) {
    return <CaseStatusTag caseStatus={alertStatus ?? 'OPEN'} previousStatus={previousStatus} />;
  }

  return (
    <Dropdown<AlertStatus>
      options={dropdownOptions}
      onSelect={(newStatus) => onSelect(newStatus.value)}
      writeResources={['write:::case-management/case-overview/*']}
      arrow={'FILLED'}
    >
      <div>
        <CaseStatusTag caseStatus={alertStatus ?? 'OPEN'} previousStatus={previousStatus} />
      </div>
    </Dropdown>
  );
};
