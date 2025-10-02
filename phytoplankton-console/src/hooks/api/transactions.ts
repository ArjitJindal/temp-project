import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import {
  TRANSACTIONS_UNIQUES,
  TRANSACTIONS_LIST,
  TRANSACTIONS_ITEM,
  TRANSACTIONS_ALERTS_LIST,
  TRANSACTIONS_ITEM_RISKS_ARS,
} from '@/utils/queries/keys';

export function useTransactionsUniques(
  field: any,
  params?: { filter?: string },
  options?: { enabled?: boolean },
) {
  const api = useApi();
  return useQuery(
    TRANSACTIONS_UNIQUES(field, params ?? {}),
    async () => {
      return await api.getTransactionsUniques({ field, ...(params ?? {}) });
    },
    options,
  );
}

export function useTransactionsList(filterId: string | undefined) {
  const api = useApi();
  return useQuery(TRANSACTIONS_LIST(filterId ?? ''), async () => {
    return api.getTransactionsList({ filterId });
  });
}

export function useTransactionItem(transactionId: string) {
  const api = useApi();
  return useQuery(TRANSACTIONS_ITEM(transactionId), () => api.getTransaction({ transactionId }));
}

export function useTransactionAlerts(transactionId: string, extra?: Record<string, unknown>) {
  const api = useApi();
  return useQuery(TRANSACTIONS_ALERTS_LIST(transactionId), () =>
    api.getAlertList({ ...(extra ?? {}), filterTransactionIds: [transactionId] } as any),
  );
}

export function useTransactionArs(transactionId: string) {
  const api = useApi();
  return useQuery(TRANSACTIONS_ITEM_RISKS_ARS(transactionId), () =>
    api.getArsValue({ transactionId }),
  );
}
