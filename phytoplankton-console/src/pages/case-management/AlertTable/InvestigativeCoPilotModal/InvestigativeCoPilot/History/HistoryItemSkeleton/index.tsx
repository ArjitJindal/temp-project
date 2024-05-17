import React from 'react';
import { Alert } from 'antd';
import { QuestionResponseSkeleton } from '../../types';
import HistoryItemLayout from '../HistoryItem/HistoryItemLayout';
import s from './index.module.less';
import Skeleton from '@/components/library/Skeleton';
import { makeRandomNumberGenerator } from '@/utils/prng';

interface Props {
  item: QuestionResponseSkeleton;
}

function HistoryItemSkeleton(props: Props, ref?: React.ForwardedRef<HTMLDivElement | null>) {
  const { item } = props;
  const hashCode = item.requestId
    .split('')
    .map((x) => x.charCodeAt(0))
    .reduce((acc, x) => acc + x, 1);
  const random = makeRandomNumberGenerator(hashCode % Number.MAX_SAFE_INTEGER);
  return (
    <HistoryItemLayout dataKey={item.requestId} ref={ref} title={item.requestString}>
      {item.error ? (
        <Alert message={item.error} type="error" />
      ) : (
        <div className={s.skeleton}>
          <p>
            <Skeleton text={item.requestString} />
          </p>
          {[...new Array(2 + Math.round(random() * 4))].map((_, i) => (
            <p key={i}>
              <Skeleton
                text={[...new Array(5 + Math.round(random() * 15))].map(() => 'XXXXX').join(' ')}
              />
            </p>
          ))}
        </div>
      )}
    </HistoryItemLayout>
  );
}

export default React.forwardRef(HistoryItemSkeleton);
