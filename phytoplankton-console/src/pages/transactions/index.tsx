import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { queryAdapter } from './components/TransactionsTable/helpers/queryAdapter';
import ProductTypeSearchButton from './components/ProductTypeSearchButton';
import { useApi } from '@/api';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import '../../components/ui/colors';
import TransactionsTable, {
  transactionParamsToRequest,
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import { useCursorQuery } from '@/utils/queries/hooks';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import TagSearchButton from '@/pages/transactions/components/TagSearchButton';
import { TRANSACTIONS_LIST } from '@/utils/queries/keys';
import { DEFAULT_PAGE_SIZE } from '@/components/library/Table/consts';
import { makeUrl, parseQueryString } from '@/utils/routing';
import { useDeepEqualEffect } from '@/utils/hooks';
import { InternalTransaction } from '@/apis';

const TableList = () => {
  const api = useApi();
  const i18n = useI18n();
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
    async ({ from }) => {
      return await api.getTransactionsList({
        start: from || parsedParams.from,
        ...transactionParamsToRequest(parsedParams),
      });
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
          queryResult={queryResult}
          params={params}
          onChangeParams={handleChangeParams}
          fitHeight
          isExpandable
        />
      </PageWrapperContentContainer>
    </PageWrapper>
  );
};

export default TableList;
