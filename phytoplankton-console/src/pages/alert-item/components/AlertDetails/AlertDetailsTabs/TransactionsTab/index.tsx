import React, { useState } from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import TransactionsTable, {
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import DisplayCheckedTransactions from '@/pages/transactions/components/TransactionsTable/DisplayCheckedTransactions';
import { DEFAULT_PAGINATION_VIEW, DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useCursorQuery } from '@/utils/queries/hooks';
import { ALERT_ITEM_TRANSACTION_LIST } from '@/utils/queries/keys';
import { FIXED_API_PARAMS } from '@/pages/case-management-item/CaseDetails/InsightsCard';
import { dayjs } from '@/utils/dayjs';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useApi } from '@/api';
import {
  Alert,
  CurrencyCode,
  PaymentMethod,
  SanctionsDetails,
  SanctionsDetailsEntityType,
  TransactionTableItem,
  TransactionType,
} from '@/apis';
import { SelectionAction } from '@/components/library/Table/types';

interface Props {
  alert: Alert;
  caseUserId: string;
  selectedTransactionIds?: string[];
  onTransactionSelect?: (alertId: string, transactionIds: string[]) => void;
  escalatedTransactionIds?: string[];
  fitHeight?: boolean;
  selectionActions?: SelectionAction<TransactionTableItem, TransactionsTableParams>[];
  sanctionsDetailsFilter?: SanctionsDetails;
}

export default function TransactionsTab(props: Props) {
  const {
    caseUserId,
    alert,
    escalatedTransactionIds,
    onTransactionSelect,
    selectedTransactionIds,
    selectionActions,
    fitHeight,
    sanctionsDetailsFilter,
  } = props;
  const settings = useSettings();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [params, setParams] = useState<TransactionsTableParams>(DEFAULT_PARAMS_STATE);

  const escalationEnabled = useFeatureEnabled('ADVANCED_WORKFLOWS');
  const sarEnabled = useFeatureEnabled('SAR');
  const mapEntityTypeToTransactionMethod: Partial<
    Record<
      SanctionsDetailsEntityType,
      PaymentMethod[] // Using an array as some methods map to the same entity type
    >
  > = {
    NAME_ON_CARD: ['CARD'],
    BANK_ACCOUNT_HOLDER_NAME: ['GENERIC_BANK_ACCOUNT', 'IBAN'],
    PAYMENT_NAME: ['SWIFT', 'UPI', 'WALLET', 'CHECK', 'ACH', 'IBAN'],
    PAYMENT_BENEFICIARY_NAME: ['ACH'],
  };

  const api = useApi();

  const filterSanctionsHitIds = sanctionsDetailsFilter
    ? sanctionsDetailsFilter.sanctionHitIds
    : undefined;
  const filterSanctionsHitId = sanctionsDetailsFilter?.hitContext?.paymentMethodId
    ? undefined
    : filterSanctionsHitIds?.[0];
  const filterPaymentMethodId = sanctionsDetailsFilter?.hitContext?.paymentMethodId;
  const originMethodFilter: PaymentMethod[] = [];
  const destinationMethodFilter: PaymentMethod[] = [];
  if (alert.ruleId === 'R-169' && sanctionsDetailsFilter?.entityType) {
    const entityType = sanctionsDetailsFilter.entityType;
    const methods = mapEntityTypeToTransactionMethod[entityType] ?? [];

    if (alert.ruleHitMeta?.hitDirections?.includes('ORIGIN')) {
      destinationMethodFilter.push(...methods);
    }
    if (alert.ruleHitMeta?.hitDirections?.includes('DESTINATION')) {
      originMethodFilter.push(...methods);
    }
  }
  const transactionsResponse = useCursorQuery(
    ALERT_ITEM_TRANSACTION_LIST(alert.alertId ?? '', {
      ...params,
      filterSanctionsHitId,
      filterPaymentMethodId,
    }),
    async ({ from, view }) => {
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
        view: view ?? DEFAULT_PAGINATION_VIEW,
        userId: params.userId,
        sortField: sortField ?? undefined,
        sortOrder: sortOrder ?? undefined,
        filterOriginPaymentMethodId: params.originPaymentMethodId,
        filterDestinationPaymentMethodId: params.destinationPaymentMethodId,
        filterTransactionId: params.transactionId,
        filterOriginCurrencies: params.originCurrenciesFilter as CurrencyCode[],
        filterDestinationCurrencies: params.destinationCurrenciesFilter as CurrencyCode[],
        filterOriginPaymentMethods:
          alert.ruleId === 'R-169' && originMethodFilter.length > 0
            ? originMethodFilter
            : params.originMethodFilter
            ? [params.originMethodFilter]
            : undefined,
        filterDestinationPaymentMethods:
          alert.ruleId === 'R-169' && destinationMethodFilter.length > 0
            ? destinationMethodFilter
            : params.destinationMethodFilter
            ? [params.destinationMethodFilter]
            : undefined,
        filterTransactionType: params.type as TransactionType,
        beforeTimestamp: params.timestamp ? dayjs(params.timestamp[1]).valueOf() : undefined,
        afterTimestamp: params.timestamp ? dayjs(params.timestamp[0]).valueOf() : undefined,
        filterDestinationCountries: params['destinationAmountDetails.country'],
        filterOriginCountries: params['originAmountDetails.country'],
        filterSanctionsHitId: filterSanctionsHitId,
        filterPaymentMethodId: filterPaymentMethodId,
      });
    },
  );

  return (
    <>
      <TransactionsTable
        escalatedTransactions={escalatedTransactionIds}
        selectedIds={selectedTransactionIds}
        selectionInfo={
          selectionActions?.length
            ? {
                entityCount: selectedTransactionIds?.length ?? 0,
                entityName: 'transaction',
              }
            : undefined
        }
        selectionActions={selectionActions}
        onSelect={
          onTransactionSelect
            ? (transactionIds) => {
                if (!alert.alertId) {
                  // message.fatal('Unable to select transactions, alert id is empty');
                  return;
                }
                onTransactionSelect?.(alert.alertId, transactionIds);
              }
            : undefined
        }
        queryResult={transactionsResponse}
        params={params}
        onChangeParams={setParams}
        showCheckedTransactionsButton={true}
        isModalVisible={isModalVisible}
        setIsModalVisible={setIsModalVisible}
        alert={alert}
        fitHeight={fitHeight}
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
