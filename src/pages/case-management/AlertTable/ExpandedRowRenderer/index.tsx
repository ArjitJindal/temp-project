import { useState } from 'react';
import { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import { useQuery } from '@/utils/queries/hooks';
import { CASES_ITEM_TRANSACTIONS } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { useApiTime } from '@/utils/tracker';
import { DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import TransactionsTable, {
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';

interface Props {
  alert: TableAlertItem;
}

export default function ExpandedRowRenderer(props: Props) {
  const { alert } = props;
  const api = useApi();
  const measure = useApiTime();

  const caseId = alert.caseId;

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

  return (
    <TransactionsTable
      queryResult={transactionsResponse}
      params={params}
      onChangeParams={setParams}
      headerSubtitle={'Transaction details'}
      adjustPagination={true}
    />
  );
}
