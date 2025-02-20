import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLocalStorageState } from 'ahooks';
import {
  ALL_RISK_PARAMETERS,
  BUSINESS_RISK_PARAMETERS,
  TRANSACTION_RISK_PARAMETERS,
  USER_RISK_PARAMETERS,
} from '../risk-factors/ParametersTable/consts';
import s from './styles.module.less';
import { ParametersTableTabs } from './ParametersTableTabs';
import SimulationCustomRiskFactorsTable, {
  LocalStorageKey,
} from './SimulationCustomRiskFactors/SimulationCustomRiskFactorsTable';
import * as Card from '@/components/ui/Card';
import Form from '@/components/library/Form';
import InputField from '@/components/library/Form/InputField';
import TextInput from '@/components/library/TextInput';
import SelectionGroup from '@/components/library/SelectionGroup';
import { useId } from '@/utils/hooks';
import Button from '@/components/library/Button';
import {
  Entity,
  ParameterName,
  ParameterSettings,
  ParameterValues,
} from '@/pages/risk-levels/risk-factors/ParametersTable/types';
import { AsyncResource, Success, success } from '@/utils/asyncResource';
import { useApi } from '@/api';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import Tooltip from '@/components/library/Tooltip';
import AddLineIcon from '@/components/ui/icons/Remix/system/add-line.react.svg';
import {
  ParameterAttributeRiskValues,
  RiskEntityType,
  RiskFactor,
  RiskFactorParameter,
  RiskScoreValueLevel,
  RiskScoreValueScore,
  SimulationPostResponse,
  SimulationRiskFactorsParametersRequest,
  SimulationV8RiskFactorsParametersRequest,
} from '@/apis';
import Tabs from '@/components/library/Tabs';

export type ParameterValue = {
  [key in Entity]?: {
    [key in ParameterName]?: AsyncResource<ParameterSettings>;
  };
};
interface Props {
  parameterValues: ParameterValue;
  riskFactors: RiskFactor[];
}

interface FormValues {
  name: string;
  description: string;
  samplingSize: 'ALL' | 'RANDOM';
}

const DEFAULT_ITERATION: FormValues = {
  name: 'Iteration 1',
  description: '',
  samplingSize: 'RANDOM',
};

const DUPLICATE_TAB_KEY = 'DUPLICATE';
const MAX_SIMULATION_ITERATIONS = 3;

