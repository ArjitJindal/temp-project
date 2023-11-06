import React from 'react';
import cn from 'clsx';
import Tooltip from '../Tooltip';
import s from './index.module.less';
import { CaseStatus, DerivedStatus } from '@/apis';
import { humanizeConstant } from '@/utils/humanize';
import { getDerivedStatus, getNextStatusFromInReview, statusInReview } from '@/utils/case-utils';
import { statusToOperationName } from '@/pages/case-management/components/StatusChangeButton';

interface Props {
  caseStatus: CaseStatus | DerivedStatus;
  previousStatus?: CaseStatus | DerivedStatus;
}

export default function CaseStatusTag(props: Props) {
  const { caseStatus, previousStatus } = props;

  return statusInReview(caseStatus) ? (
    <Tooltip
      title={
        <>
          On approve: {humanizeConstant(getNextStatusFromInReview(caseStatus ?? 'OPEN'))}
          <br />
          On decline: {humanizeConstant(previousStatus ?? 'OPEN')}
        </>
      }
    >
      <div className={cn(s.root)}>
        <div className={cn(s.body, getCaseStatusClassName(caseStatus))}>In review</div>
      </div>
    </Tooltip>
  ) : (
    <div className={cn(s.root)}>
      <div className={cn(s.body, getCaseStatusClassName(caseStatus))}>
        {statusToOperationName(caseStatus, true)}
      </div>
    </div>
  );
}

function getCaseStatusClassName(caseStatus: CaseStatus | DerivedStatus): string | null {
  return s[`caseStatus-${getDerivedStatus(caseStatus)}`];
}
