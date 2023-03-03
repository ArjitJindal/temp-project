import { useState } from 'react';
import Comments from './Comments';
import { useQuery } from '@/utils/queries/hooks';
import { ALERT_ITEM, CASES_ITEM_TRANSACTIONS } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { useApiTime } from '@/utils/tracker';
import { DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import TransactionsTable, {
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import Tabs from '@/components/library/Tabs';

interface Props {
  caseId: string | null;
  alertId: string | null;
}

export default function ExpandedRowRenderer(props: Props) {
  const { caseId, alertId } = props;
  const api = useApi();
  const measure = useApiTime();

  const [params, setParams] = useState<TransactionsTableParams>(DEFAULT_PARAMS_STATE);

  const transactionsResponse = useQuery(CASES_ITEM_TRANSACTIONS(caseId ?? '', params), async () => {
    if (caseId == null) {
      throw new Error(`Unable to fetch transactions for alert, it's case id is empty`);
    }
    const result = await measure(
      () =>
        api.getCaseTransactions({
          ...params,
          caseId: caseId,
          includeUsers: true,
        }),
      'Get Case Transactions For Alert',
    );
    return {
      items: result.data,
      total: result.total,
    };
  });

  const alertItemResponse = useQuery(ALERT_ITEM(alertId ?? ''), async () => {
    if (alertId == null) {
      throw new Error(`Unable to fetch alert, id is empty`);
    }
    return await measure(
      () =>
        api.getAlert({
          alertId,
        }),
      'Get Alert',
    );
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
              headerSubtitle={'Transaction details'}
              adjustPagination={true}
            />
          ),
        },
        {
          tab: 'Comments',
          key: 'comments',
          children: <Comments alertRes={alertItemResponse.data} />,
        },
      ]}
    />
  );
}
