import React from 'react';
import { QuestionResponse } from '../types';
import s from './index.module.less';
import EmptyImg from './empty.png';

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
        <div className={s.item} key={item.questionId}>
          {JSON.stringify(item)}
        </div>
      ))}
    </div>
  );
}
