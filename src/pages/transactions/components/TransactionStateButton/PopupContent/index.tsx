import React from 'react';
import { List } from 'antd';
import cn from 'clsx';
import s from './style.module.less';
import { TransactionState } from '@/apis';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { TRANSACTIONS_UNIQUES } from '@/utils/queries/keys';
import { getOr, isLoading } from '@/utils/asyncResource';
import TransactionStateTag from '@/components/ui/TransactionStateTag';
import { isTransactionState } from '@/utils/rules';

interface Props {
  value: TransactionState[];
  onConfirm: (status: TransactionState[]) => void;
}

export default function PopupContent(props: Props) {
  const { value, onConfirm } = props;

  const api = useApi();
  const statesRes = useQuery(TRANSACTIONS_UNIQUES('TRANSACTION_STATE'), async () => {
    const result = await api.getTransactionsUniques({
      field: 'TRANSACTION_STATE',
    });
    return result.filter(isTransactionState);
  });

  return (
    <div className={s.root}>
      <List
        dataSource={getOr(statesRes.data, [])}
        loading={isLoading(statesRes.data)}
        renderItem={(item) => (
          <List.Item
            className={cn(s.item, value.includes(item) && s.isActive)}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onConfirm(!value.includes(item) ? [...value, item] : value.filter((x) => x !== item));
            }}
          >
            <List.Item.Meta
              title={<TransactionStateTag titleClassName={s.itemTitle} transactionState={item} />}
            />
          </List.Item>
        )}
      />
    </div>
  );
}
