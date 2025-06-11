import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import s from './styles.module.less';
import SimulationCustomRiskFactorsTable, {
  LocalStorageKey,
} from './SimulationCustomRiskFactors/SimulationCustomRiskFactorsTable';
import { FormValues, RiskFactorsSimulationForm } from './SimulationDetailsForm';
import * as Card from '@/components/ui/Card';
import { useSafeLocalStorageState } from '@/utils/hooks';
import Button from '@/components/library/Button';
import { ParameterSettings } from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/RiskFactorConfigurationForm/RiskFactorConfigurationStep/ParametersTable/types';
import { AsyncResource } from '@/utils/asyncResource';
import { useApi } from '@/api';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import Tooltip from '@/components/library/Tooltip';
import AddLineIcon from '@/components/ui/icons/Remix/system/add-line.react.svg';
import {
  RiskFactor,
  RiskEntityType,
  RiskFactorParameter,
  SimulationPostResponse,
  SimulationV8RiskFactorsParametersRequest,
} from '@/apis';
import Tabs from '@/components/library/Tabs';

export type ParameterValue = {
  [key in RiskEntityType]?: {
    [key in RiskFactorParameter]?: AsyncResource<ParameterSettings>;
  };
};
interface Props {
  parameterValues: ParameterValue;
  riskFactors: RiskFactor[];
}

const DEFAULT_ITERATION: FormValues = {
  name: 'Iteration 1',
  description: '',
  samplingType: 'ALL',
  sampleDetails: {
    userCount: 100,
  },
};

const DUPLICATE_TAB_KEY = 'DUPLICATE';
const MAX_SIMULATION_ITERATIONS = 3;

export function RiskFactorsSimulation(props: Props) {
  const { riskFactors } = props;
  const [storedIterations, setStoredIterations] = useSafeLocalStorageState(
    'SIMULATION_ITERATIONS',
    [DEFAULT_ITERATION],
  );
  const [iterations, setIterations] = useState(storedIterations);
  const api = useApi();
  const navigate = useNavigate();
  const [showIterationModal, setShowIterationModal] = useState(false);
  const [createdJobId, setCreatedJobId] = useState<string | undefined>(undefined);
  const [activeIterationIndex, setActiveIterationIndex] = useState(1);
  useEffect(() => {
    if (createdJobId) {
      navigate(`/risk-levels/risk-factors/simulation-result/${createdJobId}`);
    }
  }, [createdJobId, navigate]);

  const startSimulationMutation = useMutation<
    SimulationPostResponse,
    unknown,
    SimulationV8RiskFactorsParametersRequest
  >(
    async (simulationData) => {
      return api.postSimulation({
        SimulationPostRequest: {
          riskFactorsV8Parameters: simulationData,
        },
      });
    },
    {
      onSuccess: (data) => {
        for (let i = 0; i < data.taskIds.length; i++) {
          localStorage.removeItem(`${LocalStorageKey}-new-${data.taskIds[i]}`);
        }
        localStorage.removeItem('SIMULATION_ITERATIONS');
        setCreatedJobId(data.jobId);
      },
      onError: (err: any) => {
        message.fatal(`Unable to run simulation - ${getErrorMessage(err)}`, err);
      },
    },
  );

  const handleStartSimulation = useCallback(() => {
    const getRiskFactors = (iterationIndex: number): RiskFactor[] => {
      const key = `new-${iterationIndex + 1}`;
      const data = localStorage.getItem(`${LocalStorageKey}-${key}`);
      const riskFactors = data ? JSON.parse(data) : undefined;
      if (!riskFactors) {
        return [];
      }
      return Object.values(riskFactors).flat() as RiskFactor[];
    };
    const simulationData: SimulationV8RiskFactorsParametersRequest = {
      type: 'RISK_FACTORS_V8',
      parameters: iterations.map((iteration, index) => {
        return {
          name: iteration.name,
          description: iteration.description,
          parameters: getRiskFactors(index),
          type: 'RISK_FACTORS_V8',
          sampling: {
            sample: {
              type: iteration.samplingType,
              sampleDetails: iteration.sampleDetails,
            },
          },
          riskScoringAlgorithm: iteration.riskAlgorithm,
        };
      }),
    };
    startSimulationMutation.mutate(simulationData);
  }, [iterations, startSimulationMutation]);

  const onChangeIterationInfo = (iteration: FormValues) => {
    setIterations((prevIterations) => {
      return prevIterations.map((prevIteration, index) => {
        if (index === activeIterationIndex - 1) {
          return iteration;
        }
        return prevIteration;
      });
    });
  };

  const handleDuplicate = () => {
    setIterations((prevIterations) => [
      ...prevIterations,
      {
        ...prevIterations[prevIterations.length - 1],
        name: 'Iteration ' + (prevIterations.length + 1),
      },
    ]);
    setStoredIterations([...storedIterations, DEFAULT_ITERATION]);
    setActiveIterationIndex(iterations.length + 1);
    setShowIterationModal(true);
  };

  const handleDeleteIteration = (index: number) => {
    setIterations((prevIterations) => prevIterations.filter((_iteration, i) => i !== index));
    localStorage.removeItem(`${LocalStorageKey}-new-${index + 1}`);
    setStoredIterations((prevStoredIterations) =>
      (prevStoredIterations ?? []).filter((_, i) => i !== index),
    );

    setActiveIterationIndex(Math.max(1, activeIterationIndex - 1));
  };

  const onEdit = (action: 'add' | 'remove', key?: string) => {
    if (action === 'add') {
      handleDuplicate();
    } else if (key && action === 'remove') {
      handleDeleteIteration(parseInt(key) - 1);
    }
  };

  return (
    <div className={s.root}>
      <Card.Root className={s.cardRoot}>
        <Card.Section>
          <div className={s.simulationHeader}>
            <Tabs
              type="editable-card"
              activeKey={`${activeIterationIndex}`}
              onChange={(key) => {
                if (key !== DUPLICATE_TAB_KEY) {
                  setActiveIterationIndex(parseInt(key));
                }
              }}
              onEdit={(action, key) => onEdit(action, key)}
              addIcon={
                <Tooltip
                  title="You can simulate a maximum of 3 iterations at once."
                  placement="bottom"
                >
                  <div className={s.duplicateButton}>
                    <AddLineIcon width={20} /> <span>Duplicate</span>
                  </div>
                </Tooltip>
              }
              hideAdd={iterations.length >= MAX_SIMULATION_ITERATIONS}
              items={[
                ...iterations.map((_iteration, index) => ({
                  title: `Iteration ${index + 1}`,
                  key: `${index + 1}`,
                  isClosable: iterations.length > 1,
                  children: (
                    <RiskFactorsSimulationForm
                      onChangeIterationInfo={onChangeIterationInfo}
                      currentIterationIndex={activeIterationIndex}
                      allIterations={iterations}
                      isVisible={showIterationModal}
                      setIsVisible={(value: boolean) => {
                        setShowIterationModal(value);
                      }}
                      onDuplicate={handleDuplicate}
                    />
                  ),
                })),
              ]}
            />
          </div>
        </Card.Section>
      </Card.Root>
      <div className={s.riskFactorsTableContainer}>
        <SimulationCustomRiskFactorsTable
          riskFactors={riskFactors}
          canEditRiskFactors={true}
          activeIterationIndex={activeIterationIndex}
          jobId={createdJobId}
        />
      </div>
      <div className={s.footer}>
        <div className={s.footerButtons}>
          <Button type="PRIMARY" onClick={handleStartSimulation}>
            Run simulation
          </Button>
        </div>
      </div>
    </div>
  );
}
