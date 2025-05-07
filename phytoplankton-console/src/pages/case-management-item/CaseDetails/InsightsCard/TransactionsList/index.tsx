import React, { useState } from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import { TRANSACTION_TYPES } from '@flagright/lib/utils';
import { Params } from '../TransactionsSelector';
import { FIXED_API_PARAMS } from '..';
import TransactionsTable, {
  defaultTimestamps,
  transactionParamsToRequest,
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import { useApi } from '@/api';
import { useCursorQuery } from '@/utils/queries/hooks';
import { TRANSACTIONS_LIST } from '@/utils/queries/keys';
import { DEFAULT_PAGE_SIZE, DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useDeepEqualEffect } from '@/utils/hooks';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import { dayjs } from '@/utils/dayjs';
import TagSearchButton from '@/pages/transactions/components/TagSearchButton';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import UniquesSearchButton from '@/pages/transactions/components/UniquesSearchButton';
interface Props {
  userId: string;
  selectorParams: Params;
}

export default function TransactionsList(props: Props) {
  const { userId, selectorParams } = props;
  const settings = useSettings();
  // todo: reset table params when selector params changed
  const [tableParams, setTableParams] = useState<TransactionsTableParams>({
    timestamp: [
      dayjs(defaultTimestamps().afterTimestamp).format(),
      dayjs(defaultTimestamps().beforeTimestamp).format(),
    ],
    ...DEFAULT_PARAMS_STATE,
    sort: [['timestamp', 'descend']],
  });

  useDeepEqualEffect(() => {
    const pageSize = DEFAULT_PAGE_SIZE;

    setTableParams((state) => ({
      ...state,
      page: 1,
      pageSize,
    }));
  }, [selectorParams]);

  const api = useApi();
  const queryResult = useCursorQuery(
    TRANSACTIONS_LIST({ ...tableParams, ...selectorParams, userId }),

    async ({ from, view }) => {
      return await api.getTransactionsList({
        ...FIXED_API_PARAMS,
        ...transactionParamsToRequest({ ...tableParams, view }, { ignoreDefaultTimestamps: true }),
        pageSize: tableParams.pageSize,
        start: from || tableParams.from,
        filterUserId: userId,
        filterStatus: selectorParams.selectedRuleActions,
        filterTransactionState: selectorParams.selectedTransactionStates,
        includeUsers: true,
      });
    },
  );

  return (
    <TransactionsTable
      queryResult={queryResult}
      params={tableParams}
      onChangeParams={setTableParams}
      fitHeight={300}
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
              title="Product Type"
              onConfirm={(value) => {
                setParams((state) => ({
                  ...state,
                  productType: value.uniques,
                }));
              }}
            />
          ),
        },
        {
          key: 'transactionType',
          title: 'Transaction Type',
          renderer: ({ params, setParams }) => (
            <UniquesSearchButton
              initialState={{
                uniques: params.transactionTypes ?? undefined,
              }}
              uniqueType={'TRANSACTION_TYPES'}
              title="Transaction Type"
              defaults={TRANSACTION_TYPES as string[]}
              onConfirm={(value) => {
                setParams((state) => ({
                  ...state,
                  transactionTypes: value.uniques,
                }));
              }}
            />
          ),
        },
      ]}
    />
  );
}
