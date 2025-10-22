import { useCallback, useState, useMemo } from 'react';
import { atom } from 'jotai';
import { cloneDeep } from 'lodash';
import { RiskFactor } from '@/apis';
import { useSafeLocalStorageState } from '@/utils/hooks';
import {
  DEFAULT_RISK_FACTORS_MAP,
  RiskFactorsTypeMap,
} from '@/pages/risk-levels/risk-factors/RiskFactorsTable/utils';

export const DEFAULT_SIMULATION_STORAGE_KEY = 'temp-risk-factors';
export const SimulationLocalStorageKey = 'risk-factors-simulation';

export const useSimulationRiskFactors = (
  jobId: string,
  activeIterationIndex: number,
  defaultRiskFactorsMap: RiskFactor[],
) => {
  const localStorageKey = `${SimulationLocalStorageKey}-${jobId ?? 'new'}-${activeIterationIndex}`;
  const initialRiskFactorsMap: RiskFactorsTypeMap = defaultRiskFactorsMap.reduce(
    (acc, riskFactor) => {
      acc[riskFactor.type].push(riskFactor);
      return acc;
    },
    cloneDeep(DEFAULT_RISK_FACTORS_MAP),
  );
  // Setting the value on first render or when key changes
  useMemo(() => {
    if (!window.localStorage.getItem(localStorageKey)) {
      window.localStorage.setItem(localStorageKey, JSON.stringify(initialRiskFactorsMap));
    }
  }, [localStorageKey, initialRiskFactorsMap]);
  const [simulationRiskFactorsMap, setSimulationRiskFactorsMap] =
    useSafeLocalStorageState<RiskFactorsTypeMap>(localStorageKey, initialRiskFactorsMap, true);

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
  const defaultRiskFactorsMap: RiskFactorsTypeMap = useMemo(() => {
    if (riskFactors && riskFactors.length > 0) {
      return riskFactors.reduce((acc, riskFactor) => {
        const existingIndex = acc[riskFactor.type].findIndex((rf) => rf.id === riskFactor.id);
        if (existingIndex === -1) {
          acc[riskFactor.type].push(riskFactor);
        }
        return acc;
      }, cloneDeep(DEFAULT_RISK_FACTORS_MAP));
    }
    return cloneDeep(DEFAULT_RISK_FACTORS_MAP);
  }, [riskFactors]);

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
