import { useEffect, useMemo, useState } from 'react';
import { useAtom } from 'jotai';
import { pickBy } from 'lodash';
import ValuesTable from '../../risk-factors/RiskFactorConfiguration/RiskFactorConfigurationForm/RiskFactorConfigurationStep/ParametersTable/ValuesTable';
import { ScopeSelectorValue, scopeToRiskEntityType } from './utils';
import s from './styles.module.less';
import { riskFactorsAtom, useTempRiskFactors } from '@/store/risk-factors';
import { message } from '@/components/library/Message';
import { RiskFactor } from '@/apis';
import { useHasResources } from '@/utils/user-utils';
import { RiskFactorRow } from '@/pages/risk-levels/risk-factors/RiskFactorsTable/types';
import ApprovalHeader from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/ApprovalHeader';
import SpecialAttributesChanges from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/SpecialAttributesChanges';

type BaseProps = {
  riskFactor: RiskFactorRow;
  mode: 'simulation' | 'normal' | 'version-history';
  jobId?: string;
  handleSimulationSave?: (riskFactors: RiskFactor[]) => void;
  selectedSection: ScopeSelectorValue;
  simulationRiskFactors?: RiskFactor[];
  canEditRiskFactors?: boolean;
  isEditable: boolean;
  setEditableRiskFactor: (riskFactor: RiskFactor | null) => void;
};

type SimulationModeProps = BaseProps & {
  activeIterationIndex: number;
};

type NormalModeProps = BaseProps & {
  activeIterationIndex?: number;
};

type VersionHistoryModeProps = BaseProps & {
  activeIterationIndex?: number;
};

type Props = SimulationModeProps | NormalModeProps | VersionHistoryModeProps;

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
    isEditable,
    setEditableRiskFactor,
  } = props;
  const isSimulation = mode === 'simulation';
  const [riskFactors, setRiskFactors] = useAtom(riskFactorsAtom);
  const updatedRiskFactor = useMemo(() => {
    return riskFactors.getById(riskFactor.id);
  }, [riskFactors, riskFactor]);

  const canWriteRiskFactors =
    useHasResources(['write:::risk-scoring/risk-factors/*']) &&
    canEditRiskFactors !== false &&
    isEditable;

  const { simulationRiskFactorsMap, setSimulationRiskFactorsMap } = useTempRiskFactors({
    riskFactors: simulationRiskFactors || [],
    simulationStorageKey: `${jobId ?? 'new'}-${activeIterationIndex}`,
    isSimulation: true,
  });

  const [showPendingProposalFlag, setShowPendingProposalFlag] = useState(true);

  useEffect(() => {
    return () => {
      setEditableRiskFactor(null);
    };
  }, [setEditableRiskFactor]);

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
        {riskFactor.proposal && (
          <div className={s.approvalHeader}>
            <ApprovalHeader
              riskFactorId={riskFactor.id}
              showProposalState={[showPendingProposalFlag, setShowPendingProposalFlag]}
              pendingProposal={riskFactor.proposal}
              onProposalActionSuccess={() => {}}
            />
            <SpecialAttributesChanges pendingProposal={riskFactor.proposal} riskItem={riskFactor} />
          </div>
        )}
        <ValuesTable
          entity={
            updatedRiskFactor || {
              ...riskFactor,
              ...(showPendingProposalFlag && riskFactor.proposal?.riskFactor
                ? pickBy(riskFactor.proposal.riskFactor, (v) => v != null)
                : {}),
            }
          }
          onSave={(updatedEntity) => {
            setRiskFactors(updatedEntity);
          }}
          canEditParameters={canWriteRiskFactors && !riskFactor.proposal}
        />
      </div>
    );
  }
};
