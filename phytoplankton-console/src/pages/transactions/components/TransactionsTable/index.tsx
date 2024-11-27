import React, { useMemo, useState } from 'react';
import { memoize } from 'lodash';
import { getRiskLevelFromScore } from '@flagright/lib/utils';
import DetailsViewButton from '../DetailsViewButton';
import ExpandedRowRenderer from './ExpandedRowRenderer';
import { isTransactionHasDetails } from './ExpandedRowRenderer/helpers';
import { PAYMENT_DETAILS_OR_METHOD } from './helpers/tableDataTypes';
import GavelIcon from '@/components/ui/icons/Remix/design/focus-2-line.react.svg';
import {
  Alert,
  ExecutedRulesResult,
  InternalTransaction,
  PaymentMethod,
  RuleAction,
  TransactionState,
} from '@/apis';
import {
  AllParams,
  CommonParams,
  DerivedColumn,
  SelectionAction,
  SimpleColumn,
  TableColumn,
  TableData,
  TableRefType,
  TableRow,
} from '@/components/library/Table/types';
import { makeUrl } from '@/utils/routing';
import { getUserLink } from '@/utils/api/users';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { QueryResult } from '@/utils/queries/types';
import Id from '@/components/ui/Id';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import {
  COUNTRY,
  DATE,
  FLOAT,
  MONEY_AMOUNT,
  MONEY_CURRENCIES,
  MONEY_CURRENCY,
  PAYMENT_METHOD,
  RULE_ACTION_STATUS,
  STRING,
  TAGS,
  TRANSACTION_STATE,
  TRANSACTION_TYPE,
  TRANSACTION_USER_NAME,
} from '@/components/library/Table/standardDataTypes';
import Button from '@/components/library/Button';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { SelectionInfo } from '@/components/library/Table';
import { dayjs } from '@/utils/dayjs';
import { useHasPermissions } from '@/utils/user-utils';
import { ExtraFilterProps } from '@/components/library/Filter/types';
import { useRuleOptions } from '@/utils/rules';
import Tag from '@/components/library/Tag';
import { DefaultApiGetTransactionsListRequest } from '@/apis/types/ObjectParamAPI';
import { useRiskClassificationScores } from '@/utils/risk-levels';
import { getOr } from '@/utils/asyncResource';
import RiskLevelTag from '@/components/library/Tag/RiskLevelTag';

export interface TransactionsTableParams extends CommonParams {
  current?: string;
  timestamp?: string[];
  transactionId?: string;
  type?: string;
  transactionState?: TransactionState[];
  originCurrenciesFilter?: string[];
  destinationCurrenciesFilter?: string[];
  userId?: string;
  tagKey?: string;
  tagValue?: string;
  originMethodFilter?: PaymentMethod;
  destinationMethodFilter?: PaymentMethod;
  originPaymentMethodId?: string;
  destinationPaymentMethodId?: string;
  transactionStatusFilter?: RuleAction[];
  ruleInstancesHitFilter?: string[];
  productType?: string[];
  'originAmountDetails.country'?: string[];
  'destinationAmountDetails.country'?: string[];
  status?: RuleAction & 'all';
  direction?: 'incoming' | 'outgoing' | 'all';
}

export const defaultTimestamps = memoize(() => ({
  afterTimestamp: dayjs().subtract(3, 'month').startOf('day').valueOf(),
  beforeTimestamp: dayjs().endOf('day').valueOf(),
}));

