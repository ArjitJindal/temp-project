import React, { useMemo } from 'react';
import s from './index.module.less';
import ClosingReasonTag from '@/components/library/Tag/ClosingReasonTag';
import TagList from '@/components/library/Tag/TagList';

interface Props {
  reasons?: Array<string>;
  otherReason?: string | null;
}

export default function StatusChangeReasonsDisplay(props: Props) {
  const { reasons = [], otherReason } = props;
  const reasonsToShow = useMemo(() => {
    if (otherReason == null || otherReason === '') {
      return reasons;
    }
    return reasons.filter((x) => x !== 'Other');
  }, [reasons, otherReason]);
  return (
    <div className={s.root}>
      {reasonsToShow.length === 0 && (otherReason == null || otherReason === '') && '-'}
      {reasonsToShow && reasonsToShow.length > 0 && (
        <TagList>
          {reasonsToShow?.map((reason) => (
            <ClosingReasonTag key={reason}>{reason}</ClosingReasonTag>
          ))}
        </TagList>
      )}
      {otherReason && (
        <div>
          {reasonsToShow.length > 0 && <span>Other Reasons: </span>}
          {otherReason}
        </div>
      )}
    </div>
  );
}
