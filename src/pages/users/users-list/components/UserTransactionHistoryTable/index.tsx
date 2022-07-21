import { Divider } from 'antd';
import { Link } from 'react-router-dom';
import style from './style.module.less';
import { TransactionAmountDetails, TransactionCaseManagement } from '@/apis';
import { useApi } from '@/api';
import Table from '@/components/ui/Table';

interface Props {
  userId?: string;
}

const createCurrencyStringFromTransactionAmount = (
  amount: TransactionAmountDetails | undefined,
) => {
  return amount ? `${amount.transactionAmount} ${amount.transactionCurrency}` : '-';
};

export const UserTransactionHistoryTable: React.FC<Props> = ({ userId }) => {
  const api = useApi();

  return (
    <Table<TransactionCaseManagement>
      search={false}
      form={{
        labelWrap: true,
      }}
      className={style.tablePadding}
      request={async (params) => {
        if (!userId) {
          throw new Error(`User id is null, unable to fetch transaction history`);
        }
        const response = await api.getTransactionsList({
          limit: params.pageSize!,
          skip: (params.current! - 1) * params.pageSize!,
          beforeTimestamp: Date.now(),
          filterOriginUserId: userId,
        });
        return {
          data: response.data,
          success: true,
          total: response.total,
        };
      }}
      columns={[
        {
          title: 'Transaction ID',
          dataIndex: 'transactionId',
          key: 'transactionId',
          render: (dom, entity) => {
            return (
              <Link to={`/transactions/transactions-list/${entity.transactionId}`}>{dom}</Link>
            );
          },
        },
        {
          title: 'Transaction time',
          dataIndex: 'timestamp',
          key: 'transactionTime',
        },
        {
          title: 'Origin Amount',
          render: (dom, entity) => {
            return `${createCurrencyStringFromTransactionAmount(entity.originAmountDetails)}`;
          },
          key: 'originAmountDetails',
        },
        {
          title: 'Destination Amount',
          render: (dom, entity) => {
            return `${createCurrencyStringFromTransactionAmount(entity.destinationAmountDetails)}`;
          },
          key: 'destinationAmountDetails',
        },
      ]}
    />
  );
};
