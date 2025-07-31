import { useCallback } from 'react';
import { capitalizeNameFromEmail } from '@flagright/lib/utils/humanize';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useRiskFactors } from '../../utils';
import { RiskFactorsMode, ScopeSelectorValue, scopeToRiskEntityType } from '../utils';
import { useTempRiskFactors } from '@/store/risk-factors';
import { RiskFactor } from '@/apis';
import { message } from '@/components/library/Message';
import { makeUrl } from '@/utils/routing';
import { useApi } from '@/api';
import { useAuth0User } from '@/utils/user-utils';
import { RISK_FACTORS_V8 } from '@/utils/queries/keys';
import { getOr } from '@/utils/asyncResource';

export function useOnMenuClick(
  handleEditRiskFactor: (riskFactor: RiskFactor) => void,
  mode: RiskFactorsMode,
  selectedSection: ScopeSelectorValue,
  jobId: string,
  activeIterationIndex: number,
  handleSimulationSave: (riskFactors: RiskFactor[]) => void,
) {
  const isSimulation = mode === 'simulation';
  const riskFactors = useRiskFactors();
  const { simulationRiskFactorsMap, setSimulationRiskFactorsMap } = useTempRiskFactors({
    riskFactors: getOr(riskFactors.data, []),
    simulationStorageKey: `${jobId ?? 'new'}-${activeIterationIndex}`,
    isSimulation: true,
  });
  const api = useApi();
  const queryClient = useQueryClient();
  const user = useAuth0User();
  const navigate = useNavigate();

  const onActionsMenuClick = useCallback(
    (action: string, entity: RiskFactor) => {
      if (action === 'edit') {
        handleEditRiskFactor(entity);
      } else if (action === 'duplicate') {
        if (entity.parameter) {
          if (isSimulation) {
            const updatedRiskFactors = simulationRiskFactorsMap[
              scopeToRiskEntityType(selectedSection)
            ].map((rf) => rf);

            const newRiskFactor = {
              ...entity,
              id: `${entity.id} (Copy)`,
              name: `${entity.name} (Copy)`,
            };

            updatedRiskFactors.push(newRiskFactor);

            setSimulationRiskFactorsMap({
              ...simulationRiskFactorsMap,
              [scopeToRiskEntityType(selectedSection)]: updatedRiskFactors,
            });

            if (handleSimulationSave) {
              handleSimulationSave(updatedRiskFactors);
            }

            message.success('Risk factor duplicated successfully', {
              link: makeUrl(`/risk-levels/risk-factors/simulation-mode/:key/:type/:id/read`, {
                key: `${jobId ? jobId : 'new'}-${activeIterationIndex}`,
                type: selectedSection,
                id: newRiskFactor.id,
              }),
              linkTitle: 'View risk factor',
              copyFeedback: 'Risk factor URL copied to clipboard',
              details: `${capitalizeNameFromEmail(user?.name || '')} duplicated a risk factor ${
                newRiskFactor.id
              }`,
            });
          } else {
            const duplicateParameterRiskFactor = async () => {
              try {
                const hideSavingMessage = message.loading('Duplicating risk factor...');
                const newRiskFactor = await api.postCreateRiskFactor({
                  RiskFactorsPostRequest: {
                    parameter: entity.parameter as any,
                    type: entity.type,
                    status: 'ACTIVE',
                    name: `${entity.name} (Copy)`,
                    description: entity.description || '',
                    baseCurrency: entity.baseCurrency,
                    riskLevelAssignmentValues: entity.riskLevelAssignmentValues || [],
                    defaultRiskLevel: entity.defaultRiskLevel || 'LOW',
                    defaultWeight: entity.defaultWeight || 1,
                    defaultRiskScore: entity.defaultRiskScore || 0,
                    logicAggregationVariables: [],
                    logicEntityVariables: [],
                    riskLevelLogic: [],
                    isDerived: entity.isDerived || false,
                    riskFactorId: entity.id,
                  },
                });

                await queryClient.invalidateQueries(RISK_FACTORS_V8(selectedSection));

                hideSavingMessage();
                message.success('Risk factor duplicated successfully', {
                  link: makeUrl(`/risk-levels/risk-factors/:type/:id/read`, {
                    type: selectedSection,
                    id: newRiskFactor.id,
                  }),
                  linkTitle: 'View risk factor',
                  details: `${capitalizeNameFromEmail(user?.name || '')} duplicated a risk factor ${
                    newRiskFactor.id
                  }`,
                  copyFeedback: 'Risk factor URL copied to clipboard',
                });
              } catch (err) {
                message.fatal(`Unable to duplicate the risk factor`, err);
              }
            };

            duplicateParameterRiskFactor();
          }
        } else {
          if (isSimulation) {
            navigate(
              makeUrl(`/risk-levels/risk-factors/simulation-mode/:key/:type/create`, {
                key: `${jobId ? jobId : 'new'}-${activeIterationIndex}`,
                type: selectedSection,
              }),
              {
                replace: true,
                state: {
                  prefill: {
                    ...entity,
                    name: `${entity.name} (Copy)`,
                  },
                },
              },
            );
          } else {
            navigate(
              makeUrl(`/risk-levels/risk-factors/:type/:id/duplicate`, {
                type: selectedSection,
                id: entity.id,
              }),
            );
          }
        }
      }
    },
    [
      handleEditRiskFactor,
      isSimulation,
      simulationRiskFactorsMap,
      selectedSection,
      setSimulationRiskFactorsMap,
      handleSimulationSave,
      jobId,
      activeIterationIndex,
      user?.name,
      api,
      queryClient,
      navigate,
    ],
  );

  return {
    onActionsMenuClick,
  };
}
