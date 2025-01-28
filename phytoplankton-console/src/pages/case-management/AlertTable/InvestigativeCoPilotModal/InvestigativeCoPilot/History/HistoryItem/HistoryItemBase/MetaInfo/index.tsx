import React from 'react';
import { QuestionResponseBase } from '../../../../types';
import s from './index.module.less';
import AccountTag from '@/components/AccountTag';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';

interface Props {
  item: QuestionResponseBase;
}

export default function MetaInfo(props: Props) {
  const { item } = props;
  return (
    <div className={s.root}>
      {item.createdById != null && (
        <Item label={'Searched by'}>
          <AccountTag accountId={item.createdById} />
        </Item>
      )}
      {item.createdAt != null && (
        <Item label={'Searched on'}>{dayjs(item.createdAt).format(DEFAULT_DATE_TIME_FORMAT)}</Item>
      )}
    </div>
  );
}

function Item(props: { label: string; children: React.ReactNode }) {
  return (
    <div className={s.item}>
      <span className={s.label}>{props.label}</span>
      {props.children}
    </div>
  );
}
