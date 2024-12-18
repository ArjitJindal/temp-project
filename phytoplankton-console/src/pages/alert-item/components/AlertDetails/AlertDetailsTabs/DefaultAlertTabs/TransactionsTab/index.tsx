import React, { useState } from 'react';
import TransactionsTable, {
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import DisplayCheckedTransactions from '@/pages/transactions/components/TransactionsTable/DisplayCheckedTransactions';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useCursorQuery } from '@/utils/queries/hooks';
import { ALERT_ITEM_TRANSACTION_LIST } from '@/utils/queries/keys';
import { FIXED_API_PARAMS } from '@/pages/case-management-item/CaseDetails/InsightsCard';
import { dayjs } from '@/utils/dayjs';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useApi } from '@/api';
import { Alert, CurrencyCode, TransactionType } from '@/apis';

interface Props {
  alert: Alert;
  caseUserId: string;
  selectedTransactionIds?: string[];
  onTransactionSelect?: (alertId: string, transactionIds: string[]) => void;
  escalatedTransactionIds?: string[];
}

export default function TransactionsTab(props: Props) {
  const {
    caseUserId,
    alert,
    escalatedTransactionIds,
    onTransactionSelect,
    selectedTransactionIds,
  } = props;
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [params, setParams] = useState<TransactionsTableParams>(DEFAULT_PARAMS_STATE);

  const escalationEnabled = useFeatureEnabled('ADVANCED_WORKFLOWS');
  const sarEnabled = useFeatureEnabled('SAR');

  const api = useApi();

  const transactionsResponse = useCursorQuery(
    ALERT_ITEM_TRANSACTION_LIST(alert.alertId ?? '', { ...params }),
    async ({ from }) => {
      if (alert.alertId == null) {
        throw new Error(`Unable to fetch transactions for alert, it's id is empty`);
      }
      const [sortField, sortOrder] = params.sort[0] ?? [];

      return await api.getAlertTransactionList({
        ...FIXED_API_PARAMS,
        ...params,
        alertId: alert.alertId,
        start: from || params.from,
        page: params.page,
        pageSize: params.pageSize,
        userId: params.userId,
        sortField: sortField ?? undefined,
        sortOrder: sortOrder ?? undefined,
        filterOriginPaymentMethodId: params.originPaymentMethodId,
        filterDestinationPaymentMethodId: params.destinationPaymentMethodId,
        filterTransactionId: params.transactionId,
        filterOriginCurrencies: params.originCurrenciesFilter as CurrencyCode[],
        filterDestinationCurrencies: params.destinationCurrenciesFilter as CurrencyCode[],
        filterOriginPaymentMethods: params.originMethodFilter
          ? [params.originMethodFilter]
          : undefined,
        filterDestinationPaymentMethods: params.destinationMethodFilter
          ? [params.destinationMethodFilter]
          : undefined,
        filterTransactionType: params.type as TransactionType,
        beforeTimestamp: params.timestamp ? dayjs(params.timestamp[1]).valueOf() : undefined,
        afterTimestamp: params.timestamp ? dayjs(params.timestamp[0]).valueOf() : undefined,
        filterDestinationCountries: params['destinationAmountDetails.country'],
        filterOriginCountries: params['originAmountDetails.country'],
      });
    },
  );

  return (
    <>
      <TransactionsTable
        escalatedTransactions={escalatedTransactionIds}
        selectedIds={selectedTransactionIds}
        onSelect={(transactionIds) => {
          if (!alert.alertId) {
            // message.fatal('Unable to select transactions, alert id is empty');
            return;
          }
          onTransactionSelect && onTransactionSelect(alert.alertId, transactionIds);
        }}
        queryResult={transactionsResponse}
        params={params}
        onChangeParams={setParams}
        adjustPagination={true}
        showCheckedTransactionsButton={true}
        isModalVisible={isModalVisible}
        setIsModalVisible={setIsModalVisible}
        alert={alert}
        extraFilters={[
          {
            key: 'userId',
            title: 'User ID/name',
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
        canSelectRow={(row) => {
          if (!escalationEnabled && !sarEnabled) {
            return false;
          }
          const alertClosed = alert?.alertStatus === 'CLOSED';
          const transactionEscalated = escalatedTransactionIds?.includes(row.content.transactionId);
          if (alertClosed || transactionEscalated) {
            return false;
          }
          return true;
        }}
      />
      {isModalVisible && alert && (
        <DisplayCheckedTransactions
          visible={isModalVisible}
          setVisible={setIsModalVisible}
          alert={alert}
          caseUserId={caseUserId}
        />
      )}
    </>
  );
}
