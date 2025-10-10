import { isEmpty } from 'lodash';
import { getRiskLevelFromScore, getRiskScoreFromLevel } from '@flagright/lib/utils';
import { TableColumn } from '@/components/library/Table/types';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { AllUsersTableItem, RiskClassificationScore, RiskLevel } from '@/apis';
import { FLOAT, RISK_LEVEL } from '@/components/library/Table/standardDataTypes';

export function getRiskScoringColumns(
  riskClassificationValuesMap: RiskClassificationScore[],
): TableColumn<AllUsersTableItem>[] {
  const helper = new ColumnHelper<AllUsersTableItem>();

  return helper.list([
    helper.derived<RiskLevel>({
      title: 'CRA risk level',
      type: RISK_LEVEL,
      tooltip: 'Customer risk assessment - accounts for both Base risk and action risk scores.',
      value: (entity): RiskLevel | undefined => {
        return !isEmpty(entity.manualRiskLevel)
          ? entity.manualRiskLevel
          : getRiskLevelFromScore(riskClassificationValuesMap, entity.drsScore || null);
      },
    }),
    helper.derived({
      title: 'CRA risk score',
      type: FLOAT,
      tooltip: 'Customer risk assessment - accounts for both Base risk and action risk scores.',
      value: (entity) =>
        !isEmpty(entity.manualRiskLevel) && entity.manualRiskLevel != null
          ? getRiskScoreFromLevel(riskClassificationValuesMap, entity.manualRiskLevel)
          : entity.drsScore,
    }),
    helper.simple<'isRiskLevelLocked'>({
      key: 'isRiskLevelLocked',
      title: 'Is locked',
      type: {
        render: (value) => <>{value ? 'Yes' : 'No'}</>,
      },
      tooltip: 'Whether customer risk assessment score is locked',
    }),
    helper.derived({
      title: 'KRS risk level',
      value: (entity) => {
        const score = entity.krsScore;
        return getRiskLevelFromScore(riskClassificationValuesMap, score || null);
      },
      type: RISK_LEVEL,
      tooltip: 'Know your customer - accounts for KYC Risk Level',
    }),
    helper.simple<'krsScore'>({
      key: 'krsScore',
      title: 'KRS risk score',
      type: FLOAT,
      tooltip: 'Know your customer - accounts for KYC Risk Score',
    }),
  ]);
}
