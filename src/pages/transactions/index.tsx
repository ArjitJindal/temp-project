import React, { useState } from 'react';
import { useApi } from '@/api';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import '../../components/ui/colors';
import TransactionsTable, {
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import { TransactionStateButton } from '@/pages/transactions/components/TransactionStateButton';
import TagSearchButton from '@/pages/transactions/components/TagSearchButton';
import { TRANSACTIONS_LIST } from '@/utils/queries/keys';
import { DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import { dayjs } from '@/utils/dayjs';
import { useApiTime, usePageViewTracker } from '@/utils/tracker';

const TableList = () => {
  usePageViewTracker('Transactions List Page');
  const api = useApi();
  const i18n = useI18n();
  const measure = useApiTime();

  const [params, setParams] = useState<TransactionsTableParams>(DEFAULT_PARAMS_STATE);
  const queryResult = usePaginatedQuery(TRANSACTIONS_LIST(params), async (paginationParams) => {
    const {
      pageSize,
      page,
      timestamp,
      transactionId,
      type,
      transactionState,
      originCurrenciesFilter,
      destinationCurrenciesFilter,
      userId,
      userFilterMode,
      tagKey,
      tagValue,
      originMethodFilter,
      destinationMethodFilter,
    } = params;
    const [sortField, sortOrder] = params.sort[0] ?? [];

    const response = await measure(
      () =>
        api.getTransactionsList({
          page,
          pageSize,
          ...paginationParams,
          afterTimestamp: timestamp ? dayjs(timestamp[0]).valueOf() : 0,
          beforeTimestamp: timestamp ? dayjs(timestamp[1]).valueOf() : Date.now(),
          filterId: transactionId,
          filterUserId: userFilterMode === 'ALL' ? userId : undefined,
          filterOriginUserId: userFilterMode === 'ORIGIN' ? userId : undefined,
          filterDestinationUserId: userFilterMode === 'DESTINATION' ? userId : undefined,
          filterOriginCurrencies: originCurrenciesFilter,
          filterDestinationCurrencies: destinationCurrenciesFilter,
          transactionType: type,
          filterTransactionState: transactionState,
          sortField: sortField ?? undefined,
          sortOrder: sortOrder ?? undefined,
          includeUsers: true,
          filterOriginPaymentMethod: originMethodFilter,
          filterDestinationPaymentMethod: destinationMethodFilter,
          filterTagKey: tagKey,
          filterTagValue: tagValue,
        }),
      'Transactions List',
    );

    return {
      items: response.data,
      success: true,
      total: response.total,
    };
  });

  return (
    <PageWrapper title={i18n('menu.transactions.transactions-list')}>
      <TransactionsTable
        actionsHeader={[
          ({ params, setParams }) => (
            <>
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
              <TransactionStateButton
                transactionStates={params.transactionState ?? []}
                onConfirm={(value) => {
                  setParams((state) => ({
                    ...state,
                    transactionState: value ?? undefined,
                  }));
                }}
              />
              <TagSearchButton
                initialState={{
                  key: params.tagKey ?? null,
                  value: params.tagValue ?? null,
                }}
                onConfirm={(value) => {
                  setParams((state) => ({
                    ...state,
                    tagKey: value.key ?? undefined,
                    tagValue: value.value ?? undefined,
                  }));
                }}
              />
            </>
          ),
        ]}
        queryResult={queryResult}
        params={params}
        onChangeParams={setParams}
        autoAdjustHeight
      />
    </PageWrapper>
  );
};

export default TableList;
