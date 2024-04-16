import React, { useMemo, useState } from 'react';
import { TableAlertItem } from '../../types';
import Comments from './Comments';
import Checklist from './Checklist';
import { useCursorQuery, useQuery } from '@/utils/queries/hooks';
import { ALERT_ITEM, ALERT_ITEM_TRANSACTION_LIST } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import TransactionsTable, {
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import Tabs, { TabItem } from '@/components/library/Tabs';
import DisplayCheckedTransactions from '@/pages/transactions/components/TransactionsTable/DisplayCheckedTransactions';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import { FIXED_API_PARAMS } from '@/pages/case-management-item/CaseDetails/InsightsCard';
import { dayjs } from '@/utils/dayjs';
import { CurrencyCode, TransactionType } from '@/apis';
import { message } from '@/components/library/Message';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

enum AlertExpandedTabs {
  TRANSACTIONS = 'transactions',
  CHECKLIST = 'checklist',
  COMMENTS = 'comments',
}

interface Props {
  alert: TableAlertItem;
  selectedTransactionIds?: string[];
  onTransactionSelect?: (alertId: string, transactionIds: string[]) => void;
  escalatedTransactionIds?: string[];
}

export default function AlertExpanded(props: Props) {
  const { selectedTransactionIds, alert, onTransactionSelect, escalatedTransactionIds } = props;
  const [isModalVisible, setIsModalVisible] = useState(false);
  const alertId = alert.alertId;
  const api = useApi();

  const [params, setParams] = useState<TransactionsTableParams>(DEFAULT_PARAMS_STATE);

  const transactionsResponse = useCursorQuery(
    ALERT_ITEM_TRANSACTION_LIST(alertId ?? '', { ...params }),
    async ({ from }) => {
      if (alertId == null) {
        throw new Error(`Unable to fetch transactions for alert, it's id is empty`);
      }
      const [sortField, sortOrder] = params.sort[0] ?? [];

      return await api.getAlertTransactionList({
        ...FIXED_API_PARAMS,
        ...params,
        alertId: alertId,
        start: from,
        page: params.page,
        pageSize: params.pageSize,
        userId: params.userFilterMode === 'ALL' ? params.userId : undefined,
        originUserId: params.userFilterMode === 'ORIGIN' ? params.userId : undefined,
        destinationUserId: params.userFilterMode === 'DESTINATION' ? params.userId : undefined,
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
      });
    },
  );

  const alertResponse = useQuery(ALERT_ITEM(alertId ?? ''), async () => {
    if (alertId == null) {
      throw new Error(`Unable to fetch alert, id is empty`);
    }
    const alert = await api.getAlert({
      alertId,
    });
    return alert;
  });

  const escalationEnabled = useFeatureEnabled('ADVANCED_WORKFLOWS');
  const sarEnabled = useFeatureEnabled('SAR');

  const items = useMemo(() => {
    const tabs: TabItem[] = [];
    tabs.push({
      title: 'Transactions details',
      key: AlertExpandedTabs.TRANSACTIONS,
      children: (
        <>
          <TransactionsTable
            escalatedTransactions={escalatedTransactionIds}
            selectedIds={selectedTransactionIds}
            onSelect={(transactionIds) => {
              if (!alertId) {
                message.fatal('Unable to select transactions, alert id is empty');
                return;
              }
              onTransactionSelect && onTransactionSelect(alertId, transactionIds);
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
                    initialMode={params.userFilterMode ?? 'ALL'}
                    userId={params.userId ?? null}
                    onConfirm={(userId, mode) => {
                      setParams((state) => ({
                        ...state,
                        userId: userId ?? undefined,
                        userFilterMode: mode ?? undefined,
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
              const transactionEscalated = escalatedTransactionIds?.includes(
                row.content.transactionId,
              );
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
              caseUserId={alert.caseUserId}
            />
          )}
        </>
      ),
    });
    if (alert.ruleChecklistTemplateId && alert?.alertId) {
      tabs.push({
        title: 'Checklist',
        key: AlertExpandedTabs.CHECKLIST,
        children: <Checklist alert={alert} />,
      });
    }
    tabs.push({
      title: 'Comments',
      key: AlertExpandedTabs.COMMENTS,
      children: <Comments alertId={alertId ?? null} alertsRes={alertResponse.data} />,
    });
    return tabs;
  }, [
    alert,
    alertId,
    alertResponse.data,
    escalatedTransactionIds,
    isModalVisible,
    onTransactionSelect,
    params,
    selectedTransactionIds,
    transactionsResponse,
    escalationEnabled,
    sarEnabled,
  ]);

  return <Tabs items={items} type="line" defaultActiveKey={AlertExpandedTabs.TRANSACTIONS} />;
}
