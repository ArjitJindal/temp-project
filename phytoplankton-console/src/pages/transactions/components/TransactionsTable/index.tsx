import React, { useMemo, useState } from 'react';
import { memoize } from 'lodash';
import { getRiskLevelFromScore } from '@flagright/lib/utils';
import DetailsViewButton from '../DetailsViewButton';
import ExpandedRowRenderer from './ExpandedRowRenderer';
import { PAYMENT_DETAILS_OR_METHOD } from './helpers/tableDataTypes';
import { isTransactionHasDetails } from './ExpandedRowRenderer/helpers';
import GavelIcon from '@/components/ui/icons/Remix/design/focus-2-line.react.svg';
import {
  Alert,
  ExecutedRulesResult,
  PaymentMethod,
  RuleAction,
  TableListViewEnum,
  TransactionState,
  TransactionTableItem,
  TransactionTableItemUser,
  UserType,
} from '@/apis';
import {
  AllParams,
  CommonParams,
  DerivedColumn,
  SelectionAction,
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
import { DEFAULT_PAGINATION_VIEW } from '@/components/library/Table/consts';

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
  'originPayment.paymentMethodId'?: string;
  'destinationPayment.paymentMethodId'?: string;
  transactionStatusFilter?: RuleAction[];
  ruleInstancesHitFilter?: string[];
  productType?: string[];
  'originAmountDetails.country'?: string[];
  'destinationAmountDetails.country'?: string[];
  'originPayment.country'?: string[];
  'destinationPayment.country'?: string[];
  status?: RuleAction & 'all';
  direction?: 'incoming' | 'outgoing' | 'all';
  showDetailedView?: boolean;
  view?: TableListViewEnum;
}