export function RiskFactorsSimulation(props: Props) {
  const { parameterValues, riskFactors } = props;
  const [storedIterations, setStoredIterations] = useLocalStorageState('SIMULATION_ITERATIONS', [
    DEFAULT_ITERATION,
  ]);
  const [iterations, setIterations] = useState(storedIterations);
  const api = useApi();
  const navigate = useNavigate();
  const type = location.pathname.includes('custom-risk-factors')
    ? 'custom-risk-factors'
    : 'risk-factors';

  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const [activeIterationIndex, setActiveIterationIndex] = useState(1);
  useEffect(() => {
    if (createdJobId) {
      navigate(`/risk-levels/${type}/simulation-result/${createdJobId}`);
    }
  }, [createdJobId, navigate, type]);

  const [valuesResources, setValuesResources] = useState<Array<ParameterValue>>([
    parameterValues,
    {},
    {},
  ]);

  const startSimulationMutation = useMutation<
    SimulationPostResponse,
    unknown,
    SimulationRiskFactorsParametersRequest | SimulationV8RiskFactorsParametersRequest
  >(
    async (simulationData) => {
      if (simulationData.type === 'RISK_FACTORS_V8') {
        return api.postSimulation({
          SimulationPostRequest: {
            riskFactorsV8Parameters: simulationData,
          },
        });
      } else {
        return api.postSimulation({
          SimulationPostRequest: {
            riskFactorsParameters: simulationData,
          },
        });
      }
    },
    {
      onSuccess: (data) => {
        if (type === 'custom-risk-factors') {
          for (let i = 0; i < data.taskIds.length; i++) {
            localStorage.removeItem(`${LocalStorageKey}-new-${data.taskIds[i]}`);
          }
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
    if (type === 'custom-risk-factors') {
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
        sampling: {
          usersCount: iterations[0].samplingSize,
        },
        parameters: iterations.map((iteration, index) => {
          return {
            name: iteration.name,
            description: iteration.description,
            parameters: getRiskFactors(index),
            type: 'RISK_FACTORS_V8',
          };
        }),
      };
      startSimulationMutation.mutate(simulationData);
    } else {
      const getParsedParams = (source: {
        [key in Entity]?: {
          [key in ParameterName]?: AsyncResource<ParameterSettings>;
        };
      }): ParameterAttributeRiskValues[] => {
        return Object.keys(source).flatMap((entity) => {
          return Object.keys(source[entity]).map((parameter) => {
            const value = source[entity][parameter].value;
            return {
              parameter,
              riskEntityType: entity,
              isActive: value.isActive,
              isDerived: fetchIsDerived(entity as Entity, parameter as RiskFactorParameter),
              parameterType: value.parameterType,
              riskLevelAssignmentValues: value.values,
              weight: value.weight,
              defaultValue: value.defaultValue,
            };
          });
        }) as ParameterAttributeRiskValues[];
      };
      const simlationData: SimulationRiskFactorsParametersRequest = {
        type: 'RISK_FACTORS',
        sampling: {
          usersCount: iterations[0].samplingSize,
        },
        parameters: iterations.map((iteration, index) => {
          const params = getParsedParams(valuesResources[index]);
          return {
            name: iteration.name,
            description: iteration.description,
            type: 'RISK_FACTORS',
            parameterAttributeRiskValues: params,
          };
        }),
      };
      startSimulationMutation.mutate(simlationData);
    }
  }, [valuesResources, iterations, startSimulationMutation, type]);

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

  const fetchIsDerived = (entity: Entity, parameter: RiskFactorParameter) => {
    switch (entity) {
      case 'CONSUMER_USER':
        return USER_RISK_PARAMETERS.find((param) => param.parameter === parameter)?.isDerived;
      case 'BUSINESS':
        return BUSINESS_RISK_PARAMETERS.find((param) => param.parameter === parameter)?.isDerived;
      case 'TRANSACTION':
        return TRANSACTION_RISK_PARAMETERS.find((param) => param.parameter === parameter)
          ?.isDerived;
      default:
        return false;
    }
  };

  const handleDuplicate = () => {
    setIterations((prevIterations) => [
      ...prevIterations,
      {
        ...prevIterations[prevIterations.length - 1],
        name: 'Iteration ' + (prevIterations.length + 1),
      },
    ]);
    if (type === 'risk-factors') {
      setValuesResources((prevValuesResources) =>
        prevValuesResources.map((resource, index) => {
          if (index === iterations.length) {
            return prevValuesResources[activeIterationIndex - 1];
          }
          return resource;
        }),
      );
    }
    if (type === 'custom-risk-factors') {
      setStoredIterations([...storedIterations, DEFAULT_ITERATION]);
    }

    setActiveIterationIndex(iterations.length + 1);
  };

  const onSaveValues = (
    parameter: RiskFactorParameter,
    newValues: ParameterValues,
    entityType: RiskEntityType,
    defaultValue: RiskScoreValueScore | RiskScoreValueLevel,
    weight: number,
  ) => {
    const parameterSettings = ALL_RISK_PARAMETERS.find((param) => param.parameter === parameter);
    setValuesResources((prevValuesResources) => {
      return prevValuesResources.map((prevValuesResource, index) => {
        if (index === activeIterationIndex - 1) {
          return {
            ...prevValuesResource,
            [entityType]: {
              ...prevValuesResource[entityType],
              [parameter]: success({
                isActive: true,
                values: newValues,
                defaultValue,
                weight,
                parameterType: parameterSettings?.parameterType,
                isDerived: parameterSettings?.isDerived,
              }),
            },
          };
        }
        return prevValuesResource;
      });
    });
  };
  const onActivate = (
    entityType: RiskEntityType,
    parameter: RiskFactorParameter,
    isActive: boolean,
  ) => {
    const defaultRiskFactorValue = {
      values: [],
      defaultValue: { type: 'RISK_LEVEL', value: 'VERY_HIGH' },
      weight: 1,
    };
    const parameterSettings = ALL_RISK_PARAMETERS.find((param) => param.parameter === parameter);
    setValuesResources((prevValuesResources) => {
      return prevValuesResources.map((prevValuesResource, index) => {
        if (index === activeIterationIndex - 1) {
          return {
            ...prevValuesResource,
            [entityType]: {
              ...prevValuesResource[entityType],
              [parameter]: success({
                ...((prevValuesResource[entityType]?.[parameter] as Success<ParameterSettings>)
                  ?.value ?? defaultRiskFactorValue),
                isActive: isActive,
                parameterType: parameterSettings?.parameterType,
                isDerived: parameterSettings?.isDerived,
              }),
            },
          };
        }
        return prevValuesResource;
      });
    });
  };
  const handleDeleteIteration = (index: number) => {
    setIterations((prevIterations) => prevIterations.filter((_iteration, i) => i !== index));
    if (type === 'custom-risk-factors') {
      localStorage.removeItem(`${LocalStorageKey}-new-${index + 1}`);
      setStoredIterations((prevStoredIterations) =>
        (prevStoredIterations ?? []).filter((_, i) => i !== index),
      );
    } else {
      setValuesResources((prevValuesResources) =>
        prevValuesResources.map((resource, i) => {
          if (i < index) {
            return resource;
          } else {
            if (i + 1 < MAX_SIMULATION_ITERATIONS) {
              return prevValuesResources[i + 1];
            }
            return {};
          }
        }),
      );
    }

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
      <div>
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
              title="You can simulate a maximum of 3 iterations for this rule at once."
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
                  isV8={type === 'custom-risk-factors'}
                  onChangeIterationInfo={onChangeIterationInfo}
                  currentIterationIndex={activeIterationIndex}
                  allIterations={iterations}
                />
              ),
            })),
          ]}
        />
      </div>
      <Card.Root noBorder>
        <Card.Section>
          {type === 'custom-risk-factors' ? (
            <SimulationCustomRiskFactorsTable
              riskFactors={riskFactors}
              canEditRiskFactors={true}
              activeIterationIndex={activeIterationIndex}
            />
          ) : (
            <ParametersTableTabs
              parameterSettings={valuesResources[activeIterationIndex - 1]}
              onActivate={onActivate}
              onSaveValues={onSaveValues}
            />
          )}
        </Card.Section>
      </Card.Root>
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

