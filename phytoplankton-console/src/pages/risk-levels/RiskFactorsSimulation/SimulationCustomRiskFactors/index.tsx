import { useCallback, useEffect } from 'react';
import { cloneDeep } from 'lodash';
import RiskFactorsTable from '@/pages/risk-levels/risk-factors/RiskFactorsTable';
import { RiskFactor } from '@/apis';
import { useSimulationRiskFactors } from '@/store/risk-factors';
import { success } from '@/utils/asyncResource';
import {
  DEFAULT_RISK_FACTORS_MAP,
  RiskFactorsTypeMap,
  ScopeSelectorValue,
  scopeToRiskEntityType,
} from '@/pages/risk-levels/risk-factors/RiskFactorsTable/utils';

interface Props {
  simulationRiskFactors?: RiskFactor[];
  canEditRiskFactors: boolean;
  activeIterationIndex: number;
  jobId?: string;
}

export default function SimulationCustomRiskFactorsTable(props: Props) {
  const { canEditRiskFactors = true, activeIterationIndex, simulationRiskFactors, jobId } = props;
  const { simulationRiskFactorsMap, setSimulationRiskFactorsMap } = useSimulationRiskFactors(
    jobId ?? 'new',
    activeIterationIndex,
  );
  useEffect(() => {
    if (
      simulationRiskFactors &&
      simulationRiskFactorsMap.CONSUMER_USER.length === 0 &&
      simulationRiskFactorsMap.BUSINESS.length === 0 &&
      simulationRiskFactorsMap.TRANSACTION.length === 0
    ) {
      const initialRiskFactorsMap: RiskFactorsTypeMap = simulationRiskFactors.reduce(
        (acc, riskFactor) => {
          acc[riskFactor.type].push(riskFactor);
          return acc;
        },
        cloneDeep(DEFAULT_RISK_FACTORS_MAP),
      );
      setSimulationRiskFactorsMap(initialRiskFactorsMap);
    }
  }, [simulationRiskFactors, simulationRiskFactorsMap, setSimulationRiskFactorsMap]);

  const handleSimulationSave = (updatedRiskFactors: RiskFactor[]) => {
    const updatedMap = { ...simulationRiskFactorsMap };
    updatedRiskFactors.forEach((riskFactor) => {
      const entityType = riskFactor.type;
      const existingIndex = updatedMap[entityType].findIndex((rf) => rf.id === riskFactor.id);
      if (existingIndex >= 0) {
        updatedMap[entityType][existingIndex] = riskFactor;
      }
    });

    setSimulationRiskFactorsMap(updatedMap);
  };

  const data = useCallback(
    (selectedSection: ScopeSelectorValue) => {
      return {
        data: success({ items: simulationRiskFactorsMap[scopeToRiskEntityType(selectedSection)] }),
        refetch: () => {},
      };
    },
    [simulationRiskFactorsMap],
  );

  return (
    <RiskFactorsTable
      type="consumer"
      mode="simulation"
      queryResults={data}
      simulationRiskFactors={simulationRiskFactors}
      activeIterationIndex={activeIterationIndex}
      jobId={jobId}
      canEditRiskFactors={canEditRiskFactors}
      handleSimulationSave={handleSimulationSave}
    />
  );
}
