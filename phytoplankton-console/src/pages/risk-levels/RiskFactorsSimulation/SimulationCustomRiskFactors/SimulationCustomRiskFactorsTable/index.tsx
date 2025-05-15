import { useEffect } from 'react';
import RiskFactorsTable, {
  RiskFactorsTypeMap,
  scopeToRiskEntityType,
} from '@/pages/risk-levels/shared/RiskFactorsTable';
import { RiskFactor } from '@/apis';
import { useSafeLocalStorageState } from '@/utils/hooks';

interface Props {
  riskFactors?: RiskFactor[];
  canEditRiskFactors: boolean;
  activeIterationIndex: number;
  jobId?: string;
}

export const LocalStorageKey = 'risk-factors-simulation';

export { RiskFactorsTypeMap, scopeToRiskEntityType };
export type ScopeSelectorValue = 'consumer' | 'business' | 'transaction';

export default function SimulationCustomRiskFactorsTable(props: Props) {
  const { canEditRiskFactors = true, activeIterationIndex, riskFactors, jobId } = props;
  const [simulationRiskFactorsMap, setSimulationRiskFactorsMap] =
    useSafeLocalStorageState<RiskFactorsTypeMap>(
      `${LocalStorageKey}-${jobId ? `${jobId}` : 'new'}-${activeIterationIndex}`,
      {
        CONSUMER_USER: [],
        BUSINESS: [],
        TRANSACTION: [],
      },
    );

  useEffect(() => {
    if (
      riskFactors &&
      simulationRiskFactorsMap.CONSUMER_USER.length === 0 &&
      simulationRiskFactorsMap.BUSINESS.length === 0 &&
      simulationRiskFactorsMap.TRANSACTION.length === 0
    ) {
      const initialRiskFactorsMap: RiskFactorsTypeMap = riskFactors.reduce(
        (acc, riskFactor) => {
          acc[riskFactor.type].push(riskFactor);
          return acc;
        },
        {
          CONSUMER_USER: [],
          BUSINESS: [],
          TRANSACTION: [],
        } as RiskFactorsTypeMap,
      );
      setSimulationRiskFactorsMap(initialRiskFactorsMap);
    }
  }, [riskFactors, simulationRiskFactorsMap, setSimulationRiskFactorsMap]);

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

  return (
    <RiskFactorsTable
      type="consumer"
      isSimulation
      riskFactors={riskFactors}
      simulationStorageKey={`${LocalStorageKey}-${
        jobId ? `${jobId}` : 'new'
      }-${activeIterationIndex}`}
      activeIterationIndex={activeIterationIndex}
      jobId={jobId}
      canEditRiskFactors={canEditRiskFactors}
      handleSimulationSave={handleSimulationSave}
    />
  );
}
