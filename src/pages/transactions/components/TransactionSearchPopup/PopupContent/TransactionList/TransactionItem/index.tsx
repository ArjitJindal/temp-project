import React from 'react';
import { List } from 'antd';
import cn from 'clsx';
import s from './style.module.less';
import { Transaction } from '@/apis';

interface Props {
  isActive: boolean;
  transaction: Transaction;
  onClick: () => void;
}

export default function TransactionItem(props: Props) {
  const { isActive, transaction, onClick } = props;

  // todo: i18n
  return (
    <List.Item
      className={cn(s.root, isActive && s.isActive)}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick();
      }}
    >
      <List.Item.Meta
        className={s.meta}
        title={<span className={s.transactionName}>{transaction.transactionId}</span>}
        description={<span className={s.id}>{transaction.transactionId}</span>}
      />
    </List.Item>
  );
}
