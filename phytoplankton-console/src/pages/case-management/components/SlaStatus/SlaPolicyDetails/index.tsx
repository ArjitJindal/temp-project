import React, { useState, useEffect } from 'react';
import cn from 'clsx';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import s from './styles.module.less';
import { SLAPolicyDetails } from '@/apis/models/SLAPolicyDetails';
import { H5, P } from '@/components/ui/Typography';
import { SLAPolicy } from '@/apis/models/SLAPolicy';
import { dayjs, duration } from '@/utils/dayjs';
import {
  Account,
  Alert,
  AlertStatus,
  Case,
  CaseStatus,
  CaseStatusChange,
  DerivedStatus,
  NumberOperators,
  SLAPolicyConfiguration,
  SLAPolicyConfigurationWorkingDaysEnum,
  SLAPolicyStatus,
} from '@/apis';
import { formatDuration, getDuration } from '@/utils/time-utils';
import { statusEscalatedL2, statusEscalated, isStatusInReview } from '@/utils/case-utils';

export interface SLAPolicyStatusDetails extends SLAPolicyDetails {
  policyStatus: SLAPolicyStatus;
}
interface Props {
  slaPolicyDetail: SLAPolicyStatusDetails;
  policy?: SLAPolicy;
  entity: Case | Alert;
  accounts: Account[];
}

export const statusClass = {
  OK: 'ok',
  WARNING: 'warning',
  BREACHED: 'breached',
};
export const dayMapping: Record<SLAPolicyConfigurationWorkingDaysEnum, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

export function getElapsedTime(
  startTime: number,
  endTime: number,
  workingDays: Array<SLAPolicyConfigurationWorkingDaysEnum>,
): number {
  const start = dayjs(startTime).utc();
  const end = dayjs(endTime).utc();
  let elapsedTime = 0;

  const workingDayNumbers = workingDays.map((day) => dayMapping[day]);

  if (start.isSame(end, 'day')) {
    return workingDayNumbers.includes(start.day()) ? end.diff(start, 'milliseconds') : 0;
  }

  let current = start.clone();

  while (current.isBefore(end)) {
    const dayOfWeek = current.day();
    if (workingDayNumbers.includes(dayOfWeek)) {
      const dayEnd = current.endOf('day');
      const segmentEnd = dayEnd.isAfter(end) ? end : dayEnd;
      const segmentStart = current.startOf('day').isAfter(start) ? current.startOf('day') : start;

      elapsedTime += segmentEnd.diff(segmentStart, 'milliseconds') + 1;
    }
    current = current.add(1, 'day');
  }

  return elapsedTime;
}

export function operatorCheck(operator: NumberOperators, lhs: number, rhs: number): boolean {
  switch (operator) {
    case 'EQ':
      return lhs === rhs;
    case 'NE':
      return lhs !== rhs;
    case 'GT':
      return lhs > rhs;
    case 'GTE':
      return lhs >= rhs;
    case 'LT':
      return lhs < rhs;
    case 'LTE':
      return lhs <= rhs;
    default:
      return false;
  }
}

export function matchPolicyRoleConditions(
  policyConfiguration: SLAPolicyConfiguration,
  accounts: Account[],
): boolean {
  if (!policyConfiguration.accountRoles || policyConfiguration.accountRoles.length === 0) {
    return true;
  }
  const roles = accounts.map((account) => account.role);
  if (
    roles.some((role) => {
      return policyConfiguration.accountRoles?.includes(role);
    })
  ) {
    return true;
  }
  return false;
}

export function getDerivedStatus(status: AlertStatus | CaseStatus | undefined): DerivedStatus {
  switch (status) {
    case 'IN_REVIEW_OPEN':
    case 'IN_REVIEW_CLOSED':
    case 'IN_REVIEW_REOPENED':
    case 'IN_REVIEW_ESCALATED': {
      return 'IN_REVIEW';
    }
    case 'OPEN_IN_PROGRESS':
      return 'IN_PROGRESS';
    case 'OPEN_ON_HOLD': {
      return 'ON_HOLD';
    }
    case 'ESCALATED_IN_PROGRESS':
    case 'ESCALATED_ON_HOLD': {
      return 'ESCALATED';
    }
    case 'ESCALATED_L2_IN_PROGRESS':
    case 'ESCALATED_L2_ON_HOLD': {
      return 'ESCALATED_L2';
    }
    default:
      return status as DerivedStatus;
  }
}

