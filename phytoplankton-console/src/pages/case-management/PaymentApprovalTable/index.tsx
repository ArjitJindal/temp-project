import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import TransactionsTable, {
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import PaymentApprovalButton from '@/pages/case-management/components/PaymentApprovalButton';
import { TransactionsResponse } from '@/apis';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useTransactionsQuery } from '@/pages/transactions/utils';

interface Props {
  params: TransactionsTableParams;
  onChangeParams: (newState: TransactionsTableParams) => void;
}

export default function PaymentApprovalsTable(props: Props) {
  const { params, onChangeParams: setParams } = props;
  const settings = useSettings();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const filterStatus = params.status ?? 'SUSPEND';

  const { queryResult, cacheKey } = useTransactionsQuery(
    { ...params, status: filterStatus },
    { isReadyToFetch: true, debounce: 500 },
  );

  const updateCacheData = useCallback(() => {
    queryClient.setQueryData<TransactionsResponse>(
      cacheKey,
      (data: TransactionsResponse | undefined): TransactionsResponse | undefined => {
        if (data == null) {
          return undefined;
        }
        return {
          ...data,
          items: data.items.filter((x) => !selectedIds.includes(x.transactionId)),
        };
      },
    );
  }, [cacheKey, selectedIds, queryClient]);

  return (
    <TransactionsTable
      queryResult={queryResult}
      params={params}
      onChangeParams={setParams}
      fitHeight={370}
      selectedIds={selectedIds}
      onSelect={setSelectedIds}
      isExpandable
      hideStatusFilter={true}
      extraFilters={[
        {
          key: 'userId',
          title: `${firstLetterUpper(settings.userAlias)} ID/name`,
          renderer: ({ params, setParams }) => (
            <UserSearchButton
              userId={params.userId ?? null}
              onConfirm={(userId) => {
                setParams((state) => ({
                  ...state,
                  userId: userId ?? undefined,
                }));
              }}
            />
          ),
        },
      ]}
      selectionInfo={
        selectedIds.length
          ? { entityCount: selectedIds.length, entityName: 'transactions' }
          : undefined
      }
      selectionActions={[
        ({ selectedIds, onResetSelection }) => (
          <PaymentApprovalButton
            ids={selectedIds}
            action={'BLOCK'}
            onSuccess={() => {
              onResetSelection();
              updateCacheData();
            }}
          />
        ),
        ({ selectedIds, onResetSelection }) => (
          <PaymentApprovalButton
            ids={selectedIds}
            action={'ALLOW'}
            onSuccess={() => {
              onResetSelection();
              updateCacheData();
            }}
          />
        ),
      ]}
      canSelectRow={(row) => row.content.status === 'SUSPEND'}
    />
  );
}
