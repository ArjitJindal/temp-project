import React from 'react';
import cn from 'clsx';
import pluralize from 'pluralize';
import s from './styles.module.less';
import { SLAPolicyDetails } from '@/apis/models/SLAPolicyDetails';
import { H5, P } from '@/components/ui/Typography';
import { humanizeConstant } from '@/utils/humanize';
import { useQuery } from '@/utils/queries/hooks';
import { SLA_POLICY } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { getOr } from '@/utils/asyncResource';
import { SLAPolicy } from '@/apis/models/SLAPolicy';
import { duration } from '@/utils/dayjs';
interface Props {
  slaPolicyDetail: SLAPolicyDetails;
}

export const statusClass = {
  OK: 'ok',
  WARNING: 'warning',
  BREACHED: 'breached',
};

function getPolicyTime(policy: SLAPolicy, elapsedTime = 0) {
  const granularity = policy.policyConfiguration.SLATime.breachTime.granularity;
  const value = policy.policyConfiguration.SLATime.breachTime.units;
  let time: number;
  if (granularity === 'hours') {
    time = Math.floor(Math.abs(value - duration(elapsedTime).asHours()));
  } else {
    time = Math.floor(Math.abs(value - duration(elapsedTime).asDays()));
  }
  return `${time} ${pluralize(granularity, time)}`;
}

function SlaPolicyDetails(props: Props) {
  const { slaPolicyDetail } = props;
  const api = useApi();
  const policyResult = useQuery(SLA_POLICY(slaPolicyDetail.slaPolicyId), async () => {
    return api.getSlaPolicy({ slaId: slaPolicyDetail.slaPolicyId });
  });
  const policy = getOr(policyResult.data, undefined);
  return (
    <>
      <div className={s.row}>
        <H5>SLA status</H5>
        <div className={cn(s.statusDisplay, s[statusClass[slaPolicyDetail.policyStatus]])}>
          {humanizeConstant(slaPolicyDetail.policyStatus)}
        </div>
      </div>
      <div className={s.row}>
        <H5>{slaPolicyDetail.policyStatus === 'BREACHED' ? 'Exceeded by' : 'Exceeding in'}</H5>
        <P variant="m" fontWeight="medium">
          {policy ? getPolicyTime(policy, slaPolicyDetail.elapsedTime) : '-'}{' '}
        </P>
      </div>
    </>
  );
}

export default SlaPolicyDetails;
