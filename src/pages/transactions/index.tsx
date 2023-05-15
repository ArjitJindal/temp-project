import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { queryAdapter } from './components/TransactionsTable/helpers/queryAdapter';
import { useApi } from '@/api';
import PageWrapper, { PageWrapperTableContainer } from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import '../../components/ui/colors';
import TransactionsTable, {
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import { useCursorQuery } from '@/utils/queries/hooks';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import TagSearchButton from '@/pages/transactions/components/TagSearchButton';
import { TRANSACTIONS_LIST } from '@/utils/queries/keys';
import { DEFAULT_PAGE_SIZE } from '@/components/library/Table/consts';
import { dayjs } from '@/utils/dayjs';
import { useApiTime, usePageViewTracker } from '@/utils/tracker';
import { makeUrl, parseQueryString } from '@/utils/routing';
import { useDeepEqualEffect } from '@/utils/hooks';
import { InternalTransaction } from '@/apis';

const TableList = () => {
  usePageViewTracker('Transactions List Page');
  const api = useApi();
  const i18n = useI18n();
  const measure = useApiTime();
  const navigate = useNavigate();

  const parsedParams = queryAdapter.deserializer(parseQueryString(location.search));
  const [params, setParams] = useState<TransactionsTableParams>({ sort: [], pageSize: 50 });

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
      sort: parsedParams.sort ?? [],
      pageSize: parsedParams.pageSize ?? DEFAULT_PAGE_SIZE,
      from: parsedParams.from,
    }));
  }, [parsedParams]);

  const queryResult = useCursorQuery<InternalTransaction>(
    TRANSACTIONS_LIST(parsedParams),
    async () => {
      const {
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
      } = parsedParams;
      const [sortField, sortOrder] = parsedParams.sort[0] ?? [];
      return await measure(
        () =>
          api.getTransactionsList({
            _from: parsedParams.from,
            pageSize: parsedParams.pageSize,
            afterTimestamp: timestamp ? dayjs(timestamp[0]).valueOf() : undefined,
            beforeTimestamp: timestamp ? dayjs(timestamp[1]).valueOf() : undefined,
            filterId: transactionId,
            filterUserId: userFilterMode === 'ALL' ? userId : undefined,
            filterOriginUserId: userFilterMode === 'ORIGIN' ? userId : undefined,
            filterDestinationUserId: userFilterMode === 'DESTINATION' ? userId : undefined,
            filterOriginCurrencies: originCurrenciesFilter,
            filterDestinationCurrencies: destinationCurrenciesFilter,
            transactionType: type,
            filterTransactionState: transactionState,
            field: 'transactionId',
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
    },
  );

  return (
    <PageWrapper title={i18n('menu.transactions.transactions-list')}>
      <PageWrapperTableContainer>
        <TransactionsTable
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
            {
              key: 'tagKey',
              title: 'Tags',
              renderer: ({ params, setParams }) => (
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
              ),
            },
          ]}
          queryResult={queryResult}
          params={params}
          onChangeParams={handleChangeParams}
          fitHeight
        />
      </PageWrapperTableContainer>
    </PageWrapper>
  );
};

export default TableList;
