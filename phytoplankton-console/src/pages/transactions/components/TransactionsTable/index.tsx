import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tag } from 'antd';
import DetailsViewButton from '../DetailsViewButton';
import ExpandedRowRenderer from './ExpandedRowRenderer';
import { isTransactionHasDetails } from './ExpandedRowRenderer/helpers';
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
  ColumnDataType,
  CommonParams,
  DerivedColumn,
  ExtraFilter,
  SelectionAction,
  SimpleColumn,
  TableColumn,
  TableData,
  TableRefType,
} from '@/components/library/Table/types';
import { makeUrl } from '@/utils/routing';
import { getUserLink } from '@/utils/api/users';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { QueryResult } from '@/utils/queries/types';
import { Mode } from '@/pages/transactions/components/UserSearchPopup/types';
import Id from '@/components/ui/Id';
import { PaymentDetailsCard } from '@/components/ui/PaymentDetailsCard';
import { PaymentMethodTag } from '@/components/ui/PaymentTypeTag';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import {
  COUNTRY,
  DATE_TIME,
  FLOAT,
  MONEY_AMOUNT,
  MONEY_CURRENCIES,
  MONEY_CURRENCY,
  PAYMENT_METHOD,
  RISK_LEVEL,
  RULE_ACTION,
  STRING,
  TAGS,
  TRANSACTION_STATE,
  TRANSACTION_TYPE,
  USER_NAME,
} from '@/components/library/Table/standardDataTypes';
import { PaymentDetails } from '@/pages/transactions-item/UserDetails/PaymentDetails';
import Button from '@/components/library/Button';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { SelectionInfo } from '@/components/library/Table';
import { dayjs } from '@/utils/dayjs';
import { DefaultApiGetTransactionsListRequest } from '@/apis/types/ObjectParamAPI';

const PAYMENT_DETAILS_OR_METHOD = (showDetailsView: boolean): ColumnDataType<PaymentDetails> => ({
  stringify: (value) => {
    return `${value?.method}`;
  },
  defaultWrapMode: 'WRAP',
  render: (value) => {
    if (showDetailsView) {
      return <PaymentDetailsCard paymentDetails={value} />;
    }
    return <PaymentMethodTag paymentMethod={value?.method} />;
  },
});

export interface TransactionsTableParams extends CommonParams {
  current?: string;
  timestamp?: string[];
  transactionId?: string;
  type?: string;
  transactionState?: TransactionState[];
  originCurrenciesFilter?: string[];
  destinationCurrenciesFilter?: string[];
  userId?: string;
  userFilterMode?: Mode;
  tagKey?: string;
  tagValue?: string;
  originMethodFilter?: PaymentMethod;
  destinationMethodFilter?: PaymentMethod;
  originPaymentMethodId?: string;
  destinationPaymentMethodId?: string;
  transactionStatusFilter?: RuleAction[];
}

export const transactionParamsToRequest = (
  params: TransactionsTableParams,
): DefaultApiGetTransactionsListRequest => {
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
  } = params;
  const [sortField, sortOrder] = params.sort[0] ?? [];
  return {
    page,
    pageSize,
    afterTimestamp: timestamp ? dayjs(timestamp[0]).valueOf() : 0,
    beforeTimestamp: timestamp ? dayjs(timestamp[1]).valueOf() : undefined,
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
    filterTagKey: tagKey,
    filterTagValue: tagValue,
    filterOriginUserId: params.userFilterMode === 'ORIGIN' ? params.userId : undefined,
    filterDestinationUserId: params.userFilterMode === 'DESTINATION' ? params.userId : undefined,
    filterOriginPaymentMethodId: params.originPaymentMethodId,
    filterDestinationPaymentMethodId: params.destinationPaymentMethodId,
  };
};

type Props = {
  tableRef?: React.Ref<TableRefType>;
  extraFilters?: ExtraFilter<TransactionsTableParams>[];
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
};

export const getStatus = (
  executedRules: ExecutedRulesResult[],
  alert: Alert | undefined,
): RuleAction | undefined => {
  if (alert) {
    const ruleInstanceId = alert?.ruleInstanceId;
    const executedRule = executedRules.find((rule) => rule.ruleInstanceId === ruleInstanceId);
    return executedRule?.ruleHit ? executedRule?.ruleAction : 'ALLOW';
  }
  return undefined;
};

