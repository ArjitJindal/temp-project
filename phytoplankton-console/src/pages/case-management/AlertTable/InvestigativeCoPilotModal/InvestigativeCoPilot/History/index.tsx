import React from 'react';
import { QuestionResponse } from '../types';
import s from './index.module.less';
import EmptyImg from './empty.png';
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
          <img src={EmptyImg} role="presentation" alt="Empty history image" />
          {'Start your investigation by searching for required data from below'}
        </div>
      )}
      {items.map((item) => (
        <HistoryItem key={item.questionId} alertId={alertId} item={item} />
      ))}
    </div>
  );
}
