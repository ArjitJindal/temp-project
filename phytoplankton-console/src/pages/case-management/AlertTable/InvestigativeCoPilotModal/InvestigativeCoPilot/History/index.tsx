import React from 'react';
import { QuestionResponse } from '../types';
import s from './index.module.less';
import EmptyIcon from './empty.react.svg';
import HistoryItem from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/History/HistoryItem';

interface Props {
  alertId: string;
  items: QuestionResponse[];
}

export default function History(props: Props) {
  const { alertId, items } = props;
  return (
    <div className={s.root}>
      {items.length === 0 && (
        <div className={s.empty}>
          {/* <img src={EmptyImg} role="presentation" alt="Empty history image" /> */}
          <EmptyIcon height={120} width={120} />
          {'Start your investigation by searching for required data from below'}
        </div>
      )}
      {items
        .filter((item) => Boolean(item))
        .map((item) => (
          <HistoryItem key={item.questionId} alertId={alertId} item={item} />
        ))}
    </div>
  );
}
