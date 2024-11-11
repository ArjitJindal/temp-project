import React, { useMemo, useState } from 'react';
import { ManualCaseCreationButton } from '../../ManualCaseCreationButton';
import style from './style.module.less';
import { prepareTableData } from './helpers';
import * as Card from '@/components/ui/Card';
import TransactionEventsTable from '@/pages/transactions-item/TransactionEventsTable';
import {
  Amount,
  CasesListResponse,
  RiskLevel,
  RuleAction,
  TransactionAmountDetails,
  TransactionEvent,
  TransactionState,
} from '@/apis';
import { useApi } from '@/api';
import { useCursorQuery, useQuery } from '@/utils/queries/hooks';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { CASES_LIST, USERS_ITEM_TRANSACTIONS_HISTORY } from '@/utils/queries/keys';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import {
  COUNTRY,
  DATE,
  FLOAT,
  MONEY,
  MONEY_CURRENCIES,
  PAYMENT_METHOD,
  RISK_LEVEL,
  RULE_ACTION_STATUS,
  STRING,
  TRANSACTION_STATE,
} from '@/components/library/Table/standardDataTypes';
import { makeUrl } from '@/utils/routing';
import Id from '@/components/ui/Id';
import { getOr } from '@/utils/asyncResource';
import { dayjs } from '@/utils/dayjs';
import { PaymentDetails } from '@/utils/api/payment-details';
import DetailsViewButton from '@/pages/transactions/components/DetailsViewButton';
import { PAYMENT_DETAILS_OR_METHOD } from '@/pages/transactions/components/TransactionsTable/helpers/tableDataTypes';
import { ExtraFilterProps } from '@/components/library/Filter/types';
import GavelIcon from '@/components/ui/icons/Remix/design/focus-2-line.react.svg';
import {
  transactionParamsToRequest,
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import { useRuleOptions } from '@/utils/rules';
import TagSearchButton from '@/pages/transactions/components/TagSearchButton';
import ProductTypeSearchButton from '@/pages/transactions/components/ProductTypeSearchButton';

export type DataItem = {
  index: number;
  status?: RuleAction;
  rowKey: string;
  transactionId?: string;
  timestamp?: number;
  originAmountDetails?: TransactionAmountDetails;
  destinationAmountDetails?: TransactionAmountDetails;
  direction?: 'Incoming' | 'Outgoing';
  events: Array<TransactionEvent>;
  ruleName: string | null;
  ruleDescription: string | null;
  arsRiskLevel?: RiskLevel;
  arsScore?: number;
  transactionState?: TransactionState;
  originPaymentDetails?: PaymentDetails;
  destinationPaymentDetails?: PaymentDetails;
};

type TableParams = TransactionsTableParams & {
  // includeEvents: boolean;
};

export function Content(props: { userId: string }) {
  const { userId } = props;
  const api = useApi();
  const isRiskScoringEnabled = useFeatureEnabled('RISK_SCORING');

  const [params, setParams] = useState<TableParams>({
    ...DEFAULT_PARAMS_STATE,
    timestamp: [dayjs().subtract(3, 'month').startOf('day'), dayjs().endOf('day')].map((x) =>
      x.format(),
    ),
  });

  const cases = useQuery(
    CASES_LIST({
      filterCaseTypes: ['MANUAL'],
      filterUserId: userId,
    }),
    async () => {
      return api.getCaseList({
        filterCaseTypes: ['MANUAL'],
        filterUserId: userId,
      });
    },
  );

  const [showDetailsView, setShowDetailsView] = useState(false);

  const responseRes = useCursorQuery(
    USERS_ITEM_TRANSACTIONS_HISTORY(userId, params),
    async ({ from }) => {
      const requestParams = {
        ...transactionParamsToRequest(params),
        start: from || params.from,
        includeEvents: true,
        includeUsers: false,
      };

      return api.getTransactionsList(requestParams).then((result) => ({
        next: result.next,
        prev: result.prev,
        last: result.last,
        hasNext: result.hasNext,
        hasPrev: result.hasPrev,
        count: result.count,
        limit: result.limit,
        items: prepareTableData(userId, result.items ?? []),
      }));
    },
  );

  const casesList = getOr<CasesListResponse>(cases.data, { data: [], total: 0 }); // eslint-disable-line

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const columns = useMemo(() => {
    const helper = new ColumnHelper<DataItem>();

    return helper.list([
      helper.simple<'transactionId'>({
        title: 'Transaction ID',
        key: 'transactionId',
        filtering: true,
        type: {
          ...STRING,
          render: (transactionId) => {
            return (
              <div className={style.idColumn}>
                <Id to={makeUrl(`/transactions/item/:id`, { id: transactionId ?? '' })}>
                  {transactionId}
                </Id>
              </div>
            );
          },
        },
      }),
      ...(isRiskScoringEnabled
        ? [
            helper.simple({
              title: 'TRS score',
              key: 'arsScore',
              id: 'arsScore.arsScore',
              type: FLOAT,
              sorting: true,
              tooltip: 'Transaction Risk Score',
            }),
            helper.simple<'arsRiskLevel'>({
              title: 'TRS level',
              type: RISK_LEVEL,
              key: 'arsRiskLevel',
              tooltip: 'Transaction Risk Score level',
            }),
          ]
        : []),
      helper.simple<'ruleName'>({
        title: 'Rules hit',
        key: 'ruleName',
      }),
      helper.simple<'ruleDescription'>({
        title: 'Rules description',
        tooltip: 'Describes the conditions required for this rule to be hit.',
        key: 'ruleDescription',
      }),
      helper.simple<'transactionState'>({
        id: 'lastTransactionState',
        title: 'Last transaction state',
        key: 'transactionState',
        type: TRANSACTION_STATE,
        filtering: true,
      }),
      helper.simple<'timestamp'>({
        title: 'Transaction time',
        key: 'timestamp',
        type: DATE,
        sorting: true,
        filtering: true,
      }),
      helper.simple<'status'>({
        key: 'status',
        title: 'Status',
        type: RULE_ACTION_STATUS,
        sorting: true,
        filtering: true,
      }),
      helper.simple<'direction'>({
        title: 'Transaction direction',
        key: 'direction',
        type: {
          autoFilterDataType: {
            kind: 'select',
            options: [
              { value: 'all', label: 'All' },
              { value: 'incoming', label: 'Incoming' },
              { value: 'outgoing', label: 'Outgoing' },
            ],
            mode: 'SINGLE',
            displayMode: 'select',
          },
        },
        filtering: true,
      }),
      helper.group({
        title: 'Origin',
        tooltip: 'Origin is the Sender in a transaction',
        children: helper.list([
          helper.derived<Amount>({
            id: 'originAmount',
            title: 'Origin amount',
            value: (entity): Amount | undefined => {
              if (entity.originAmountDetails == null) {
                return undefined;
              }
              return {
                amountValue: entity.originAmountDetails?.transactionAmount,
                amountCurrency: entity.originAmountDetails?.transactionCurrency,
              };
            },
            type: MONEY,
          }),
          helper.simple<'originAmountDetails.country'>({
            id: 'originCountry',
            title: 'Origin country',
            key: 'originAmountDetails.country',
            type: COUNTRY,
          }),
          helper.simple<'originPaymentDetails'>({
            title: showDetailsView ? 'Payment details' : 'Payment method',
            key: 'originPaymentDetails',
            type: PAYMENT_DETAILS_OR_METHOD(showDetailsView),
          }),
        ]),
      }),
      helper.group({
        title: 'Destination',
        tooltip: 'Destination is the Receiver in a transaction',
        children: helper.list([
          helper.derived({
            id: 'destinationAmount',
            title: 'Destination amount',
            value: (entity): Amount | undefined => {
              if (entity.destinationAmountDetails == null) {
                return undefined;
              }
              return {
                amountValue: entity.destinationAmountDetails?.transactionAmount,
                amountCurrency: entity.destinationAmountDetails?.transactionCurrency,
              };
            },
            type: MONEY,
          }),
          helper.simple<'destinationAmountDetails.country'>({
            id: 'destinationCountry',
            title: 'Destination country',
            key: 'destinationAmountDetails.country',
            type: COUNTRY,
          }),
          helper.simple<'destinationPaymentDetails'>({
            title: showDetailsView ? 'Payment details' : 'Payment method',
            key: 'destinationPaymentDetails',
            type: PAYMENT_DETAILS_OR_METHOD(showDetailsView),
          }),
        ]),
      }),
    ]);
  }, [isRiskScoringEnabled, showDetailsView]);

  const ruleOptions = useRuleOptions();

  const fullExtraFilters: ExtraFilterProps<TableParams>[] = [
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
    {
      title: 'Origin currencies',
      key: 'originCurrenciesFilter',
      renderer: {
        ...MONEY_CURRENCIES.autoFilterDataType,
        mode: 'MULTIPLE',
      },
    } as ExtraFilterProps<TableParams>,
    {
      title: 'Destination currencies',
      key: 'destinationCurrenciesFilter',
      renderer: {
        ...MONEY_CURRENCIES.autoFilterDataType,
        mode: 'MULTIPLE',
      },
    } as ExtraFilterProps<TableParams>,
    {
      title: 'Origin method',
      key: 'originMethodFilter',
      renderer: PAYMENT_METHOD.autoFilterDataType,
    } as ExtraFilterProps<TableParams>,
    {
      title: 'Destination method',
      key: 'destinationMethodFilter',
      renderer: PAYMENT_METHOD.autoFilterDataType,
    },
    {
      title: 'Rules',
      key: 'ruleInstancesHitFilter',
      renderer: {
        kind: 'select',
        mode: 'MULTIPLE',
        displayMode: 'select',
        options: ruleOptions,
      },
      icon: <GavelIcon />,
      showFilterByDefault: true,
    },
  ];

  return (
    <QueryResultsTable<DataItem>
      rowKey="rowKey"
      params={params}
      onChangeParams={setParams}
      queryResults={responseRes}
      rowHeightMode={showDetailsView ? 'AUTO' : 'FIXED'}
      columns={columns}
      renderExpanded={(item) => <TransactionEventsTable events={item.events} />}
      fixedExpandedContainer={true}
      fitHeight={true}
      selectionActions={[
        ({ selectedIds }) => {
          return (
            casesList.total > 0 && (
              <ManualCaseCreationButton userId={userId} transactionIds={selectedIds} type="EDIT" />
            )
          );
        },
        ({ selectedIds }) => (
          <ManualCaseCreationButton userId={userId} transactionIds={selectedIds} type="CREATE" />
        ),
      ]}
      selectionInfo={
        selectedIds.length > 0
          ? {
              entityCount: selectedIds.length,
              entityName: 'transactions',
            }
          : undefined
      }
      selection={true}
      extraTools={[
        () => (
          <DetailsViewButton
            onConfirm={(value) => {
              setShowDetailsView(value);
            }}
          />
        ),
      ]}
      extraFilters={fullExtraFilters}
      selectedIds={selectedIds}
      onSelect={setSelectedIds}
    />
  );
}

interface Props {
  userId: string | undefined;
  title?: string;
}

export default function UserTransactionHistoryTable(props: Props) {
  const { userId, title } = props;
  return (
    <Card.Root
      className={style.root}
      disabled={userId == null}
      header={title != null ? { title } : undefined}
    >
      {userId && (
        <Card.Section>
          <Content userId={userId} />
        </Card.Section>
      )}
    </Card.Root>
  );
}
