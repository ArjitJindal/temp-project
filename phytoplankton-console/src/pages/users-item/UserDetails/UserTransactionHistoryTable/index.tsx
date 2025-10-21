import React, { useMemo, useState } from 'react';
import { getRiskLevelFromScore, TRANSACTION_TYPES } from '@flagright/lib/utils';
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
  TransactionState,
} from '@/apis';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { CASES_LIST } from '@/utils/queries/keys';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
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
  TRANSACTION_TYPE,
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
import { TransactionsTableParams } from '@/pages/transactions/components/TransactionsTable';
import { useRuleOptions } from '@/utils/rules';
import TagSearchButton from '@/pages/transactions/components/TransactionTagSearchButton';
import { useRiskClassificationScores } from '@/utils/risk-levels';
import { DefaultApiGetCaseListRequest } from '@/apis/types/ObjectParamAPI';
import UniquesSearchButton from '@/pages/transactions/components/UniquesSearchButton';
import { useTransactionsQuery } from '@/pages/transactions/utils';
import { TableDataItem } from '@/components/library/Table/types';
import { useCaseItems } from '@/utils/api/cases';

export type DataItem = {
  index: number;
  status?: RuleAction;
  rowKey: string;
  transactionId: string;
  type: string;
  timestamp?: number;
  originAmountDetails?: TransactionAmountDetails;
  destinationAmountDetails?: TransactionAmountDetails;
  direction?: 'Incoming' | 'Outgoing';
  ruleName: string | null;
  ruleDescription: string | null;
  arsRiskLevel?: RiskLevel;
  arsScore?: number;
  transactionState?: TransactionState;
  originPaymentDetails?: PaymentDetails;
  destinationPaymentDetails?: PaymentDetails;
  alertIds?: string[];
};

type TableParams = TransactionsTableParams;

export function Content(props: { userId: string }) {
  const { userId } = props;
  const api = useApi();
  const settings = useSettings();
  const isRiskScoringEnabled = useFeatureEnabled('RISK_SCORING');
  const riskClassificationValues = useRiskClassificationScores();

  const [params, setParams] = useState<TableParams>({
    ...DEFAULT_PARAMS_STATE,
    timestamp: [dayjs().subtract(3, 'month').startOf('day'), dayjs().endOf('day')].map((x) =>
      x.format(),
    ),
    userId,
  });

  const filter: DefaultApiGetCaseListRequest = {
    filterCaseTypes: ['MANUAL'],
    filterUserId: userId,
  };

  const cases = useCaseItems(filter);

  const [showDetailsView, setShowDetailsView] = useState(false);

  const { queryResult, countQueryResult } = useTransactionsQuery<TableDataItem<DataItem>>(
    { ...params, userId, includeRuleHitDetails: true, showDetailedView: showDetailsView },
    {
      isReadyToFetch: true,
      mapper: (data) => {
        const tableData = prepareTableData(userId, data, riskClassificationValues);
        return tableData;
      },
    },
  );

  const casesList = getOr<CasesListResponse>(cases.data, { data: [], total: 0 }); // eslint-disable-line

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const columns = useMemo(() => {
    const helper = new ColumnHelper<DataItem>();
    const configRiskLevelAliasArray = settings?.riskLevelAlias || [];

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
      helper.simple<'type'>({
        title: 'Transaction Type',
        key: 'type',
        type: TRANSACTION_TYPE,
      }),
      ...(isRiskScoringEnabled
        ? [
            helper.simple<'arsScore'>({
              title: 'TRS score',
              key: 'arsScore',
              id: 'arsScore',
              type: FLOAT,
              sorting: true,
              tooltip: 'Transaction Risk Score',
            }),
            helper.derived<RiskLevel>({
              title: 'TRS level',
              id: 'arsRiskLevel',
              value: (entity) =>
                getRiskLevelFromScore(
                  riskClassificationValues,
                  entity.arsScore ?? null,
                  configRiskLevelAliasArray,
                ),
              type: RISK_LEVEL,
              tooltip: 'Transaction Risk Score level',
            }),
          ]
        : []),
      helper.simple<'alertIds'>({
        title: 'Alert IDs',
        key: 'alertIds',
        hideInTable: true,
        exporting: true,
        type: {
          stringify: (value) => value?.join(', ') || '-',
        },
      }),
      helper.simple<'ruleName'>({
        title: 'Rules hit',
        key: 'ruleName',
        type: STRING,
      }),
      helper.simple<'transactionState'>({
        id: 'transactionState',
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
            id: 'originPayment.amount',
            title: 'Origin amount',
            tooltip: 'Sorting is based on the original transaction value',
            sorting: true,
            value: (entity): Amount | undefined => {
              if (entity.originAmountDetails == null) {
                return;
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
            id: 'destinationPayment.amount',
            title: 'Destination amount',
            tooltip: 'Sorting is based on the original transaction value',
            sorting: true,
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
  }, [isRiskScoringEnabled, showDetailsView, riskClassificationValues, settings?.riskLevelAlias]);

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
      showFilterByDefault: true,
      renderer: ({ params, setParams }) => (
        <UniquesSearchButton
          uniqueType={'PRODUCT_TYPES'}
          title="Product Type"
          initialState={{
            uniques: params.productType ?? undefined,
          }}
          onConfirm={(value) => {
            setParams((state) => ({ ...state, productType: value.uniques }));
          }}
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
        options: ruleOptions.filter(Boolean) as { value: string; label: string }[],
      },
      icon: <GavelIcon />,
      showFilterByDefault: true,
    },
    {
      title: 'Account name',
      key: 'filterPaymentDetailName',
      renderer: { kind: 'string' },
      showFilterByDefault: false,
    },
    {
      title: 'Reference',
      key: 'reference',
      renderer: { kind: 'string' },
      showFilterByDefault: false,
    },
  ];

  return (
    <QueryResultsTable<DataItem>
      tableId={'user-transaction-history'}
      rowKey="rowKey"
      params={params}
      onChangeParams={setParams}
      queryResults={queryResult}
      countQueryResults={countQueryResult}
      rowHeightMode={showDetailsView ? 'AUTO' : 'FIXED'}
      columns={columns}
      renderExpanded={(item) => <TransactionEventsTable transactionId={item.transactionId} />}
      fixedExpandedContainer={true}
      fitHeight={true}
      selectionActions={[
        ({ selectedIds }) => {
          return (
            !!casesList.total && (
              <ManualCaseCreationButton userId={userId} transactionIds={selectedIds} type="EDIT" />
            )
          );
        },
        ({ selectedIds }) => (
          <ManualCaseCreationButton userId={userId} transactionIds={selectedIds} type="CREATE" />
        ),
      ]}
      selectionInfo={
        selectedIds.length
          ? { entityCount: selectedIds.length, entityName: 'transactions' }
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
