import React, { useState } from 'react';
import * as Card from '@/components/ui/Card';
import { CommonParams, DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import { Case, CaseTransaction } from '@/apis';
import { transactionType } from '@/utils/tags';
import { TransactionTypeTag } from '@/components/ui/TransactionTypeTag';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import UserLink from '@/components/UserLink';
import { getUserName } from '@/utils/api/users';
import CountryDisplay from '@/components/ui/CountryDisplay';
import Id from '@/components/ui/Id';
import { makeUrl } from '@/utils/routing';
import { useQuery } from '@/utils/queries/hooks';
import { CASES_RULE_TRANSACTIONS } from '@/utils/queries/keys';
import { useApi } from '@/api';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import TransactionEventsTable from '@/pages/transactions-item/TransactionEventsTable';
import { useApiTime } from '@/utils/tracker';
import DetailsViewButton from '@/pages/transactions/components/DetailsViewButton';
import { PaymentDetailsCard } from '@/components/ui/PaymentDetailsCard';
import { PaymentMethodTag } from '@/components/ui/PaymentTypeTag';
import { useFeaturesEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import RiskLevelTag from '@/components/ui/RiskLevelTag';

export function expandedRowRender(item: RuleHitTransactionItem) {
  const preparedEvents =
    item.caseTransactions.events?.map((eve) => {
      return {
        ...eve,
        _id: eve.transactionId,
      };
    }) ?? [];
  return (
    <div>
      <TransactionEventsTable events={preparedEvents} />
    </div>
  );
}

interface Props {
  caseItem: Case;
  rulesInstanceId: any;
}

type RuleHitTransactionItem = {
  _id: string;
  caseTransactions: CaseTransaction;
};

export default function RulesHitTransactionTable(props: Props) {
  const { caseItem, rulesInstanceId } = props;
  const isPulseEnabled = useFeaturesEnabled(['PULSE', 'PULSE_ARS_CALCULATION']);
  const api = useApi();
  const caseId = caseItem.caseId as string;

  const [params, setParams] = useState<CommonParams>(DEFAULT_PARAMS_STATE);
  const [showDetailsView, setShowDetailsView] = useState<boolean>(false);
  const measure = useApiTime();

  const caseTransationsForRuleQueryResult = useQuery(
    CASES_RULE_TRANSACTIONS(caseId, params, rulesInstanceId),
    async () => {
      const { page, pageSize } = params;
      const response =
        caseId &&
        rulesInstanceId &&
        (await measure(
          () =>
            api.getCaseTransactionsForRule({
              caseId,
              rulesInstanceId,
              page,
              pageSize,
            }),
          'Get Case Transactions for Rule',
        ));
      return {
        total: response ? response[0] : 0,
        items: response ? response[1] : [],
      };
    },
  );

  return (
    <Card.Section>
      <>
        <QueryResultsTable<RuleHitTransactionItem, CommonParams>
          disableInternalPadding={true}
          rowKey={((entity: any) => entity.caseTransactions.transactionId) as unknown as string}
          options={{
            reload: false,
            setting: false,
            density: false,
          }}
          search={false}
          scroll={{ x: 2300 }}
          columns={[
            {
              title: 'Transaction ID',
              exportData: 'caseTransactions.transactionId',
              width: 100,
              ellipsis: true,
              onCell: (_) => ({
                rowSpan: _.isFirstRow ? _.rowsCount : 0,
              }),
              render: (_, entity) => {
                return (
                  <Id
                    to={makeUrl(`/transactions/item/:id`, {
                      id: entity.caseTransactions.transactionId,
                    })}
                  >
                    {entity.caseTransactions.transactionId}
                  </Id>
                );
              },
            },
            isPulseEnabled
              ? {
                  title: 'TRS level',
                  width: 130,
                  ellipsis: true,
                  dataIndex: 'caseTransactions.arsScore.arsScore',
                  exportData: 'caseTransactions.arsScore.arsScore',
                  hideInSearch: true,
                  sorter: true,
                  render: (_, entity) => {
                    return <RiskLevelTag level={entity?.caseTransactions?.arsScore?.riskLevel} />;
                  },
                  tooltip: 'Transaction Risk Score level',
                }
              : {},
            {
              title: 'Transaction Type',
              dataIndex: 'caseTransactions.type',
              exportData: 'caseTransactions.type',
              width: 100,
              valueType: 'select',
              ellipsis: true,
              onCell: (_) => ({
                rowSpan: _.isFirstRow ? _.rowsCount : 0,
              }),
              fieldProps: {
                options: transactionType,
                allowClear: true,
              },
              render: (dom, entity) => {
                return <TransactionTypeTag transactionType={entity.caseTransactions.type} />;
              },
            },
            {
              title: 'Timestamp',
              width: 130,
              ellipsis: true,
              onCell: (_) => ({
                rowSpan: _.isFirstRow ? _.rowsCount : 0,
              }),
              dataIndex: 'caseTransactions.timestamp',
              exportData: (entity) =>
                dayjs(entity.caseTransactions.timestamp).format(DEFAULT_DATE_TIME_FORMAT),
              valueType: 'dateTimeRange',
              render: (_, entity) => {
                return <TimestampDisplay timestamp={entity?.caseTransactions.timestamp} />;
              },
            },
            {
              title: 'Origin',
              hideInSearch: true,
              dataIndex: 'caseTransactions.originUserId',
              children: [
                {
                  title: 'Origin User ID',
                  tooltip: 'Origin is the Sender in a transaction',
                  width: 200,
                  copyable: true,
                  ellipsis: true,
                  dataIndex: 'caseTransactions.originUserId',
                  exportData: 'caseTransactions.originUserId',
                  hideInSearch: true,
                  render: (dom, entity) => {
                    if (entity == null) {
                      return <></>;
                    }
                    if (!entity.caseTransactions.originUser)
                      return entity.caseTransactions.originUserId;
                    return (
                      <UserLink user={entity.caseTransactions.originUser}>
                        {String(entity.caseTransactions.originUserId)}
                      </UserLink>
                    );
                  },
                },
                {
                  title: 'Origin User Name',
                  tooltip: 'Origin is the Sender in a transaction',
                  exportData: (entity) => getUserName(entity.caseTransactions.originUser),
                  width: 220,
                  hideInSearch: true,
                  render: (dom, entity) => {
                    return getUserName(entity.caseTransactions.originUser);
                  },
                },
                {
                  title: showDetailsView ? 'Payment Details' : 'Payment Method',
                  width: showDetailsView ? 600 : 160,
                  exportData: 'caseTransactions.originPaymentDetails.method',
                  hideInSearch: true,
                  render: (dom, entity) => {
                    if (showDetailsView) {
                      return (
                        <PaymentDetailsCard
                          paymentDetails={entity.caseTransactions.originPaymentDetails}
                        />
                      );
                    }
                    return (
                      <PaymentMethodTag
                        paymentMethod={entity.caseTransactions.originPaymentDetails?.method}
                      />
                    );
                  },
                },
                {
                  title: 'Origin Amount',
                  exportData: 'caseTransactions.originAmountDetails.transactionAmount',
                  hideInSearch: true,
                  width: 150,
                  render: (dom, entity) => {
                    if (
                      entity.caseTransactions.originAmountDetails?.transactionAmount !== undefined
                    ) {
                      return new Intl.NumberFormat().format(
                        entity.caseTransactions.originAmountDetails?.transactionAmount,
                      );
                    } else {
                      return entity.caseTransactions.originAmountDetails?.transactionAmount;
                    }
                  },
                },
                {
                  title: 'Origin Currency',
                  exportData: 'caseTransactions.originAmountDetails.transactionCurrency',
                  hideInSearch: true,
                  width: 140,
                  render: (dom, entity) => {
                    return entity.caseTransactions.originAmountDetails?.transactionCurrency;
                  },
                },
                {
                  title: 'Origin Country',
                  exportData: 'caseTransactions.originAmountDetails.country',
                  hideInSearch: true,
                  width: 140,
                  render: (dom, entity) => {
                    return (
                      <CountryDisplay
                        isoCode={entity.caseTransactions.originAmountDetails?.country}
                      />
                    );
                  },
                },
              ],
            },
            {
              title: 'Destination',
              hideInSearch: true,
              children: [
                {
                  title: 'Destination User ID',
                  tooltip: 'Destination is the Receiver in a transaction',
                  dataIndex: 'destinationUserId',
                  exportData: 'caseTransactions.destinationUserId',
                  copyable: true,
                  ellipsis: true,
                  hideInSearch: true,
                  width: 170,
                  render: (dom, entity) => {
                    if (!entity.caseTransactions.destinationUser) {
                      return entity.caseTransactions.destinationUserId;
                    }
                    return (
                      <UserLink user={entity.caseTransactions.destinationUser}>
                        {String(entity.caseTransactions.destinationUserId)}
                      </UserLink>
                    );
                  },
                },
                {
                  title: 'Destination User Name',
                  tooltip: 'Destination is the Receiver in a transaction',
                  width: 180,
                  hideInSearch: true,
                  exportData: (entity) => getUserName(entity.caseTransactions.destinationUser),
                  render: (dom, entity) => {
                    return getUserName(entity.caseTransactions.destinationUser);
                  },
                },
                {
                  title: showDetailsView ? 'Payment Details' : 'Payment Method',
                  exportData: 'caseTransactions.destinationPaymentDetails.method',
                  width: showDetailsView ? 600 : 160,
                  hideInSearch: true,
                  render: (dom, entity) => {
                    if (showDetailsView) {
                      return (
                        <PaymentDetailsCard
                          paymentDetails={entity.caseTransactions.destinationPaymentDetails}
                        />
                      );
                    }
                    return (
                      <PaymentMethodTag
                        paymentMethod={entity.caseTransactions.destinationPaymentDetails?.method}
                      />
                    );
                  },
                },
                {
                  title: 'Destination Amount',
                  width: 200,
                  dataIndex: 'destnationAmountDetails.transactionAmount',
                  exportData: 'caseTransactions.destinationAmountDetails.transactionAmount',
                  hideInSearch: true,
                  render: (dom, entity) => {
                    if (
                      entity.caseTransactions.destinationAmountDetails?.transactionAmount !==
                      undefined
                    ) {
                      return new Intl.NumberFormat().format(
                        entity.caseTransactions.destinationAmountDetails?.transactionAmount,
                      );
                    } else {
                      return entity.caseTransactions.destinationAmountDetails?.transactionAmount;
                    }
                  },
                },
                {
                  title: 'Destination Currency',
                  exportData: 'caseTransactions.destinationAmountDetails.transactionCurrency',
                  width: 200,
                  hideInSearch: true,
                  render: (dom, entity) => {
                    return entity.caseTransactions.destinationAmountDetails?.transactionCurrency;
                  },
                },
                {
                  title: 'Destination Country',
                  exportData: 'caseTransactions.destinationAmountDetails.country',
                  width: 200,
                  hideInSearch: true,
                  render: (dom, entity) => {
                    return (
                      <CountryDisplay
                        isoCode={entity.caseTransactions.destinationAmountDetails?.country}
                      />
                    );
                  },
                },
              ],
            },
          ]}
          queryResults={caseTransationsForRuleQueryResult}
          controlsHeader={[
            () => {
              return (
                <>
                  <DetailsViewButton
                    onConfirm={(value) => {
                      setShowDetailsView(value);
                    }}
                  />
                </>
              );
            },
          ]}
          params={params}
          onChangeParams={setParams}
          expandable={{ expandedRowRender }}
        />
      </>
    </Card.Section>
  );
}
