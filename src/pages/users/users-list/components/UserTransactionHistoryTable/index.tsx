import { Divider, Tag } from 'antd';
import { Link } from 'react-router-dom';
import moment from 'moment';
import style from './style.module.less';
import { TransactionAmountDetails, TransactionCaseManagement } from '@/apis';
import { useApi } from '@/api';
import Table from '@/components/ui/Table';
import { DefaultApiGetTransactionsListRequest } from '@/apis/types/ObjectParamAPI';
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT } from '@/utils/dates';

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
    <Table<
      TransactionCaseManagement & {
        direction: 'Incoming' | 'Outgoing';
      }
    >
      search={false}
      rowKey="transactionId"
      form={{
        labelWrap: true,
      }}
      className={style.tablePadding}
      request={async (params) => {
        if (!userId) {
          throw new Error(`User id is null, unable to fetch transaction history`);
        }
        const requestParams: DefaultApiGetTransactionsListRequest = {
          limit: params.pageSize!,
          skip: (params.current! - 1) * params.pageSize!,
          beforeTimestamp: Date.now(),
          filterOriginUserId: userId,
        };
        const [originFilterResult, destFilterResult] = await Promise.all([
          api.getTransactionsList({ ...requestParams, filterOriginUserId: userId }),
          api.getTransactionsList({ ...requestParams, filterDestinationUserId: userId }),
        ]);
        return {
          data: [
            ...originFilterResult.data.map((x) => ({ ...x, direction: 'Outgoing' as const })),
            ...destFilterResult.data.map((x) => ({ ...x, direction: 'Incoming' as const })),
          ],
          success: true,
          total: originFilterResult.total + destFilterResult.total,
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
          title: 'Transaction Time',
          dataIndex: 'timestamp',
          valueType: 'dateTime',
          key: 'transactionTime',
          render: (_, transaction) => {
            return moment(transaction.timestamp).format(DEFAULT_DATE_TIME_DISPLAY_FORMAT);
          },
        },
        {
          title: 'Transaction Direction',
          dataIndex: 'direction',
          key: 'direction',
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
