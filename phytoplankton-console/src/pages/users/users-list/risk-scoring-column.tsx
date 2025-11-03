import { isEmpty } from 'lodash';
import { getRiskLevelFromScore, getRiskScoreFromLevel } from '@flagright/lib/utils';
import { TableColumn } from '@/components/library/Table/types';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { AllUsersTableItem, RiskClassificationScore, RiskLevel, RiskLevelAlias } from '@/apis';
import { RISK_LEVEL, RISK_SCORE } from '@/components/library/Table/standardDataTypes';

export function getRiskScoringColumns(
  riskClassificationValuesMap: RiskClassificationScore[],
  riskLevelAlias: RiskLevelAlias[],
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
          : getRiskLevelFromScore(
              riskClassificationValuesMap,
              entity.drsScore || null,
              riskLevelAlias,
            );
      },
    }),
    helper.derived({
      title: 'CRA risk score',
      type: RISK_SCORE,
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
        return getRiskLevelFromScore(riskClassificationValuesMap, score || null, riskLevelAlias);
      },
      type: RISK_LEVEL,
      tooltip: 'Know your customer - accounts for KYC Risk Level',
    }),
    helper.simple<'krsScore'>({
      key: 'krsScore',
      title: 'KRS risk score',
      type: RISK_SCORE,
      tooltip: 'Know your customer - accounts for KYC Risk Score',
    }),
  ]);
}
