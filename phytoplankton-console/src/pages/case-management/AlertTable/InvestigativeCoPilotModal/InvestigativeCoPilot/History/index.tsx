import React from 'react';
import { QuestionResponse } from '../types';
import s from './index.module.less';
import EmptyImg from './empty.png';
import HistoryItemTable from './HistoryItemTable';
import HistoryItemStackedBarchart from './HistoryItemStackedBarchart';
import HistoryItemTimeSeries from './HistoryItemTimeSeries';
import { neverReturn } from '@/utils/lang';

interface Props {
  items: QuestionResponse[];
}

export default function History(props: Props) {
  const { items } = props;
  return (
    <div className={s.root}>
      {items.length === 0 && (
        <div className={s.empty}>
          <img src={EmptyImg} role="presentation" alt="Empty history image" />
          {'Start your investigation by searching for required data from below'}
        </div>
      )}
      {items.map((item) => (
        <React.Fragment key={item.questionId}>{renderItem(item)}</React.Fragment>
      ))}
    </div>
  );
}

function renderItem(item: QuestionResponse) {
  if (item.questionType === 'TABLE') {
    return <HistoryItemTable item={item} />;
  }
  if (item.questionType === 'STACKED_BARCHART') {
    return <HistoryItemStackedBarchart item={item} />;
  }
  if (item.questionType === 'TIME_SERIES') {
    return <HistoryItemTimeSeries item={item} />;
  }
  return neverReturn(item, <>{JSON.stringify(item)}</>);
}
