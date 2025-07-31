import { useCallback, useState } from 'react';
import { atom } from 'jotai';
import { clone } from 'lodash';
import { RiskFactor } from '@/apis';
import { useSafeLocalStorageState } from '@/utils/hooks';
import {
  DEFAULT_RISK_FACTORS_MAP,
  RiskFactorsTypeMap,
} from '@/pages/risk-levels/risk-factors/RiskFactorsTable/utils';

export const DEFAULT_SIMULATION_STORAGE_KEY = 'temp-risk-factors';
export const SimulationLocalStorageKey = 'risk-factors-simulation';

export const useSimulationRiskFactors = (jobId: string, activeIterationIndex: number) => {
  const [simulationRiskFactorsMap, setSimulationRiskFactorsMap] =
    useSafeLocalStorageState<RiskFactorsTypeMap>(
      `${SimulationLocalStorageKey}-${jobId ?? 'new'}-${activeIterationIndex}`,
      clone(DEFAULT_RISK_FACTORS_MAP),
    );

  return {
    simulationRiskFactorsMap,
    setSimulationRiskFactorsMap,
  };
};

type TempRiskFactorsParams = {
  riskFactors: RiskFactor[];
  simulationStorageKey: string;
  isSimulation: boolean;
};

export const useTempRiskFactors = (params: TempRiskFactorsParams) => {
  const { riskFactors, simulationStorageKey, isSimulation } = params;
  const defaultRiskFactorsMap: RiskFactorsTypeMap = riskFactors
    ? riskFactors.reduce((acc, riskFactor) => {
        acc[riskFactor.type].push(riskFactor);
        return acc;
      }, clone(DEFAULT_RISK_FACTORS_MAP))
    : clone(DEFAULT_RISK_FACTORS_MAP);

  const [localStorageRiskFactors, setLocalStorageRiskFactors] =
    useSafeLocalStorageState<RiskFactorsTypeMap>(
      simulationStorageKey
        ? `${SimulationLocalStorageKey}-${simulationStorageKey}`
        : 'temp-risk-factors',
      defaultRiskFactorsMap,
    );

  const [memoryRiskFactors, setMemoryRiskFactors] =
    useState<RiskFactorsTypeMap>(defaultRiskFactorsMap);

  const simulationRiskFactorsMap =
    isSimulation && simulationStorageKey ? localStorageRiskFactors : memoryRiskFactors;

  const setSimulationRiskFactorsMap = useCallback(
    (value: RiskFactorsTypeMap | ((prev: RiskFactorsTypeMap) => RiskFactorsTypeMap)) => {
      if (isSimulation && simulationStorageKey) {
        setLocalStorageRiskFactors(value as any);
      } else {
        setMemoryRiskFactors(value);
      }
    },
    [isSimulation, simulationStorageKey, setLocalStorageRiskFactors, setMemoryRiskFactors],
  );

  return {
    simulationRiskFactorsMap,
    setSimulationRiskFactorsMap,
  };
};

export const riskFactorsEditEnabled = atom<boolean>(false);

export const riskFactorsStore = atom<Map<string, RiskFactor>>(new Map());

// Enhanced risk factors atom with utility methods
export const riskFactorsAtom = atom(
  (get) => {
    const map = get(riskFactorsStore);
    return {
      map,
      getById: (id: string) => map.get(id),
      getAll: () => Array.from(map.values()),
      getCount: () => map.size,
    };
  },
  (get, set, updatedRiskFactor: RiskFactor) => {
    const currentMap = get(riskFactorsStore);
    currentMap.set(updatedRiskFactor.id, updatedRiskFactor);
    set(riskFactorsStore, new Map(currentMap));
  },
);
