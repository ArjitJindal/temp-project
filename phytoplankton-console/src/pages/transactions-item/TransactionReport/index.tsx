import { getRiskLevelFromScore } from '@flagright/lib/utils';
import { DEFAULT_RISK_LEVEL } from '@flagright/lib/utils/risk';
import { round } from 'lodash';
import { firstLetterUpper, humanizeAuto } from '@flagright/lib/utils/humanize';
import { RuleAlertMap } from '..';
import { InternalTransaction, RiskClassificationScore, TenantSettings } from '@/apis';
import { getRiskLevelLabel } from '@/components/AppWrapper/Providers/SettingsProvider';
import { TableOptions } from '@/components/DownloadAsPdf/DownloadAsPDF';
import { ReportItem, getTable, getWidgetTable } from '@/components/DownloadAsPdf/report-utils';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';

const getTransactionWidgetsProps = (
  transaction: InternalTransaction,
  tenantSettings: TenantSettings,
  riskClassificationValues: RiskClassificationScore[],
): ReportItem[] => {
  const riskScore = transaction.riskScoreDetails?.trsScore ?? transaction.arsScore?.arsScore ?? 0;
  const riskLevel =
    transaction.riskScoreDetails?.trsRiskLevel ??
    getRiskLevelFromScore(riskClassificationValues, riskScore) ??
    DEFAULT_RISK_LEVEL;

  const hitDirections =
    transaction.hitRules.flatMap((rule) => rule.ruleHitMeta?.hitDirections ?? []) ?? [];
  const alertCreatedForUserIds = hitDirections.map((hitDirection) => {
    if (hitDirection == 'ORIGIN') {
      return transaction.originUserId;
    }
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
      value: `${getRiskLevelLabel(riskLevel, tenantSettings).riskLevelLabel} (${round(
        riskScore,
        2,
      )})`,
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
      title: `Alert created for ${firstLetterUpper(tenantSettings.userAlias)} ID`,
      value: `${alertCreatedForUserIds.join(', ')}`,
      id: { cellId: 'link' },
    },
  ];
};

const getTransactionWidgetTable = (
  data: InternalTransaction,
  tenantSettings: TenantSettings,
  riskClassificationValues: RiskClassificationScore[],
): TableOptions => {
  const props = getTransactionWidgetsProps(data, tenantSettings, riskClassificationValues);
  return getWidgetTable(props);
};

const getTransactionSupportTables = (
  transaction: InternalTransaction,
  ruleAlertMap: RuleAlertMap,
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
  ruleAlertMap: RuleAlertMap,
  tenantSettings: TenantSettings,
  riskClassificationValues: RiskClassificationScore[],
): TableOptions[] => {
  return [
    getTransactionWidgetTable(transaction, tenantSettings, riskClassificationValues),
    getTransactionSupportTables(transaction, ruleAlertMap),
  ];
};