export const transactionParamsToRequest = (
  params: TransactionsTableParams,
  options?: {
    ignoreDefaultTimestamps?: boolean;
  },
): DefaultApiGetTransactionsListRequest => {
  const { ignoreDefaultTimestamps = false } = options ?? {};
  const {
    pageSize,
    page,
    timestamp,
    transactionId,
    type,
    transactionState,
    originCurrenciesFilter,
    destinationCurrenciesFilter,
    tagKey,
    tagValue,
    originMethodFilter,
    destinationMethodFilter,
    transactionStatusFilter,
    ruleInstancesHitFilter,
    productType,
    direction,
    status,
    userId,
  } = params;
  const [sortField, sortOrder] = params.sort[0] ?? [];
  const requestParams: DefaultApiGetTransactionsListRequest = {
    page,
    pageSize,
    afterTimestamp: timestamp
      ? dayjs(timestamp[0]).valueOf()
      : ignoreDefaultTimestamps
      ? undefined
      : defaultTimestamps().afterTimestamp,
    beforeTimestamp: timestamp
      ? dayjs(timestamp[1]).valueOf()
      : ignoreDefaultTimestamps
      ? undefined
      : defaultTimestamps().beforeTimestamp,
    filterId: transactionId,
    filterOriginCurrencies: originCurrenciesFilter,
    filterDestinationCurrencies: destinationCurrenciesFilter,
    transactionType: type,
    filterTransactionState: transactionState,
    sortField: sortField ?? undefined,
    sortOrder: sortOrder ?? undefined,
    includeUsers: true,
    filterOriginPaymentMethods: originMethodFilter ? [originMethodFilter] : undefined,
    filterDestinationPaymentMethods: destinationMethodFilter
      ? [destinationMethodFilter]
      : undefined,
    filterRuleInstancesHit: ruleInstancesHitFilter,
    filterTagKey: tagKey,
    filterTagValue: tagValue,
    filterOriginPaymentMethodId: params.originPaymentMethodId,
    filterDestinationPaymentMethodId: params.destinationPaymentMethodId,
    filterTransactionStatus: transactionStatusFilter,
    filterProductType: productType,
    filterDestinationCountries: params['destinationAmountDetails.country'],
    filterOriginCountries: params['originAmountDetails.country'],
    filterStatus: status && status !== 'all' ? [status] : undefined,
  };
  if (direction === 'outgoing') {
    requestParams.filterOriginUserId = userId;
  } else if (direction === 'incoming') {
    requestParams.filterDestinationUserId = userId;
  } else {
    requestParams.filterUserId = userId;
  }

  return requestParams;
};

type Props = {
  tableRef?: React.Ref<TableRefType>;
  extraFilters?: ExtraFilterProps<TransactionsTableParams>[];
  queryResult: QueryResult<TableData<InternalTransaction>>;
  params?: TransactionsTableParams;
  onChangeParams?: (newState: AllParams<TransactionsTableParams>) => void;
  selectedIds?: string[];
  onSelect?: (ids: string[]) => void;
  hideSearchForm?: boolean;
  disableSorting?: boolean;
  adjustPagination?: boolean;
  headerSubtitle?: string;
  fitHeight?: boolean | number;
  showCheckedTransactionsButton?: boolean;
  alert?: Alert;
  caseUserId?: string;
  isModalVisible?: boolean;
  setIsModalVisible?: React.Dispatch<React.SetStateAction<boolean>>;
  paginationBorder?: boolean;
  escalatedTransactions?: string[];
  selectionActions?: SelectionAction<InternalTransaction, TransactionsTableParams>[];
  selectionInfo?: SelectionInfo;
  isExpandable?: boolean;
  canSelectRow?: (row: TableRow<InternalTransaction>) => boolean;
};

export const getStatus = (
  executedRules: ExecutedRulesResult[],
  alert: Alert | undefined,
  status: RuleAction | undefined,
): RuleAction | undefined => {
  if (alert) {
    const ruleInstanceId = alert?.ruleInstanceId;
    const executedRule = executedRules.find((rule) => rule.ruleInstanceId === ruleInstanceId);
    return status ?? (executedRule?.ruleHit ? executedRule?.ruleAction : 'ALLOW');
  }
  return undefined;
};

