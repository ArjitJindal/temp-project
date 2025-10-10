import React from 'react';
import cn from 'clsx';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import Tooltip from '../../Tooltip';
import s from './index.module.less';
import { CaseStatus, DerivedStatus } from '@/apis';
import { getDerivedStatus, getNextStatusFromInReview, statusInReview } from '@/utils/case-utils';
import { statusToOperationName } from '@/pages/case-management/components/StatusChangeButton';
import Tag from '@/components/library/Tag';

interface Props {
  caseStatus: CaseStatus | DerivedStatus;
  previousStatus?: CaseStatus | DerivedStatus;
  isProposedAction?: boolean;
}

export default function CaseStatusTag(props: Props) {
  const { caseStatus, previousStatus, isProposedAction } = props;

  return statusInReview(caseStatus) && !isProposedAction ? (
    <Tooltip
      title={
        <>
          On approve: {humanizeConstant(getNextStatusFromInReview(caseStatus ?? 'OPEN'))}
          <br />
          On decline: {humanizeConstant(previousStatus ?? 'OPEN')}
        </>
      }
    >
      <div>
        <Tag className={cn(s.root, getCaseStatusClassName(caseStatus))}>In review</Tag>
      </div>
    </Tooltip>
  ) : (
    <Tag className={cn(s.root, getCaseStatusClassName(caseStatus))}>
      {statusToOperationName(caseStatus, true)}
    </Tag>
  );
}

function getCaseStatusClassName(caseStatus: CaseStatus | DerivedStatus): string | null {
  return s[`caseStatus-${getDerivedStatus(caseStatus)}`];
}
