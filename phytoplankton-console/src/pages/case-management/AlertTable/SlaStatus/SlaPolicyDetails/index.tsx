import React from 'react';
import cn from 'clsx';
import s from './styles.module.less';
import { SLAPolicyDetails } from '@/apis/models/SLAPolicyDetails';
import { H5, P } from '@/components/ui/Typography';
import { humanizeConstant } from '@/utils/humanize';
import { SLAPolicy } from '@/apis/models/SLAPolicy';
import { duration } from '@/utils/dayjs';
import { SLAPolicyStatus } from '@/apis';
import { formatDuration, getDuration } from '@/utils/time-utils';

export interface SLAPolicyStatusDetails extends SLAPolicyDetails {
  policyStatus: SLAPolicyStatus;
}
interface Props {
  slaPolicyDetail: SLAPolicyStatusDetails;
  policy?: SLAPolicy;
}

export const statusClass = {
  OK: 'ok',
  WARNING: 'warning',
  BREACHED: 'breached',
};

function getPolicyTime(policy: SLAPolicy, elapsedTime = 0): string {
  const { granularity, units: value } = policy.policyConfiguration.SLATime.breachTime;
  const policyTime = duration(value, granularity).asMilliseconds();
  const timeDifference = Math.abs(policyTime - elapsedTime);
  const timeDuration = getDuration(timeDifference);
  return formatDuration(timeDuration, 2);
}

function SlaPolicyDetails(props: Props) {
  const { slaPolicyDetail, policy } = props;
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
          {policy ? getPolicyTime(policy, slaPolicyDetail.elapsedTime) : '-'}{' '}
        </P>
      </div>
    </>
  );
}

export default SlaPolicyDetails;