interface FormProps {
  allIterations: FormValues[];
  currentIterationIndex: number;
  onChangeIterationInfo: (iteration: FormValues) => void;
  isV8: boolean;
}

const RiskFactorsSimulationForm = (props: FormProps) => {
  const { allIterations, currentIterationIndex, onChangeIterationInfo, isV8 } = props;
  const iteration: FormValues = allIterations[currentIterationIndex - 1];

  const formId = useId();
  return (
    <Form<FormValues>
      key={formId}
      id={formId}
      initialValues={iteration}
      onSubmit={() => {}}
      onChange={({ values }) => {
        onChangeIterationInfo(values);
      }}
    >
      <Card.Root noBorder>
        <Card.Section>
          <div className={s.layout}>
            <InputField<FormValues, 'name'>
              name={'name'}
              label={'Iteration name'}
              labelProps={{
                required: {
                  value: false,
                  showHint: true,
                },
              }}
            >
              {(inputProps) => (
                <TextInput
                  {...inputProps}
                  value={iteration.name}
                  placeholder={'Enter iteration name'}
                />
              )}
            </InputField>
            <InputField<FormValues, 'description'>
              name={'description'}
              label={'Description'}
              labelProps={{
                required: {
                  value: false,
                  showHint: true,
                },
              }}
            >
              {(inputProps) => (
                <TextInput
                  {...inputProps}
                  value={iteration.description}
                  placeholder={'Enter iteration description'}
                />
              )}
            </InputField>
          </div>
          <InputField<FormValues, 'samplingSize'>
            name={'samplingSize'}
            label={'User sampling size'}
            labelProps={{ required: true }}
          >
            {(inputProps) => (
              <SelectionGroup
                {...inputProps}
                mode="SINGLE"
                value={iteration.samplingSize}
                options={[
                  {
                    value: 'RANDOM',
                    label: 'Random sample',
                    description: 'Run the simulation on a randomly selected subset of users.',
                  },
                  ...(!isV8
                    ? [
                        {
                          value: 'ALL' as 'ALL' | 'RANDOM',
                          label: 'All users',
                          description:
                            'Run the simulation for all users. It may take time to process results, check progress under simulation history.',
                        },
                      ]
                    : []),
                ]}
                {...inputProps}
              />
            )}
          </InputField>
        </Card.Section>
      </Card.Root>
    </Form>
  );
};
