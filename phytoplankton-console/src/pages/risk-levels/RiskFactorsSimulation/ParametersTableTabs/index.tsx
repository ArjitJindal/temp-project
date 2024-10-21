import { useState } from 'react';
import ParametersTable from '../../risk-factors/ParametersTable';
import {
  BUSINESS_RISK_PARAMETERS,
  TRANSACTION_RISK_PARAMETERS,
  USER_RISK_PARAMETERS,
} from '../../risk-factors/ParametersTable/consts';
import { Entity, ParameterName, ParameterValues } from '../../risk-factors/ParametersTable/types';
import { RiskFactorsSettings } from '../SimulationResult';
import PageTabs from '@/components/ui/PageTabs';
import { RiskScoreValueLevel, RiskScoreValueScore } from '@/apis';

interface Props {
  onSaveValues?: (
    parameter: ParameterName,
    newValues: ParameterValues,
    entityType: Entity,
    defaultRiskLevel: RiskScoreValueScore | RiskScoreValueLevel,
    weight: number,
  ) => void;
  onActivate?: (entityType: Entity, parameter: ParameterName, isActive: boolean) => void;
  parameterSettings: RiskFactorsSettings;
  canEditParameters?: boolean;
}
export const ParametersTableTabs = (props: Props) => {
  const { parameterSettings, canEditParameters = true } = props;
  const onSaveValues = props.onSaveValues ?? (() => {});
  const onActivate = props.onActivate ?? (() => {});
  const [type, setType] = useState('consumer');
  return (
    <PageTabs
      activeKey={type}
      onChange={(key) => {
        setType(key);
      }}
      items={[
        {
          key: 'consumer',
          title: 'Consumer',
          children: (
            <ParametersTable
              parameters={USER_RISK_PARAMETERS}
              parameterSettings={parameterSettings['CONSUMER_USER']}
              onRefresh={() => {}}
              onSaveValues={onSaveValues}
              onActivate={onActivate}
              disablePaddings
              canEditParameters={canEditParameters}
            />
          ),
        },
        {
          key: 'business',
          title: 'Business',
          children: (
            <ParametersTable
              parameters={BUSINESS_RISK_PARAMETERS}
              parameterSettings={parameterSettings['BUSINESS']}
              onRefresh={() => {}}
              onSaveValues={onSaveValues}
              onActivate={onActivate}
              canEditParameters={canEditParameters}
              disablePaddings
            />
          ),
        },
        {
          key: 'transaction',
          title: 'Transaction',
          children: (
            <ParametersTable
              parameters={TRANSACTION_RISK_PARAMETERS}
              parameterSettings={parameterSettings['TRANSACTION']}
              onRefresh={() => {}}
              onSaveValues={onSaveValues}
              onActivate={onActivate}
              canEditParameters={canEditParameters}
              disablePaddings
            />
          ),
        },
      ]}
    />
  );
};
