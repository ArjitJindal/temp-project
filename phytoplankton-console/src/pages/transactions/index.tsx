import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import { useLocation, useNavigate } from 'react-router';
import { TRANSACTION_TYPES } from '@flagright/lib/utils';
import { queryAdapter } from './components/TransactionsTable/helpers/queryAdapter';
import UniquesSearchButton from './components/UniquesSearchButton';
import { useTransactionsQuery } from './utils';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import '../../components/ui/colors';
import TransactionsTable, {
  defaultTimestamps,
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import TagSearchButton from '@/pages/transactions/components/TagSearchButton';
import { makeUrl, parseQueryString } from '@/utils/routing';
import { NavigationState } from '@/utils/queries/types';
import { dayjs } from '@/utils/dayjs';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useDeepEqualEffect } from '@/utils/hooks';

const TableList = () => {
  const i18n = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useSettings();

  const parsedParams = useMemo(
    () => queryAdapter.deserializer(parseQueryString(location.search)),
    [location.search],
  );

  const [params, setParams] = useState<TransactionsTableParams>({
    sort: [],
    pageSize: 20,
    timestamp: [
      dayjs(defaultTimestamps().afterTimestamp).format(),
      dayjs(defaultTimestamps().beforeTimestamp).format(),
    ],
  });

  const [isReadyToFetch, setIsReadyToFetch] = useState(false);

  const pushParamsToNavigation = useCallback(
    (params: TransactionsTableParams) => {
      const state: NavigationState = {
        isInitialised: true,
      };
      navigate(makeUrl('/transactions/list', {}, queryAdapter.serializer(params)), {
        replace: true,
        state,
      });
    },
    [navigate],
  );

  useEffect(() => {
    if ((location.state as NavigationState)?.isInitialised !== true) {
      // Initialize from URL parameters if they exist, otherwise use defaults
      const defaultParams = {
        ...params,
        ...parsedParams,
        timestamp: parsedParams.timestamp || [
          dayjs(defaultTimestamps().afterTimestamp).format(),
          dayjs(defaultTimestamps().beforeTimestamp).format(),
        ],
      };
      setParams(defaultParams);
      pushParamsToNavigation(defaultParams);
    }
    setIsReadyToFetch(true);
  }, [location.state, params, parsedParams, pushParamsToNavigation]);

  useDeepEqualEffect(() => {
    if ((location.state as NavigationState)?.isInitialised !== true) {
      return;
    }
    setParams((prevState: TransactionsTableParams) => ({
      ...prevState,
      ...parsedParams,
    }));
  }, [parsedParams]);

  const handleChangeParams = useCallback(
    (newParams: TransactionsTableParams) => {
      pushParamsToNavigation(newParams);
    },
    [pushParamsToNavigation],
  );

  const { queryResult } = useTransactionsQuery(parsedParams, { isReadyToFetch });

  return (
    <PageWrapper title={i18n('menu.transactions.transactions-list')}>
      <PageWrapperContentContainer>
        <TransactionsTable
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
            {
              key: 'parentUserId',
              title: `Parent ${settings.userAlias} ID/name`,
              showFilterByDefault: false,
              renderer: ({ params, setParams }) => (
                <UserSearchButton
                  title={`Parent ${settings.userAlias} ID/name`}
                  userId={params.parentUserId ?? null}
                  onConfirm={(userId) => {
                    setParams((state) => ({
                      ...state,
                      parentUserId: userId ?? undefined,
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
              title: 'Account name',
              key: 'filterPaymentDetailName',
              renderer: { kind: 'string' },
              showFilterByDefault: false,
            },
            {
              key: 'productType',
              title: 'Product Type',
              renderer: ({ params, setParams }) => (
                <UniquesSearchButton
                  initialState={{
                    uniques: params.productType ?? undefined,
                  }}
                  uniqueType={'PRODUCT_TYPES'}
                  onConfirm={(value) => {
                    setParams((state) => ({
                      ...state,
                      productType: value.uniques,
                    }));
                  }}
                  title="Product Type"
                />
              ),
            },
            {
              key: 'transactionType',
              title: 'Transaction Type',
              showFilterByDefault: true,
              renderer: ({ params, setParams }) => (
                <UniquesSearchButton
                  uniqueType={'TRANSACTION_TYPES'}
                  title="Transaction Type"
                  defaults={TRANSACTION_TYPES as string[]}
                  initialState={{
                    uniques: params.transactionTypes ?? undefined,
                  }}
                  onConfirm={(value) => {
                    setParams((state) => ({ ...state, transactionTypes: value.uniques }));
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
