import { useState } from 'react';
import { TableAlertItem } from '../../types';
import Comments from './Comments';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import { ALERT_ITEM, ALERT_ITEM_TRANSACTION_LIST } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { useApiTime } from '@/utils/tracker';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import TransactionsTable, {
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import Tabs from '@/components/library/Tabs';
import DisplayCheckedTransactions from '@/pages/transactions/components/TransactionsTable/DisplayCheckedTransactions';

interface Props {
  alert: TableAlertItem;
  onTransactionSelect: (alertId: string, transactionIds: string[]) => void;
  escalatedTransactionIds?: string[];
}

export default function TransactionsAndComments(props: Props) {
  const { alert, onTransactionSelect, escalatedTransactionIds } = props;
  const [isModalVisible, setIsModalVisible] = useState(false);
  const alertId = alert.alertId;

  const api = useApi();
  const measure = useApiTime();

  const [params, setParams] = useState<TransactionsTableParams>(DEFAULT_PARAMS_STATE);

  const transactionsResponse = usePaginatedQuery(
    ALERT_ITEM_TRANSACTION_LIST(alertId ?? '', { ...params }),
    async (paginationParams) => {
      if (alertId == null) {
        throw new Error(`Unable to fetch transactions for alert, it's id is empty`);
      }
      const response = await measure(
        () =>
          api.getAlertTransactionList({
            ...params,
            alertId: alertId,
            ...paginationParams,
          }),
        'Get Alert Transactions',
      );
      return {
        items: response?.data || [],
        total: response?.total || 0,
      };
    },
  );

  const alertResponse = useQuery(ALERT_ITEM(alertId ?? ''), async () => {
    if (alertId == null) {
      throw new Error(`Unable to fetch alert, id is empty`);
    }
    const alert = await measure(
      () =>
        api.getAlert({
          alertId,
        }),
      'Get Alert',
    );
    return alert;
  });

  return (
    <Tabs
      items={[
        {
          tab: 'Transactions details',
          key: 'transactions',
          children: (
            <>
              <TransactionsTable
                escalatedTransactions={escalatedTransactionIds}
                onSelect={(transactionIds) => {
                  onTransactionSelect(alertId as string, transactionIds);
                }}
                queryResult={transactionsResponse}
                params={params}
                onChangeParams={setParams}
                adjustPagination={true}
                showCheckedTransactionsButton={true}
                isModalVisible={isModalVisible}
                setIsModalVisible={setIsModalVisible}
                alert={alert}
              />
              {isModalVisible && alert && (
                <DisplayCheckedTransactions
                  visible={isModalVisible}
                  setVisible={setIsModalVisible}
                  alert={alert}
                  caseUserId={alert.caseUserId}
                />
              )}
            </>
          ),
        },
        {
          tab: 'Comments',
          key: 'comments',
          children: <Comments alertId={alertId ?? null} alertsRes={alertResponse.data} />,
        },
      ]}
    />
  );
}
