import React, { useState } from 'react';
import moment from 'moment';
import { useApi } from '@/api';
import PageWrapper from '@/components/PageWrapper';
import { measure } from '@/utils/time-utils';
import { useAnalytics } from '@/utils/segment/context';
import { useI18n } from '@/locales';
import '../../components/ui/colors';
import TransactionsTable, {
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import TransactionStateButton from '@/pages/transactions/components/TransactionStateButton';
import TagSearchButton from '@/pages/transactions/components/TagSearchButton';
import { TRANSACTIONS_LIST } from '@/utils/queries/keys';
import { DEFAULT_PARAMS_STATE } from '@/components/ui/Table';

const TableList = () => {
  const api = useApi();
  const analytics = useAnalytics();
  const i18n = useI18n();

  const [params, setParams] = useState<TransactionsTableParams>(DEFAULT_PARAMS_STATE);
  const queryResult = usePaginatedQuery(TRANSACTIONS_LIST(params), async ({ page: _page }) => {
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
    const [response, time] = await measure(() =>
      api.getTransactionsList({
        limit: pageSize,
        skip: ((_page ?? page) - 1) * pageSize,
        afterTimestamp: timestamp ? moment(timestamp[0]).valueOf() : 0,
        beforeTimestamp: timestamp ? moment(timestamp[1]).valueOf() : Date.now(),
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
    );
    analytics.event({
      title: 'Table Loaded',
      time,
    });
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
                transactionState={params.transactionState ?? []}
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
      />
    </PageWrapper>
  );
};

export default TableList;