export function matchPolicyStatusConditions(
  status: CaseStatus,
  statusCount: number,
  policyConfiguration: SLAPolicyConfiguration,
  accounts: {
    makerAccounts: Account[];
    reviewerAccounts: Account[];
  },
): boolean {
  const { makerAccounts, reviewerAccounts } = accounts;
  const derivedStatus = getDerivedStatus(status);
  const isEscalatedL2 = statusEscalatedL2(status);
  const isEscalated = statusEscalated(status);
  const isInReview = isStatusInReview(status);

  const filteredAccounts = reviewerAccounts.filter((account) => {
    return (
      (isEscalatedL2 && account.escalationLevel === 'L2') ||
      isEscalated ||
      (isInReview && account.isReviewer === true)
    );
  });

  const policyMatch =
    isEscalated || isInReview || isEscalatedL2
      ? matchPolicyRoleConditions(policyConfiguration, filteredAccounts)
      : matchPolicyRoleConditions(policyConfiguration, makerAccounts);

  if (
    derivedStatus === 'CLOSED' ||
    !policyMatch ||
    !policyConfiguration.statusDetails.statuses.includes(derivedStatus)
  ) {
    return false;
  }
  const configuredCountDetails = (policyConfiguration.statusDetails.statusesCount ?? []).find(
    (entry) => entry.status === derivedStatus,
  );

  if (
    configuredCountDetails &&
    !operatorCheck(configuredCountDetails.operator, statusCount, configuredCountDetails.count)
  ) {
    return false;
  }
  return true;
}

export async function getPolicyTime(
  policy: SLAPolicy,
  entity: Case | Alert,
  accounts: Account[],
): Promise<string> {
  try {
    const makerAccounts = entity.assignments
      ? accounts.filter((account) =>
          entity.assignments?.some((assignee) => assignee.assigneeUserId === account.id),
        )
      : [];
    const reviewAccounts = entity.reviewAssignments
      ? accounts.filter((account) =>
          entity.reviewAssignments?.some(
            (reviewAssignment) => reviewAssignment.assigneeUserId === account.id,
          ),
        )
      : [];
    const createdTimestamp = entity.createdTimestamp ?? Date.now();
    const initialStatusAsChange: CaseStatusChange = {
      userId: 'system',
      timestamp: createdTimestamp,
      caseStatus: 'OPEN',
    };
    const statusChanges = entity.statusChanges
      ? [initialStatusAsChange].concat(entity.statusChanges)
      : [initialStatusAsChange];
    const countMap = new Map<string, number>();
    let elapsedTime = 0;

    statusChanges.forEach((statusChange, index) => {
      const status = getDerivedStatus(statusChange.caseStatus);
      countMap.set(status, (countMap.get(status) ?? 0) + 1);
      if (
        statusChange.caseStatus &&
        matchPolicyStatusConditions(
          statusChange.caseStatus,
          countMap.get(status) ?? 0,
          policy.policyConfiguration,
          {
            makerAccounts: makerAccounts,
            reviewerAccounts: reviewAccounts,
          },
        )
      ) {
        elapsedTime += getElapsedTime(
          statusChange.timestamp,
          statusChanges[index + 1]?.timestamp ?? Date.now(),
          policy.policyConfiguration.workingDays,
        );
      }
    });
    const { granularity, units: value } = policy.policyConfiguration.SLATime.breachTime;
    const policyTime = duration(value, granularity).asMilliseconds();
    const timeDifference = Math.abs(policyTime - elapsedTime);
    const timeDuration = getDuration(timeDifference);
    return formatDuration(timeDuration, 2);
  } catch (e) {
    console.error(e);
    return '-';
  }
}

function SlaPolicyDetails(props: Props) {
  const { slaPolicyDetail, policy, entity, accounts } = props;
  const [policyTime, setPolicyTime] = useState<string>('-');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchPolicyTime = async () => {
      if (!policy) {
        setPolicyTime('-');
        return;
      }

      setIsLoading(true);
      try {
        const time = await getPolicyTime(policy, entity, accounts);
        setPolicyTime(time);
      } catch (error) {
        console.error('Error fetching policy time:', error);
        setPolicyTime('-');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPolicyTime();
  }, [policy, entity, accounts]);

  return (
    <>
      <div className={s.row}>
        <H5>SLA status</H5>
        <div className={cn(s.statusDisplay, s[statusClass[slaPolicyDetail.policyStatus]])}>
          {humanizeConstant(slaPolicyDetail.policyStatus)}
        </div>
      </div>
      <div className={s.row}>
        <H5 className={s.timeText}>
          {slaPolicyDetail.policyStatus === 'BREACHED' ? 'Exceeded by  ' : 'Exceeding in  '}
        </H5>
        <P variant="m" fontWeight="medium">
          {isLoading ? 'Loading...' : policyTime}{' '}
        </P>
      </div>
    </>
  );
}

export default SlaPolicyDetails;
