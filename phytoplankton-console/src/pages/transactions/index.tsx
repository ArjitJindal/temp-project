import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { queryAdapter } from './components/TransactionsTable/helpers/queryAdapter';
import ProductTypeSearchButton from './components/ProductTypeSearchButton';
import { useApi } from '@/api';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import '../../components/ui/colors';
import TransactionsTable, {
  defaultTimestamps,
  transactionParamsToRequest,
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import { useCursorQuery, usePaginatedQuery } from '@/utils/queries/hooks';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import TagSearchButton from '@/pages/transactions/components/TagSearchButton';
import { TRANSACTIONS_LIST } from '@/utils/queries/keys';
import { makeUrl, parseQueryString } from '@/utils/routing';
import { useDeepEqualEffect } from '@/utils/hooks';
import { TransactionTableItem } from '@/apis';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { dayjs } from '@/utils/dayjs';

type NavigationState = {
  isInitialised: boolean;
} | null;

const TableList = () => {
  const api = useApi();
  const i18n = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const isClickhouseEnabled = useFeatureEnabled('CLICKHOUSE_ENABLED');

  const parsedParams = queryAdapter.deserializer(parseQueryString(location.search));
  const [params, setParams] = useState<TransactionsTableParams>({ sort: [], pageSize: 20 });

  const pushParamsToNavigation = useCallback(
    (params: TransactionsTableParams) => {
      const state: NavigationState = {
        isInitialised: true,
      };
      navigate(makeUrl('/transactions/list', {}, queryAdapter.serializer(params)), {
        replace: true,
        state: state,
      });
    },
    [navigate],
  );

  useEffect(() => {
    if ((location.state as NavigationState)?.isInitialised !== true) {
      pushParamsToNavigation({
        ...parsedParams,
        timestamp: [
          dayjs(defaultTimestamps().afterTimestamp).format(),
          dayjs(defaultTimestamps().beforeTimestamp).format(),
        ],
      });
    }
  }, [location.state, parsedParams, pushParamsToNavigation]);

  const handleChangeParams = (newParams: TransactionsTableParams) => {
    pushParamsToNavigation(newParams);
  };

  useDeepEqualEffect(() => {
    setParams((prevState: TransactionsTableParams) => ({
      ...prevState,
      ...parsedParams,
    }));
  }, [parsedParams]);

  const queryResult = useCursorQuery<TransactionTableItem>(
    TRANSACTIONS_LIST(parsedParams),
    async ({ from, view }) => {
      if (isClickhouseEnabled) {
        return {
          count: 0,
          hasNext: false,
          items: [],
          hasPrev: false,
          last: '',
          next: '',
          prev: '',
          limit: 0,
        };
      }
      return await api.getTransactionsList({
        start: from || parsedParams.from,
        ...transactionParamsToRequest({ ...parsedParams, view }),
      });
    },
  );

  const queryResultOffset = usePaginatedQuery<TransactionTableItem>(
    TRANSACTIONS_LIST({ ...parsedParams, offset: true }),
    async (paginationParams) => {
      if (!isClickhouseEnabled) {
        return {
          items: [],
          total: 0,
        };
      }
      const data = await api.getTransactionsV2List({
        ...transactionParamsToRequest({ ...parsedParams, view: paginationParams.view }),
        ...paginationParams,
      });

      return {
        items: data.items,
        total: data.count,
      };
    },
  );

  return (
    <PageWrapper title={i18n('menu.transactions.transactions-list')}>
      <PageWrapperContentContainer>
        <TransactionsTable
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
            {
              key: 'tagKey',
              title: 'Tags',
              renderer: ({ params, setParams }) => (
                <TagSearchButton
                  initialState={{
                    key: params.tagKey ?? undefined,
                    value: params.tagValue ?? undefined,
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
            {
              key: 'productType',
              title: 'Product Type',
              renderer: ({ params, setParams }) => (
                <ProductTypeSearchButton
                  initialState={{
                    productTypes: params.productType ?? undefined,
                  }}
                  onConfirm={(value) => {
                    setParams((state) => ({
                      ...state,
                      productType: value.productTypes,
                    }));
                  }}
                />
              ),
            },
          ]}
          queryResult={isClickhouseEnabled ? queryResultOffset : queryResult}
          params={params}
          onChangeParams={handleChangeParams}
          fitHeight
          paginationBorder={!isClickhouseEnabled}
          isExpandable
        />
      </PageWrapperContentContainer>
    </PageWrapper>
  );
};

export default TableList;
