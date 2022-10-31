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
  onSelectState: (user: TransactionState | undefined) => void;
}

export default function StateList(props: Props) {
  const { onSelectState } = props;

  const api = useApi();
  const result = useQuery(TRANSACTIONS_UNIQUES(), async () => {
    return await api.getTransactionsUniques();
  });
  const statesRes = map(result.data, ({ transactionState }) => transactionState);

  // todo: i18n
  return (
    <div>
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
          renderItem={(state) => (
            <List.Item
              className={cn(s.root)}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onSelectState(state);
              }}
            >
              <TransactionStateTag transactionState={state} />
            </List.Item>
          )}
        ></List>
      </div>
    </div>
  );
}
