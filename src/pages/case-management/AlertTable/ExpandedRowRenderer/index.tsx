import { useState } from 'react';
import Comments from './Comments';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import { ALERT_ITEM_COMMENTS, ALERT_ITEM_TRANSACTION_LIST } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { useApiTime } from '@/utils/tracker';
import { DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import TransactionsTable, {
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import Tabs from '@/components/library/Tabs';

interface Props {
  alertId: string | null;
}

export default function ExpandedRowRenderer(props: Props) {
  const { alertId } = props;
  const api = useApi();
  const measure = useApiTime();

  const [params, setParams] = useState<TransactionsTableParams>(DEFAULT_PARAMS_STATE);

  const transactionsResponse = usePaginatedQuery(
    ALERT_ITEM_TRANSACTION_LIST(alertId ?? '', params),
    async (paginationParams) => {
      if (alertId == null) {
        throw new Error(`Unable to fetch transactions for alert, it's id is empty`);
      }
      const response = await measure(
        () =>
          api.getAlertTransactionList({
            ...params,
            alertId,
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

  const commentsResponse = useQuery(ALERT_ITEM_COMMENTS(alertId ?? ''), async () => {
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
    return alert.comments ?? [];
  });

  return (
    <Tabs
      items={[
        {
          tab: 'Transactions details',
          key: 'transactions',
          children: (
            <TransactionsTable
              queryResult={transactionsResponse}
              params={params}
              onChangeParams={setParams}
              adjustPagination={true}
            />
          ),
        },
        {
          tab: 'Comments',
          key: 'comments',
          children: <Comments alertId={alertId} commentsRes={commentsResponse.data} />,
        },
      ]}
    />
  );
}
