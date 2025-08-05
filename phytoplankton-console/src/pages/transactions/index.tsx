import React, { useCallback } from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
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
import { makeUrl, useNavigationParams } from '@/utils/routing';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { dayjs } from '@/utils/dayjs';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

const TableList = () => {
  const i18n = useI18n();
  const settings = useSettings();

  const [params, setParams] = useNavigationParams<TransactionsTableParams>({
    queryAdapter: {
      serializer: queryAdapter.serializer,
      deserializer: (raw) => {
        const baseParams = {
          ...DEFAULT_PARAMS_STATE,
          ...queryAdapter.deserializer(raw),
        };

        if (!baseParams.timestamp) {
          baseParams.timestamp = [
            dayjs(defaultTimestamps().afterTimestamp).format(),
            dayjs(defaultTimestamps().beforeTimestamp).format(),
          ];
        }

        return baseParams;
      },
    },
    makeUrl: (rawQueryParams) => makeUrl('/transactions/list', {}, rawQueryParams),
    persist: {
      id: 'transactions-navigation-params',
      // If using parameters from local storage, always add timestamp filter
      adjustParsed: (params) => {
        if (params.timestamp != null) {
          return params;
        }
        return {
          ...params,
          timestamp: [
            dayjs(defaultTimestamps().afterTimestamp).format(),
            dayjs(defaultTimestamps().beforeTimestamp).format(),
          ],
        };
      },
    },
  });

  const handleChangeParams = useCallback(
    (newParams: TransactionsTableParams) => {
      setParams(newParams);
    },
    [setParams],
  );

  const { queryResult, countQueryResult } = useTransactionsQuery(params);

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
          countQueryResult={countQueryResult}
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
