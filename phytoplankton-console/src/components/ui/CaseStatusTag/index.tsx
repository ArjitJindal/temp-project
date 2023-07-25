import React, { useMemo } from 'react';
import { Tag } from 'antd';
import COLORS, {
  COLORS_V2_ALERT_SUCCESS,
  COLORS_V2_ALERT_WARNING,
  COLORS_V2_RISK_LEVEL_BASE_VERY_HIGH,
} from '../colors';
import s from './index.module.less';
import { CaseStatus } from '@/apis';
import { capitalizeWords } from '@/utils/tags';
import { getNextStatusFromInReview, statusInReview } from '@/utils/case-utils';
import Tooltip from '@/components/library/Tooltip';

interface Props {
  caseStatus: CaseStatus;
  previousStatus?: CaseStatus;
}

export default function CaseStatusTag(props: Props) {
  const { caseStatus, previousStatus } = props;

  const statusColor = useMemo(() => {
    switch (caseStatus) {
      case 'OPEN':
      case 'REOPENED':
        return COLORS_V2_ALERT_WARNING;
      case 'CLOSED':
        return COLORS_V2_ALERT_SUCCESS;
      case 'IN_REVIEW_OPEN':
      case 'IN_REVIEW_CLOSED':
      case 'IN_REVIEW_REOPENED':
      case 'IN_REVIEW_ESCALATED':
        return COLORS.purple.base;
      case 'ESCALATED':
        return COLORS_V2_RISK_LEVEL_BASE_VERY_HIGH;
      default:
        return COLORS_V2_ALERT_WARNING;
    }
  }, [caseStatus]);

  return statusInReview(caseStatus) ? (
    <Tooltip
      title={
        <>
          On approve: {capitalizeWords(getNextStatusFromInReview(caseStatus ?? 'OPEN'))}
          <br />
          On decline: {capitalizeWords(previousStatus ?? 'OPEN')}
        </>
      }
    >
      <Tag
        className={s.caseStatusTag}
        style={{ backgroundColor: `${statusColor}26`, borderColor: statusColor }}
      >
        In Review
      </Tag>
    </Tooltip>
  ) : (
    <Tag
      className={s.caseStatusTag}
      style={{ backgroundColor: `${statusColor}26`, borderColor: statusColor }}
    >
      {capitalizeWords(caseStatus ?? 'OPEN')}
    </Tag>
  );
}
