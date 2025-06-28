import { useParams } from 'react-router';
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import RiskFactorsTable from '../shared/RiskFactorsTable';
import { SimulationHistory } from '../RiskFactorsSimulation/SimulationHistoryPage/SimulationHistory';
import { RiskFactorsSimulation } from '../RiskFactorsSimulation';
import { useRiskFactors } from './utils';
import { useApi } from '@/api';
import { RISK_FACTORS_V8 } from '@/utils/queries/keys';
import { useHasResources } from '@/utils/user-utils';
import { message } from '@/components/library/Message';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { map } from '@/utils/queries/types';
import { RiskLevel, RiskParameterLevelKeyValue } from '@/apis';

interface Props {
  type: string;
}

export default function ({ isSimulationMode }: { isSimulationMode: boolean }) {
  const { type = isSimulationMode ? 'simulation' : 'consumer' } = useParams();
  return <CustomRiskFactors type={type} />;
}

export const CustomRiskFactors = (props: Props) => {
  const { type } = props;
  const api = useApi();
  const queryResult = useRiskFactors(type as 'consumer' | 'business' | 'transaction');
  const canWriteRiskFactors = useHasResources(['write:::risk-scoring/risk-factors/*']);
  const queryClient = useQueryClient();

  const handleSaveParameters = useCallback(
    async ({
      values,
      defaultRiskLevel,
      defaultWeight,
      defaultRiskScore,
      riskFactorId,
    }: {
      values: RiskParameterLevelKeyValue[];
      defaultRiskLevel: RiskLevel;
      defaultWeight: number;
      defaultRiskScore: number;
      riskFactorId: string;
    }) => {
      const hideSavingMessage = message.loading('Saving parameters...');
      try {
        await api.putRiskFactors({
          riskFactorId: riskFactorId,
          RiskFactorsUpdateRequest: {
            defaultWeight,
            defaultRiskScore,
            defaultRiskLevel,
            riskLevelAssignmentValues: values,
          },
        });
        await queryClient.invalidateQueries(RISK_FACTORS_V8(type));
        message.success('Risk factor parameters updated successfully');
      } catch (error) {
        message.fatal('Failed to update risk factor parameters', error);
      } finally {
        hideSavingMessage();
      }
    },
    [api, queryClient, type],
  );

  if (type === 'simulation') {
    return (
      <AsyncResourceRenderer resource={queryResult.data}>
        {(data) => <RiskFactorsSimulation riskFactors={data} parameterValues={{}} />}
      </AsyncResourceRenderer>
    );
  } else if (type === 'simulation-history') {
    return <SimulationHistory />;
  }

  return (
    <RiskFactorsTable
      type={type}
      queryResults={map(queryResult, (data) => ({
        items: data,
      }))}
      handleSaveParameters={handleSaveParameters}
      canEditRiskFactors={canWriteRiskFactors}
    />
  );
};
