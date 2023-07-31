import React from 'react';
import cn from 'clsx';
import Tooltip from '../Tooltip';
import s from './index.module.less';
import { CaseStatus } from '@/apis';
import { neverReturn } from '@/utils/lang';
import { humanizeConstant } from '@/utils/humanize';
import { getNextStatusFromInReview, statusInReview } from '@/utils/case-utils';
import { statusToOperationName } from '@/pages/case-management/components/StatusChangeButton';

interface Props {
  caseStatus: CaseStatus;
  previousStatus?: CaseStatus;
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
        {statusToOperationName(caseStatus)}
      </div>
    </div>
  );
}

function getCaseStatusClassName(caseStatus: CaseStatus): string | null {
  switch (caseStatus) {
    case 'OPEN':
    case 'CLOSED':
    case 'REOPENED':
    case 'ESCALATED':
      return s[`caseStatus-${caseStatus}`];
    case 'IN_REVIEW_OPEN':
    case 'IN_REVIEW_CLOSED':
    case 'IN_REVIEW_ESCALATED':
    case 'IN_REVIEW_REOPENED':
      return s[`caseStatus-IN_REVIEW`];
    case 'OPEN_IN_PROGRESS':
    case 'ESCALATED_IN_PROGRESS':
      return s[`caseStatus-IN_PROGRESS`];
    case 'OPEN_ON_HOLD':
    case 'ESCALATED_ON_HOLD':
      return s[`caseStatus-ON_HOLD`];
  }
  return neverReturn(caseStatus, null);
}
