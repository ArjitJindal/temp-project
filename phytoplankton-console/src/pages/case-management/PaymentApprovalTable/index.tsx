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
import { useReasons } from '@/utils/reasons';

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
  const closureReasons = useReasons('CLOSURE'); // Only CLOSURE reasons for payment approvals

  const { queryResult, countQueryResult, cacheKey } = useTransactionsQuery(
    { ...params, status: filterStatus, isPaymentApprovals: true },
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
          count: data.count - selectedIds.length,
        };
      },
    );
  }, [cacheKey, selectedIds, queryClient]);

  return (
    <TransactionsTable
      queryResult={queryResult}
      countQueryResult={countQueryResult}
      params={params}
      onChangeParams={setParams}
      fitHeight={370}
      selectedIds={selectedIds}
      onSelect={setSelectedIds}
      isExpandable
      hideStatusFilter={true}
      extraFilters={[
        {
          title: 'Reason',
          key: 'filterActionReasons',
          renderer: {
            kind: 'select',
            mode: 'MULTIPLE',
            displayMode: 'list',
            options: closureReasons.map((reason) => ({ value: reason, label: reason })),
          },
          showFilterByDefault: true,
        },
        {
          key: 'userId',
          title: `${firstLetterUpper(settings.userAlias)} ID`,
          showFilterByDefault: true,
          renderer: ({ params, setParams }) => (
            <UserSearchButton
              title={`${firstLetterUpper(settings.userAlias)} ID`}
              userId={params.userId ?? null}
              params={params}
              onConfirm={setParams}
              filterType="id"
            />
          ),
        },
        {
          key: 'userName',
          title: `${firstLetterUpper(settings.userAlias)} name`,
          showFilterByDefault: true,
          renderer: ({ params, setParams }) => (
            <UserSearchButton
              title={`${firstLetterUpper(settings.userAlias)} name`}
              userId={params.userId ?? null}
              params={params}
              onConfirm={setParams}
              filterType="name"
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
      isPaymentApprovals
      canSelectRow={(row) => row.content.status === 'SUSPEND'}
    />
  );
}