const getUserLinkObject = (user?: TransactionTableItemUser) => {
  if (!user?.id || !user?.type) {
    return;
  }

  return {
    type: user.type as UserType,
    userId: user.id,
  };
};
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
    view,
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
    view: view ?? DEFAULT_PAGINATION_VIEW,
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
    filterOriginPaymentMethodId: params['originPayment.paymentMethodId'],
    filterDestinationPaymentMethodId: params['destinationPayment.paymentMethodId'],
    filterTransactionStatus: transactionStatusFilter,
    filterProductType: productType,
    filterDestinationCountries: params['destinationPayment.country'],
    filterOriginCountries: params['originPayment.country'],
    filterStatus: status && status !== 'all' ? [status] : undefined,
    includePaymentDetails: params.showDetailedView,
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
  queryResult: QueryResult<TableData<TransactionTableItem>>;
  params?: AllParams<TransactionsTableParams>;
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
  selectionActions?: SelectionAction<TransactionTableItem, TransactionsTableParams>[];
  selectionInfo?: SelectionInfo;
  isExpandable?: boolean;
  canSelectRow?: (row: TableRow<TransactionTableItem>) => boolean;
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

  const columns: TableColumn<TransactionTableItem>[] = useMemo(() => {
    const helper = new ColumnHelper<TransactionTableItem>();

    let alertColumns: DerivedColumn<any, any>[] = [];
    if (alert) {
      alertColumns = [
        helper.derived<string>({
          title: 'Alert ID',
          value: (): string => alert.alertId || '',
          hideInTable: true,
          exporting: true,
        }),
        helper.derived<string>({
          title: 'Rule name',
          value: (): string => alert.ruleName,
          hideInTable: true,
          exporting: true,
        }),
        helper.derived<string>({
          title: 'Rule description',
          value: (): string => alert.ruleDescription,
          hideInTable: true,
          exporting: true,
        }),
      ];
    }
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
      ...alertColumns,
      ...(isRiskScoringEnabled
        ? [
            helper.simple<'ars.score'>({
              title: 'TRS score',
              key: 'ars.score',
              type: FLOAT,
              sorting: true,
              tooltip: 'Transaction Risk Score',
              exporting: true,
            }),
            helper.derived({
              title: 'TRS level',
              value: (entity) => entity.ars?.score,
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
              allowClear: true,
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
              key: 'status',
              value: (entity) => entity.status,
              type: RULE_ACTION_STATUS,
              filtering: true,
            } as DerivedColumn<TransactionTableItem, RuleAction>,
          ]
        : [
            helper.simple<'status'>({
              title: 'Status',
              key: 'status',
              type: RULE_ACTION_STATUS,
              filtering: true,
            }),
          ]),
      helper.simple<'originUser.id'>({
        key: 'originUser.id',
        title: 'Origin user ID',
        tooltip: 'Origin is the Sender in a transaction',
        type: {
          ...STRING,
          render: (value, { item: entity }) => {
            return <Id to={getUserLink(getUserLinkObject(entity.originUser))}>{value}</Id>;
          },
          stringify(value) {
            return `${value}`;
          },
          link: (value, item) => getUserLink(getUserLinkObject(item.originUser)) ?? '',
        },
      }),
      helper.simple<'originUser.name'>({
        key: 'originUser.name',
        title: 'Origin user name',
        type: STRING,
        tooltip: 'Origin is the Sender in a transaction',
      }),
      helper.simple<'originPayment.paymentDetails'>({
        title: showDetailsView ? 'Origin payment details' : 'Origin method',
        key: 'originPayment.paymentDetails',
        type: PAYMENT_DETAILS_OR_METHOD(showDetailsView),
      }),
      helper.simple<'originPayment.paymentMethodId'>({
        title: 'Origin payment identifier',
        key: 'originPayment.paymentMethodId',
        type: STRING,
        filtering: true,
      }),
      helper.simple<'originPayment.amount'>({
        title: 'Origin amount',
        type: MONEY_AMOUNT,
        key: 'originPayment.amount',
        sorting: true,
      }),
      helper.simple<'originPayment.currency'>({
        title: 'Origin currency',
        key: 'originPayment.currency',
        type: MONEY_CURRENCY,
      }),
      helper.simple<'originPayment.country'>({
        title: 'Origin country',
        key: 'originPayment.country',
        type: COUNTRY,
        filtering: true,
      }),
      helper.simple<'originFundsInfo.sourceOfFunds'>({
        title: 'Source of funds',
        key: 'originFundsInfo.sourceOfFunds',
        type: STRING,
        defaultVisibility: false,
      }),
      helper.simple<'originFundsInfo.sourceOfWealth'>({
        title: 'Source of wealth',
        key: 'originFundsInfo.sourceOfWealth',
        type: STRING,
        defaultVisibility: false,
      }),
      helper.simple<'destinationUser.id'>({
        key: 'destinationUser.id',
        title: 'Destination user ID',
        tooltip: 'Destination is the Receiver in a transaction',
        type: {
          ...STRING,
          render: (value, { item: entity }) => {
            return <Id to={getUserLink(getUserLinkObject(entity.destinationUser))}>{value}</Id>;
          },
          link: (value, item) => getUserLink(getUserLinkObject(item.destinationUser)) ?? '',
          stringify(value) {
            return `${value}`;
          },
        },
      }),
      helper.simple<'destinationUser.name'>({
        title: 'Destination user name',
        key: 'destinationUser.name',
        type: STRING,
        tooltip: 'Destination is the Receiver in a transaction',
      }),
      helper.simple<'destinationPayment.paymentDetails'>({
        title: showDetailsView ? 'Destination payment details' : 'Destination method',
        key: 'destinationPayment.paymentDetails',
        type: PAYMENT_DETAILS_OR_METHOD(showDetailsView),
      }),
      helper.simple<'destinationPayment.paymentMethodId'>({
        title: 'Destination payment identifier',
        key: 'destinationPayment.paymentMethodId',
        type: STRING,
        filtering: true,
      }),
      helper.simple<'destinationPayment.amount'>({
        title: 'Destination amount',
        type: MONEY_AMOUNT,
        key: 'destinationPayment.amount',
        sorting: true,
      }),
      helper.simple<'destinationPayment.currency'>({
        title: 'Destination currency',
        type: MONEY_CURRENCY,
        key: 'destinationPayment.currency',
      }),
      helper.simple<'destinationPayment.country'>({
        title: 'Destination country',
        key: 'destinationPayment.country',
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
      helper.simple<'alertIds'>({
        title: 'Alert IDs',
        id: 'alertIds',
        type: {
          stringify: (value) => (value ? value.join(', ') : ''),
        },
        key: 'alertIds',
        defaultVisibility: true,
        hideInTable: true,
        exporting: true,
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
    <QueryResultsTable<TransactionTableItem, TransactionsTableParams>
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

                if (onChangeParams && params) {
                  onChangeParams({ ...params, showDetailedView: value });
                }
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