export default function TransactionsTable(props: Props) {
  const [showDetailsView, setShowDetailsView] = useState<boolean>(false);
  const isPulseEnabled = useFeatureEnabled('PULSE');
  const escalationEnabled = useFeatureEnabled('ESCALATION');
  const sarEnabled = useFeatureEnabled('SAR');

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
  } = props;

  const columns: TableColumn<InternalTransaction>[] = useMemo(() => {
    const helper = new ColumnHelper<InternalTransaction>();

    return helper.list([
      helper.simple<'transactionId'>({
        title: 'Transaction ID',
        key: 'transactionId',
        filtering: true,
        type: {
          ...STRING,
          render: (value: string | undefined) => {
            return (
              <div style={{ overflowWrap: 'anywhere' }}>
                <Link
                  to={makeUrl(`/transactions/item/:id`, { id: value })}
                  data-cy="transaction-id"
                >
                  {value}
                  {escalatedTransactions && escalatedTransactions?.indexOf(value as string) > -1 && (
                    <>
                      <br />
                      <Tag color="blue">Escalated</Tag>
                    </>
                  )}
                </Link>
              </div>
            );
          },
        },
      }),
      ...(isPulseEnabled
        ? [
            helper.simple<'arsScore.arsScore'>({
              title: 'TRS score',
              key: 'arsScore.arsScore',
              type: FLOAT,
              sorting: true,
              tooltip: 'Transaction Risk Score',
            }),
            helper.simple<'arsScore.riskLevel'>({
              title: 'TRS level',
              type: RISK_LEVEL,
              key: 'arsScore.riskLevel',
              tooltip: 'Transaction Risk Score level',
            }),
          ]
        : []),
      ...(alert
        ? [
            {
              title: 'Status',
              defaultWidth: 80,
              key: 'executedRules.ruleAction',
              value: (entity) => getStatus(entity.executedRules, alert),
              type: RULE_ACTION,
            } as DerivedColumn<InternalTransaction, RuleAction>,
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
        type: DATE_TIME,
        sorting: true,
        filtering: true,
      }),
      helper.simple<'transactionState'>({
        key: 'transactionState',
        title: 'Last transaction state',
        type: TRANSACTION_STATE,
        filtering: true,
      }),
      helper.simple<'originUserId'>({
        key: 'originUserId',
        title: 'Origin user ID',
        tooltip: 'Origin is the Sender in a transaction',
        type: {
          ...STRING,
          render: (value, { item: entity }) => {
            return <Id to={getUserLink(entity.originUser)}>{value}</Id>;
          },
        },
      }),
      helper.simple<'originUser'>({
        key: 'originUser',
        title: 'Origin user name',
        type: USER_NAME,
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
        },
      }),
      helper.simple<'destinationUser'>({
        title: 'Destination user name',
        key: 'destinationUser',
        type: USER_NAME,
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
      }),
      helper.simple<'tags'>({
        title: 'Tags',
        type: TAGS,
        key: 'tags',
      }),
      helper.simple<'reference'>({
        title: 'Reference',
        type: STRING,
        key: 'reference',
        defaultVisibility: false,
      }),
    ]);
  }, [alert, showDetailsView, isPulseEnabled, escalatedTransactions]);

  const fullExtraFilters: ExtraFilter<TransactionsTableParams>[] = [
    ...(extraFilters ?? []),
    {
      title: 'Origin currencies',
      key: 'originCurrenciesFilter',
      renderer: {
        ...MONEY_CURRENCIES.autoFilterDataType,
        mode: 'MULTIPLE',
      },
    } as ExtraFilter<TransactionsTableParams>,
    {
      title: 'Destination currencies',
      key: 'destinationCurrenciesFilter',
      renderer: {
        ...MONEY_CURRENCIES.autoFilterDataType,
        mode: 'MULTIPLE',
      },
    } as ExtraFilter<TransactionsTableParams>,
    {
      title: 'Origin method',
      key: 'originMethodFilter',
      renderer: PAYMENT_METHOD.autoFilterDataType,
    } as ExtraFilter<TransactionsTableParams>,
    {
      title: 'Destination method',
      key: 'destinationMethodFilter',
      renderer: PAYMENT_METHOD.autoFilterDataType,
    },
  ];

  const settings = useSettings();
  return (
    <QueryResultsTable<InternalTransaction, TransactionsTableParams>
      innerRef={tableRef}
      tableId={'transactions-list'}
      selection={(row) => {
        if (!(escalationEnabled || sarEnabled || settings.isPaymentApprovalEnabled)) {
          return false;
        }

        const alertNotClosed =
          alert?.alertStatus === 'OPEN' ||
          alert?.alertStatus === 'REOPENED' ||
          alert?.alertStatus === 'ESCALATED';
        const notEscalated = !escalatedTransactions?.includes(row.id);
        if ((escalationEnabled || sarEnabled) && alertNotClosed && notEscalated) {
          return true;
        }
        return !!(settings.isPaymentApprovalEnabled && row.original.content.status === 'SUSPEND');
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
      isExpandable={(row) => isTransactionHasDetails(row.content)}
      renderExpanded={(entity) => <ExpandedRowRenderer transaction={entity} />}
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
    />
  );
}
