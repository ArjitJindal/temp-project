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
import TransactionTagSearchButton from '@/pages/transactions/components/TransactionTagSearchButton';
import { makeUrl, useNavigationParams } from '@/utils/routing';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { dayjs } from '@/utils/dayjs';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/library/Button';
import Upload2LineIcon from '@/components/ui/icons/Remix/system/upload-2-line.react.svg';

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

  const flatImportEnabled = useFeatureEnabled('FLAT_FILES_IMPORT_TRANSACTIONS');

  return (
    <PageWrapper
      title={i18n('menu.transactions.transactions-list')}
      actionButton={
        flatImportEnabled ? (
          <Button
            type={'TETRIARY'}
            asLink={true}
            to={'/transactions/import/csv'}
            icon={<Upload2LineIcon />}
          >
            Import CSV
          </Button>
        ) : undefined
      }
    >
      <PageWrapperContentContainer>
        <TransactionsTable
          extraFilters={[
            {
              key: 'userId',
              title: `${firstLetterUpper(settings.userAlias)} ID`,
              showFilterByDefault: true,
              renderer: ({ params, setParams }) => (
                <UserSearchButton
                  title={`${firstLetterUpper(settings.userAlias)} ID`}
                  userId={params.userId ?? null}
                  params={params}
                  onConfirm={setParams}
                  filterType="id"
                />
              ),
            },
            {
              key: 'userName',
              title: `${firstLetterUpper(settings.userAlias)} name`,
              showFilterByDefault: true,
              renderer: ({ params, setParams }) => (
                <UserSearchButton
                  title={`${firstLetterUpper(settings.userAlias)} name`}
                  userId={params.userId ?? null}
                  params={params}
                  onConfirm={setParams}
                  filterType="name"
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
                  params={params}
                  onConfirm={setParams}
                />
              ),
            },
            {
              key: 'tagKey',
              title: 'Tags',
              renderer: ({ params, setParams }) => (
                <TransactionTagSearchButton
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
                      productType: value?.uniques,
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
                    setParams((state) => ({ ...state, transactionTypes: value?.uniques }));
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
