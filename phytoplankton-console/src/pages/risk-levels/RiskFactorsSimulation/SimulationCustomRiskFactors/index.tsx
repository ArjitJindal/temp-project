import { useCallback } from 'react';
import { cloneDeep } from 'lodash';
import RiskFactorsTable from '@/pages/risk-levels/risk-factors/RiskFactorsTable';
import { RiskFactor } from '@/apis';
import { SimulationLocalStorageKey, useSimulationRiskFactors } from '@/store/risk-factors';
import { success } from '@/utils/asyncResource';
import {
  ScopeSelectorValue,
  scopeToRiskEntityType,
  RiskFactorsTypeMap,
  DEFAULT_RISK_FACTORS_MAP,
} from '@/pages/risk-levels/risk-factors/RiskFactorsTable/utils';

interface Props {
  simulationRiskFactors?: RiskFactor[];
  canEditRiskFactors: boolean;
  activeIterationIndex: number;
  jobId?: string;
}

// Type guard to check if parsed value is RiskFactorsTypeMap
function isRiskFactorsTypeMap(value: unknown): value is RiskFactorsTypeMap {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const obj = value as Record<string, unknown>;

  const requiredKeys = Object.keys(DEFAULT_RISK_FACTORS_MAP);
  const hasAllKeys = requiredKeys.every((key) => key in obj);

  if (!hasAllKeys) {
    return false;
  }

  // Check if each key contains an array of RiskFactors
  return requiredKeys.every((key) => {
    const val = obj[key];
    return (
      Array.isArray(val) &&
      val.every(
        (item) =>
          item &&
          typeof item === 'object' &&
          'id' in item &&
          'type' in item &&
          typeof item.id === 'string',
      )
    );
  });
}

export default function SimulationCustomRiskFactorsTable(props: Props) {
  const { canEditRiskFactors = true, activeIterationIndex, simulationRiskFactors, jobId } = props;

  // we need to deduce a logic to which gives us default value for risk factor
  const defaultValueLocalStorageKey = jobId
    ? `${SimulationLocalStorageKey}-new-${activeIterationIndex}`
    : undefined;

  let defaultRiskFactorDefaultValue = simulationRiskFactors;

  if (defaultValueLocalStorageKey) {
    const localStorageValue = window.localStorage.getItem(defaultValueLocalStorageKey);
    if (localStorageValue) {
      try {
        const parsedValue = JSON.parse(localStorageValue);

        if (isRiskFactorsTypeMap(parsedValue)) {
          // Convert RiskFactorsTypeMap to RiskFactor[]
          defaultRiskFactorDefaultValue = [
            ...parsedValue.CONSUMER_USER,
            ...parsedValue.BUSINESS,
            ...parsedValue.TRANSACTION,
          ];
        } else {
          console.warn('Parsed value from localStorage is not a valid RiskFactorsTypeMap');
        }
      } catch (e) {
        console.warn('Failed to parse risk factors from localstorage', e);
      }
    }
  }
  const { simulationRiskFactorsMap, setSimulationRiskFactorsMap } = useSimulationRiskFactors(
    jobId ?? 'new',
    activeIterationIndex,
    defaultRiskFactorDefaultValue ?? [],
  );

  const handleSimulationSave = (updatedRiskFactors: RiskFactor[]) => {
    const updatedMap = cloneDeep(simulationRiskFactorsMap);
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
