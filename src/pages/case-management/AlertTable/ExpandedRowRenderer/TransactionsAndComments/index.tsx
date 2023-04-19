import { useState } from 'react';
import Comments from './Comments';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import { ALERT_ITEM, ALERT_ITEM_TRANSACTION_LIST } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { useApiTime } from '@/utils/tracker';
import { DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import TransactionsTable, {
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import Tabs from '@/components/library/Tabs';
import { Alert } from '@/apis';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';

interface Props {
  alert: Alert;
}

export default function TransactionsAndComments(props: Props) {
  const { alert } = props;
  const alertId = alert.alertId;

  const api = useApi();
  const measure = useApiTime();

  const [params, setParams] = useState<TransactionsTableParams>(DEFAULT_PARAMS_STATE);
  const [isCheckedTransactionsEnabled, setIsCheckedTransactionsEnabled] = useState(false);

  const transactionsResponse = usePaginatedQuery(
    ALERT_ITEM_TRANSACTION_LIST(alertId ?? '', { ...params, isCheckedTransactionsEnabled }),
    async (paginationParams) => {
      if (alertId == null) {
        throw new Error(`Unable to fetch transactions for alert, it's id is empty`);
      }
      const response = await measure(
        () =>
          api.getAlertTransactionList({
            ...params,
            alertId: alertId,
            showExecutedTransactions: isCheckedTransactionsEnabled,
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
            <AsyncResourceRenderer resource={alertResponse.data}>
              {(alert) => (
                <TransactionsTable
                  queryResult={transactionsResponse}
                  params={params}
                  onChangeParams={setParams}
                  adjustPagination={true}
                  showCheckedTransactionsButton={true}
                  isCheckedTransactionsEnabled={isCheckedTransactionsEnabled}
                  setIsCheckedTransactionsEnabled={setIsCheckedTransactionsEnabled}
                  alert={alert}
                />
              )}
            </AsyncResourceRenderer>
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
