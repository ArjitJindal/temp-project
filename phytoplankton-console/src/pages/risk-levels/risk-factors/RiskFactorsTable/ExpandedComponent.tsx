import { useMemo } from 'react';
import { useAtom } from 'jotai';
import ValuesTable from '../../risk-factors/RiskFactorConfiguration/RiskFactorConfigurationForm/RiskFactorConfigurationStep/ParametersTable/ValuesTable';
import { ScopeSelectorValue, scopeToRiskEntityType } from './utils';
import s from './styles.module.less';
import { riskFactorsAtom, useTempRiskFactors } from '@/store/risk-factors';
import { message } from '@/components/library/Message';
import { RiskFactor } from '@/apis';
import { useHasResources } from '@/utils/user-utils';

type Props = {
  riskFactor: RiskFactor;
  mode: 'simulation' | 'normal' | 'version-history';
  jobId?: string;
  activeIterationIndex: number;
  handleSimulationSave?: (riskFactors: RiskFactor[]) => void;
  selectedSection: ScopeSelectorValue;
  simulationRiskFactors?: RiskFactor[];
  canEditRiskFactors?: boolean;
};

export const ExpandedComponent = (props: Props) => {
  const {
    riskFactor,
    mode,
    jobId,
    activeIterationIndex,
    handleSimulationSave,
    selectedSection,
    simulationRiskFactors,
    canEditRiskFactors,
  } = props;
  const isSimulation = mode === 'simulation';
  const [riskFactors, setRiskFactors] = useAtom(riskFactorsAtom);
  const updatedRiskFactor = useMemo(() => {
    return riskFactors.getById(riskFactor.id);
  }, [riskFactors, riskFactor]);

  const canWriteRiskFactors =
    useHasResources(['write:::risk-scoring/risk-factors/*']) && canEditRiskFactors !== false;

  const { simulationRiskFactorsMap, setSimulationRiskFactorsMap } = useTempRiskFactors({
    riskFactors: simulationRiskFactors || [],
    simulationStorageKey: `${jobId ?? 'new'}-${activeIterationIndex}`,
    isSimulation: true,
  });

  if (isSimulation) {
    return (
      <div className={s.expandedRow}>
        <ValuesTable
          entity={riskFactor}
          onSave={(updatedEntity) => {
            const updatedRiskFactors = simulationRiskFactorsMap[
              scopeToRiskEntityType(selectedSection)
            ].map((rf) => {
              if (rf.id === riskFactor.id) {
                return updatedEntity;
              }
              return rf;
            });
            setSimulationRiskFactorsMap({
              ...simulationRiskFactorsMap,
              [scopeToRiskEntityType(selectedSection)]: updatedRiskFactors,
            });
            if (handleSimulationSave) {
              handleSimulationSave(updatedRiskFactors);
            }
            message.success('Risk factor parameters updated successfully');
          }}
          canEditParameters={canWriteRiskFactors}
        />
      </div>
    );
  } else {
    return (
      <div className={s.expandedRow}>
        <ValuesTable
          entity={updatedRiskFactor || riskFactor}
          onSave={(updatedEntity) => {
            setRiskFactors(updatedEntity);
          }}
          canEditParameters={canWriteRiskFactors}
        />
      </div>
    );
  }
};
