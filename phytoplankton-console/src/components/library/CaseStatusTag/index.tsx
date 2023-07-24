import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import { CaseStatus } from '@/apis';
import { neverReturn } from '@/utils/lang';
import { humanizeConstant } from '@/utils/humanize';

interface Props {
  caseStatus: CaseStatus;
}

export default function CaseStatusTag(props: Props) {
  const { caseStatus } = props;

  return (
    <div className={cn(s.root)}>
      <div className={cn(s.body, getCaseStatusClassName(caseStatus))}>
        {humanizeConstant(caseStatus)}
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
  }
  return neverReturn(caseStatus, null);
}
