import { InternalTransaction } from '@/apis';
import { TableOptions } from '@/components/DownloadAsPdf/DownloadAsPDF';
import { ReportItem, getTable, getWidgetTable } from '@/components/DownloadAsPdf/report-utils';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';
import { humanizeAuto } from '@/utils/humanize';

const getTransactionWidgetsProps = (transaction: InternalTransaction): ReportItem[] => {
  const riskScore = transaction.riskScoreDetails?.trsScore ?? transaction.arsScore?.arsScore ?? 0;
  const riskLevel =
    transaction.riskScoreDetails?.trsRiskLevel ?? transaction.arsScore?.riskLevel ?? 'LOW';
  const hitDirections =
    transaction.hitRules.flatMap((rule) => rule.ruleHitMeta?.hitDirections ?? []) ?? [];
  const alertCreatedForUserIds = hitDirections.map((hitDirection) => {
    if (hitDirection == 'ORIGIN') return transaction.originUserId;
    return transaction.destinationUserId;
  });

  return [
    {
      title: 'Transaction ID',
      value: transaction.transactionId,
      id: { cellId: 'link' },
    },
    {
      title: 'Transaction risk score (TRS)',
      value: `${humanizeAuto(riskLevel)} (${riskScore})`,
    },
    {
      title: 'Created on',
      value: dayjs(transaction.timestamp).format(DATE_TIME_FORMAT_WITHOUT_SECONDS),
    },
    {
      title: 'Last state',
      value: humanizeAuto(transaction.transactionState ?? '-'),
    },
    {
      title: 'Rule action',
      value: humanizeAuto(transaction.status),
    },
    {
      title: 'Type',
      value: humanizeAuto(transaction.type),
    },
    {
      title: 'Product type',
      value: `${transaction.productType ?? '-'}`,
    },
    {
      title: 'Reference',
      value: `${transaction.reference ?? '-'}`,
    },
    {
      title: 'Alert created for User ID',
      value: `${alertCreatedForUserIds.join(', ')}`,
      id: { cellId: 'link' },
    },
  ];
};

const getTransactionWidgetTable = (data: InternalTransaction): TableOptions => {
  const props = getTransactionWidgetsProps(data);
  return getWidgetTable(props);
};

const getTransactionSupportTables = (
  transaction: InternalTransaction,
  ruleAlertMap,
): TableOptions => {
  const head = ['Rule ID', 'Rule name', 'Is rule hit?', 'Alert ID', 'Case ID'];
  const rows = transaction.executedRules.map((rule) => {
    const ruleAlert = ruleAlertMap.get(rule.ruleInstanceId);
    return [
      `${rule.ruleId ?? ''} (${rule.ruleInstanceId})`,
      rule.ruleName,
      rule.ruleHit ? 'Yes' : 'No',
      ruleAlert?.alertId ?? '-',
      ruleAlert?.caseId ?? '-',
    ];
  });
  return getTable(head, rows, 'Transaction checks');
};

export const getTransactionReportTables = (
  transaction: InternalTransaction,
  ruleAlertMap,
): TableOptions[] => {
  return [
    getTransactionWidgetTable(transaction),
    getTransactionSupportTables(transaction, ruleAlertMap),
  ];
};
