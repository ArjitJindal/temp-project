import React from 'react';
import { List } from 'antd';
import cn from 'clsx';
import s from './style.module.less';
import { TransactionState } from '@/apis';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { TRANSACTIONS_UNIQUES } from '@/utils/queries/keys';
import { getOr, isLoading, map } from '@/utils/asyncResource';
import TransactionStateTag from '@/components/ui/TransactionStateTag';

interface Props {
  value: TransactionState[];
  onConfirm: (status: TransactionState[]) => void;
}

export default function PopupContent(props: Props) {
  const { value, onConfirm } = props;

  const api = useApi();
  const result = useQuery(TRANSACTIONS_UNIQUES(), () => api.getTransactionsUniques());
  const statesRes = map(result.data, ({ transactionState }) => transactionState);

  return (
    <div className={s.root}>
      <div
        id="scrollableDiv"
        style={{
          maxHeight: 200,
          overflow: 'auto',
          width: 200,
        }}
      >
        <List
          dataSource={getOr(statesRes, [])}
          loading={isLoading(statesRes)}
          renderItem={(item) => (
            <List.Item
              className={cn(s.item, value.includes(item) && s.isActive)}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onConfirm(
                  !value.includes(item) ? [...value, item] : value.filter((x) => x !== item),
                );
              }}
            >
              <List.Item.Meta
                title={<TransactionStateTag titleClassName={s.itemTitle} transactionState={item} />}
              />
            </List.Item>
          )}
        />
      </div>
    </div>
  );
}
