import React from 'react';
import { QuestionResponse } from '../types';
import s from './index.module.less';
import EmptyImg from './empty.png';
import TableHistoryItem from './TableHistoryItem';

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
        <React.Fragment key={item.questionId}>
          {item.questionType === 'TABLE' ? <TableHistoryItem item={item} /> : JSON.stringify(item)}
        </React.Fragment>
      ))}
    </div>
  );
}
