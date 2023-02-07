import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { queryAdapter } from './components/TransactionsTable/helpers/queryAdapter';
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
import { makeUrl, parseQueryString } from '@/utils/routing';
import { useDeepEqualEffect } from '@/utils/hooks';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/consts';

const TableList = () => {
  usePageViewTracker('Transactions List Page');
  const api = useApi();
  const i18n = useI18n();
  const measure = useApiTime();
  const navigate = useNavigate();

  const parsedParams = queryAdapter.deserializer(parseQueryString(location.search));
  const [params, setParams] = useState<TransactionsTableParams>(DEFAULT_PARAMS_STATE);

  const pushParamsToNavigation = useCallback(
    (params: TransactionsTableParams) => {
      navigate(makeUrl('/transactions/list', {}, queryAdapter.serializer(params)), {
        replace: true,
      });
    },
    [navigate],
  );

  const handleChangeParams = (newParams: TransactionsTableParams) => {
    pushParamsToNavigation(newParams);
  };

  useDeepEqualEffect(() => {
    setParams((prevState: TransactionsTableParams) => ({
      ...prevState,
      ...parsedParams,
      page: parsedParams.page ?? 1,
      sort: parsedParams.sort ?? [],
      pageSize: parsedParams.pageSize ?? DEFAULT_PAGE_SIZE,
    }));
  }, [parsedParams]);

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
        onChangeParams={handleChangeParams}
        autoAdjustHeight
      />
    </PageWrapper>
  );
};

export default TableList;
