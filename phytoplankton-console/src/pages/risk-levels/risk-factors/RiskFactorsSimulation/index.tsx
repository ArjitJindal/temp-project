import { useCallback, useState } from 'react';
import {
  BUSINESS_RISK_PARAMETERS,
  TRANSACTION_RISK_PARAMETERS,
  USER_RISK_PARAMETERS,
} from '../ParametersTable/consts';
import s from './styles.module.less';
import { SimulationResult } from './SimulationResult';
import { ParametersTableTabs } from './ParametersTableTabs';
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
  ParameterAttributeRiskValuesParameterEnum,
  RiskEntityType,
  RiskScoreValueLevel,
  RiskScoreValueScore,
  SimulationPostResponse,
  SimulationRiskFactorsParametersRequest,
} from '@/apis';
import Tabs from '@/components/library/Tabs';

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
const MAX_SIMULATION_ITERATIONS = 3;

export function RiskFactorsSimulation() {
  const [iterations, setIterations] = useState([DEFAULT_ITERATION]);
  const api = useApi();

  const [createdJobId, setCreatedJobId] = useState<string | null>(null);

  const [valuesResources, setValuesResources] = useState<
    Array<{
      [key in Entity]?: {
        [key in ParameterName]?: AsyncResource<ParameterSettings>;
      };
    }>
  >([{}, {}, {}]);

  const startSimulationMutation = useMutation<
    SimulationPostResponse,
    unknown,
    SimulationRiskFactorsParametersRequest
  >(
    async (simulationData) => {
      return api.postSimulation({
        SimulationRiskLevelsParametersRequest___SimulationBeaconParametersRequest___SimulationRiskFactorsParametersRequest:
          simulationData,
      });
    },
    {
      onSuccess: (data) => {
        setCreatedJobId(data.jobId);
      },
      onError: (err: any) => {
        message.fatal(`Unable to run simulation - ${getErrorMessage(err)}`, err);
      },
    },
  );

  const handleStartSimulation = useCallback(() => {
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
            isDerived: fetchIsDerived(
              entity as Entity,
              parameter as ParameterAttributeRiskValuesParameterEnum,
            ),
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
  }, [valuesResources, iterations, startSimulationMutation]);

  const [activeIterationIndex, setActiveIterationIndex] = useState(1);

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

  const fetchIsDerived = (entity: Entity, parameter: ParameterAttributeRiskValuesParameterEnum) => {
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
    setValuesResources((prevValuesResources) =>
      prevValuesResources.map((resource, index) => {
        if (index === activeIterationIndex && index > 0) {
          return prevValuesResources[index - 1];
        }
        return resource;
      }),
    );
    setActiveIterationIndex(iterations.length + 1);
  };

  const onSaveValues = (
    parameter: ParameterAttributeRiskValuesParameterEnum,
    newValues: ParameterValues,
    entityType: RiskEntityType,
    defaultValue: RiskScoreValueScore | RiskScoreValueLevel,
    weight: number,
  ) => {
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
    parameter: ParameterAttributeRiskValuesParameterEnum,
    isActive: boolean,
  ) => {
    setValuesResources((prevValuesResources) => {
      return prevValuesResources.map((prevValuesResource, index) => {
        if (index === activeIterationIndex - 1) {
          return {
            ...prevValuesResource,
            [entityType]: {
              ...prevValuesResource[entityType],
              [parameter]: success({
                ...(
                  (prevValuesResource[entityType]?.[parameter] ?? {}) as Success<ParameterSettings>
                )?.value,
                isActive: isActive,
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
    setActiveIterationIndex(Math.max(1, activeIterationIndex - 1));
  };
  const onEdit = (action: 'add' | 'remove', key?: string) => {
    if (action === 'add') {
      handleDuplicate();
    } else if (key && action === 'remove') {
      handleDeleteIteration(parseInt(key) - 1);
    }
  };
  return createdJobId ? (
    <SimulationResult jobId={createdJobId} />
  ) : (
    <div className={s.root}>
      <div>
        <Tabs
          type="editable-card"
          activeKey={`${activeIterationIndex}`}
          onChange={(key) => {
            setActiveIterationIndex(parseInt(key));
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
          <ParametersTableTabs
            parameterSettings={valuesResources[activeIterationIndex - 1]}
            onActivate={onActivate}
            onSaveValues={onSaveValues}
          />
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
}

const RiskFactorsSimulationForm = (props: FormProps) => {
  const { allIterations, currentIterationIndex, onChangeIterationInfo } = props;
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
                  placeholder={'Enter iteration name'}
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
                  {
                    value: 'ALL',
                    label: 'All users',
                    description:
                      'Run the simulation for all users. It may take time to process results, check progress under simulation history.',
                  },
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