export default function TransactionsTable(props: Props) {
  const [showDetailsView, setShowDetailsView] = useState<boolean>(false);
  const isRiskScoringEnabled = useFeatureEnabled('RISK_SCORING');

  const {
    tableRef,
    queryResult,
    params,
    hideSearchForm,
    disableSorting,
    extraFilters,
    selectedIds,
    selectionInfo,
    selectionActions,
    onSelect,
    onChangeParams,
    fitHeight,
    showCheckedTransactionsButton = false,
    alert,
    isModalVisible,
    setIsModalVisible,
    escalatedTransactions = [],
    isExpandable = false,
    canSelectRow,
  } = props;
  const ruleOptions = useRuleOptions();
  const riskClassificationQuery = useRiskClassificationScores();
  const riskClassificationValues = getOr(riskClassificationQuery, []);
  const columns: TableColumn<InternalTransaction>[] = useMemo(() => {
    const helper = new ColumnHelper<InternalTransaction>();
    return helper.list([
      helper.simple<'transactionId'>({
        title: 'Transaction ID',
        key: 'transactionId',
        filtering: true,
        pinFilterToLeft: true,
        type: {
          ...STRING,
          render: (value: string | undefined) => {
            return (
              <div style={{ overflowWrap: 'anywhere' }}>
                <Id to={makeUrl(`/transactions/item/:id`, { id: value })} testName="transaction-id">
                  {value}
                </Id>
                {escalatedTransactions &&
                  value != null &&
                  escalatedTransactions?.indexOf(value) > -1 && (
                    <>
                      <br />
                      <Tag color="blue">Escalated</Tag>
                    </>
                  )}
              </div>
            );
          },
          link: (value) => makeUrl(`/transactions/item/:id`, { id: value }),
          stringify(value) {
            return `${value}`;
          },
        },
      }),
      ...(isRiskScoringEnabled
        ? [
            helper.simple<'arsScore.arsScore'>({
              title: 'TRS score',
              key: 'arsScore.arsScore',
              type: FLOAT,
              sorting: true,
              tooltip: 'Transaction Risk Score',
              exporting: true,
            }),
            helper.derived({
              title: 'TRS level',
              value: (entity) => entity.arsScore?.arsScore,
              type: {
                render: (value) => {
                  if (value == null) {
                    return <>-</>;
                  }
                  const riskLevel = getRiskLevelFromScore(riskClassificationValues, value);
                  return <RiskLevelTag level={riskLevel} />;
                },
                stringify: (value) => {
                  return value ? getRiskLevelFromScore(riskClassificationValues, value) : '-';
                },
              },
              tooltip: 'Transaction Risk Score level',
              exporting: false,
            }),
          ]
        : []),
      helper.simple<'type'>({
        title: 'Transaction type',
        key: 'type',
        type: TRANSACTION_TYPE,
        filtering: true,
      }),
      helper.simple<'timestamp'>({
        title: 'Timestamp',
        key: 'timestamp',
        type: {
          ...DATE,
          ...(!alert && {
            autoFilterDataType: {
              kind: 'dateTimeRange',
              allowClear: false,
              clearNotAllowedReason: 'You must select an interval to view transactions',
            },
          }),
        },
        sorting: true,
        filtering: true,
        pinFilterToLeft: true,
      }),
      helper.simple<'transactionState'>({
        key: 'transactionState',
        title: 'Last transaction state',
        type: TRANSACTION_STATE,
        filtering: true,
      }),
      ...(alert
        ? [
            {
              title: 'Status',
              defaultWidth: 80,
              key: 'executedRules.ruleAction',
              value: (entity) => getStatus(entity.executedRules, alert, entity.status),
              type: RULE_ACTION_STATUS,
              filtering: true,
            } as DerivedColumn<InternalTransaction, RuleAction>,
          ]
        : [
            helper.simple<'status'>({
              title: 'Status',
              key: 'status',
              type: RULE_ACTION_STATUS,
              filtering: true,
            }),
          ]),
      helper.simple<'originUserId'>({
        key: 'originUserId',
        title: 'Origin user ID',
        tooltip: 'Origin is the Sender in a transaction',
        type: {
          ...STRING,
          render: (value, { item: entity }) => {
            return <Id to={getUserLink(entity.originUser)}>{value}</Id>;
          },
          stringify(value) {
            return `${value}`;
          },
          link: (value, item) => getUserLink(item.originUser) ?? '',
        },
      }),
      helper.simple<'originUser'>({
        key: 'originUser',
        title: 'Origin user name',
        type: TRANSACTION_USER_NAME,
        tooltip: 'Origin is the Sender in a transaction',
      }),
      {
        title: showDetailsView ? 'Origin payment details' : 'Origin method',
        key: 'originPaymentDetails',
        type: PAYMENT_DETAILS_OR_METHOD(showDetailsView),
      } as SimpleColumn<InternalTransaction, 'originPaymentDetails'>,
      {
        title: 'Origin payment identifier',
        key: 'originPaymentMethodId',
        type: STRING,
        filtering: true,
      } as SimpleColumn<InternalTransaction, 'originPaymentMethodId'>,
      helper.simple<'originAmountDetails.transactionAmount'>({
        title: 'Origin amount',
        type: MONEY_AMOUNT,
        key: 'originAmountDetails.transactionAmount',
        sorting: true,
      }),
      helper.simple<'originAmountDetails.transactionCurrency'>({
        title: 'Origin currency',
        key: 'originAmountDetails.transactionCurrency',
        type: MONEY_CURRENCY,
      }),
      helper.simple<'originAmountDetails.country'>({
        title: 'Origin country',
        key: 'originAmountDetails.country',
        type: COUNTRY,
        filtering: true,
      }),
      helper.simple<'destinationUserId'>({
        key: 'destinationUserId',
        title: 'Destination user ID',
        tooltip: 'Destination is the Receiver in a transaction',
        type: {
          ...STRING,
          render: (value, { item: entity }) => {
            return <Id to={getUserLink(entity.destinationUser)}>{value}</Id>;
          },
          link: (value, item) => getUserLink(item.destinationUser) ?? '',
          stringify(value) {
            return `${value}`;
          },
        },
      }),
      helper.simple<'destinationUser'>({
        title: 'Destination user name',
        key: 'destinationUser',
        type: TRANSACTION_USER_NAME,
        tooltip: 'Destination is the Receiver in a transaction',
      }),
      helper.simple<'destinationPaymentDetails'>({
        title: showDetailsView ? 'Destination payment details' : 'Destination method',
        key: 'destinationPaymentDetails',
        type: PAYMENT_DETAILS_OR_METHOD(showDetailsView),
      }),
      {
        title: 'Destination payment identifier',
        key: 'destinationPaymentMethodId',
        type: STRING,
        filtering: true,
      } as SimpleColumn<InternalTransaction, 'destinationPaymentMethodId'>,
      helper.simple<'destinationAmountDetails.transactionAmount'>({
        title: 'Destination amount',
        type: MONEY_AMOUNT,
        key: 'destinationAmountDetails.transactionAmount',
        sorting: true,
      }),
      helper.simple<'destinationAmountDetails.transactionCurrency'>({
        title: 'Destination currency',
        type: MONEY_CURRENCY,
        key: 'destinationAmountDetails.transactionCurrency',
      }),
      helper.simple<'destinationAmountDetails.country'>({
        title: 'Destination country',
        key: 'destinationAmountDetails.country',
        type: COUNTRY,
        filtering: true,
      }),
      helper.simple<'tags'>({
        title: 'Tags',
        type: TAGS,
        key: 'tags',
      }),
      helper.simple<'productType'>({
        title: 'Product type',
        type: STRING,
        key: 'productType',
      }),
      helper.simple<'reference'>({
        title: 'Reference',
        type: STRING,
        key: 'reference',
        defaultVisibility: false,
      }),
    ]);
  }, [
    isRiskScoringEnabled,
    alert,
    showDetailsView,
    escalatedTransactions,
    riskClassificationValues,
  ]);

  const fullExtraFilters: ExtraFilterProps<TransactionsTableParams>[] = [
    ...(extraFilters ?? []),
    {
      title: 'Origin currencies',
      key: 'originCurrenciesFilter',
      renderer: {
        ...MONEY_CURRENCIES.autoFilterDataType,
        mode: 'MULTIPLE',
      },
    } as ExtraFilterProps<TransactionsTableParams>,
    {
      title: 'Destination currencies',
      key: 'destinationCurrenciesFilter',
      renderer: {
        ...MONEY_CURRENCIES.autoFilterDataType,
        mode: 'MULTIPLE',
      },
    } as ExtraFilterProps<TransactionsTableParams>,
    {
      title: 'Origin method',
      key: 'originMethodFilter',
      renderer: PAYMENT_METHOD.autoFilterDataType,
    } as ExtraFilterProps<TransactionsTableParams>,
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

  const settings = useSettings();
  const isTransactionsDownloadEnabled = useHasPermissions(['transactions:export:read']);

  return (
    <QueryResultsTable<InternalTransaction, TransactionsTableParams>
      innerRef={tableRef}
      tableId={'transactions-list'}
      selection={(row) => {
        if (!onSelect) {
          return false;
        }
        if (canSelectRow) {
          return canSelectRow(row);
        }
        return true;
      }}
      selectedIds={selectedIds}
      selectionInfo={selectionInfo}
      selectionActions={selectionActions}
      onSelect={onSelect}
      params={params}
      onChangeParams={onChangeParams}
      extraFilters={fullExtraFilters}
      showResultsInfo
      rowKey="transactionId"
      queryResults={queryResult}
      columns={columns}
      pagination={true}
      hideFilters={hideSearchForm}
      disableSorting={disableSorting}
      fitHeight={fitHeight}
      paginationBorder
      fixedExpandedContainer={true}
      isExpandable={
        isExpandable ? (row) => isTransactionHasDetails(row.content, settings) : () => false
      }
      renderExpanded={(entity) => <ExpandedRowRenderer transactionId={entity.transactionId} />}
      extraTools={[
        () => (
          <>
            {showCheckedTransactionsButton && (
              <Button
                onClick={() => {
                  if (setIsModalVisible) {
                    setIsModalVisible((prevState) => !prevState);
                  }
                }}
                type="TETRIARY"
                size="MEDIUM"
                style={{ marginRight: 8 }}
              >
                {isModalVisible ? 'Hide' : 'View'} checked #TX's
              </Button>
            )}
            <DetailsViewButton
              onConfirm={(value) => {
                setShowDetailsView(value);
              }}
            />
          </>
        ),
      ]}
      rowHeightMode={showDetailsView ? 'AUTO' : 'FIXED'}
      toolsOptions={{
        download: isTransactionsDownloadEnabled,
        reload: true,
        setting: true,
      }}
    />
  );
}
