import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { PlusOutlined } from '@ant-design/icons';
import RiskClassificationTable, { State, prepareApiState } from '../../RiskClassificationTable';
import s from './styles.module.less';
import VerticalMenu from '@/components/library/VerticalMenu';
import Button from '@/components/library/Button';
import Label from '@/components/library/Label';
import TextInput from '@/components/library/TextInput';
import TextArea from '@/components/library/TextArea';
import Dropdown from '@/components/library/Dropdown';
import { message } from '@/components/library/Message';
import { useApi } from '@/api';
import {
  SimulationPostResponse,
  SimulationStats,
  RiskClassificationScore,
  SimulationRiskLevelsParameters,
} from '@/apis';
import Tooltip from '@/components/library/Tooltip';
import * as Card from '@/components/ui/Card';
import { getOr } from '@/utils/asyncResource';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useSimulationCount } from '@/hooks/api/simulation';

const MAX_ITERATIONS = 3;
const DEFAULT_USERS_SAMPLING = 10000;
const DEFAULT_TRANSACTIONS_SAMPLING = 10000;

type Props = {
  setResult: (result: SimulationPostResponse | null) => void;
  refetchSimulationCount: () => void;
  defaultState: State | null;
  riskValuesRefetch: () => void;
  onRun: () => void;
};

export type SimulationRef = {
  reset: () => void;
};

type Value = {
  name: string;
  description: string;
  key: string;
  state: State | null;
};

const DEFAULT_STATE: State = [20, 40, 60, 80];
const DEFAULT_VALUE: Value = {
  name: 'Iteration 1',
  description: '',
  key: '1',
  state: null,
};

const NewSimulation = forwardRef((props: Props, ref: React.Ref<SimulationRef>) => {
  const [active, setActive] = useState<string>('1');
  const api = useApi();

  const [state, setState] = useState<State | null>(null);
  const [defaultRiskClassification, setDefaultRiskClassification] = useState<
    RiskClassificationScore[] | null
  >(null);

  const simulationCountResults = useSimulationCount();

  const simulationCount = getOr<SimulationStats>(simulationCountResults.data, {
    runJobsCount: 0,
  }).runJobsCount;

  const totalSimulations = useSettings()?.limits?.simulations ?? 0;

  const [values, setValues] = useState<Value[]>([DEFAULT_VALUE]);
  const { setResult, refetchSimulationCount, riskValuesRefetch, defaultState, onRun } = props;

  const handleSetAKey = useCallback(
    (key: string, value: any) => {
      setValues((prev) => {
        return prev.map((item) => {
          if (item.key === active) {
            return { ...item, [key]: value };
          }
          return item;
        });
      });
    },
    [active],
  );

  const reset = useCallback(() => {
    setActive('1');
    setValues([DEFAULT_VALUE]);
    setState(null);
    riskValuesRefetch();
  }, [riskValuesRefetch]);

  useImperativeHandle(ref, () => ({
    reset,
  }));

  const handleSimulateMutation = useMutation<
    SimulationPostResponse,
    Error,
    {
      values: Value[];
      defaultRiskClassification: RiskClassificationScore[];
    }
  >(
    async ({ values, defaultRiskClassification }) =>
      api.postSimulation({
        SimulationPostRequest: {
          riskLevelsParameters: {
            type: 'PULSE',
            defaultRiskClassifications: defaultRiskClassification,
            parameters: values.map(
              (item) =>
                ({
                  type: 'PULSE',
                  classificationValues: prepareApiState(item.state),
                  name: item.name,
                  description: item.description,
                  sampling: {
                    usersCount: DEFAULT_USERS_SAMPLING,
                    userLatestTransactionsCount: DEFAULT_TRANSACTIONS_SAMPLING,
                  },
                  parameterAttributeRiskValues: [],
                } as SimulationRiskLevelsParameters),
            ),
          },
        },
      }),
    {
      onSuccess: (data) => {
        setResult(data);
        refetchSimulationCount();
      },
      onError: (e: any) => {
        message.fatal(e.message, e);
      },
    },
  );

  const handleSimulate = useCallback(() => {
    if (values.length > MAX_ITERATIONS) {
      message.error(`You can't add more than ${MAX_ITERATIONS} iterations`);
      return;
    }

    if (values.some((item) => item.state == null)) {
      message.error('Please fill all the fields');
      return;
    }

    if (!defaultRiskClassification) {
      message.error('Default risk classification is not loaded');
      return;
    }

    if (defaultRiskClassification == null) {
      message.fatal(
        'Default risk classification is not loaded',
        new Error('Default risk classification is not loaded'),
      );
      return;
    }
    onRun();
    handleSimulateMutation.mutate({ values, defaultRiskClassification });
  }, [handleSimulateMutation, values, defaultRiskClassification, onRun]);

  const handleSetState = useCallback(
    (value: State) => {
      handleSetAKey('state', value);
    },
    [handleSetAKey],
  );

  useEffect(() => {
    if (defaultState && active === '1' && values[0].state == null) {
      handleSetState(defaultState);
      setState(defaultState);
    }
  }, [defaultState, active, handleSetState, values]);

  useEffect(() => {
    if (state) {
      handleSetState(state);
    }
  }, [state, handleSetState]);

  useEffect(() => {
    if (defaultRiskClassification == null && state) {
      setDefaultRiskClassification(prepareApiState(state));
    }
  }, [defaultRiskClassification, state]);

  const currentActive = useMemo(() => {
    return values.find((item) => item.key === active);
  }, [active, values]);

  return (
    <Card.Root className={s.cardRoot}>
      <VerticalMenu
        items={values.map((item) => ({
          key: item.key,
          title: item.name,
        }))}
        active={active}
        onChange={(value) => {
          setActive(value);
          setState(values.find((item) => item.key === value)?.state ?? null);
        }}
        minWidth={200}
        additionalMenuTop={
          <Dropdown
            disabled={values.length >= MAX_ITERATIONS}
            onSelect={(value) => {
              setValues((prev) => {
                if (prev == null) {
                  return [];
                }
                return [
                  ...prev,
                  {
                    name: `Iteration ${prev.length + 1}`,
                    description: '',
                    key: `${prev.length + 1}`,
                    state: values.find((item) => item.key === value.value)?.state ?? DEFAULT_STATE,
                  },
                ];
              });
            }}
            extraBottomMargin
            options={values.map((item) => ({
              label: item.name,
              value: item.key,
            }))}
          >
            <Button
              type="TETRIARY"
              size="MEDIUM"
              style={{ width: '100%', position: 'relative' }}
              isDisabled={values.length >= MAX_ITERATIONS}
              requiredResources={['write:::simulator/simulations/*']}
            >
              <Tooltip title="You can simulate a maximum of 3 iterations at once." placement="top">
                <PlusOutlined /> Duplicate
              </Tooltip>
            </Button>
          </Dropdown>
        }
      >
        <div className={s.basicDetailsContainer}>
          <Label label="Iteration name">
            <TextInput
              value={currentActive?.name}
              onChange={(value) => handleSetAKey('name', value)}
            />
          </Label>
          <Label label="Description">
            <TextArea
              value={currentActive?.description ?? ''}
              onChange={(value) => handleSetAKey('description', value)}
              maxLength={100}
              showCount
            />
          </Label>
        </div>
        <div style={{ width: '100%', display: 'flex', alignItems: 'end' }}>
          <div className={s.tableContainer}>
            <RiskClassificationTable
              state={values.find((item) => item.key === active)?.state ?? DEFAULT_STATE}
              setState={setState}
              isDisabled={state == null}
            />
            <div className={s.simulateButtonContainer}>
              <Button
                type="PRIMARY"
                size="MEDIUM"
                style={{ marginTop: 16 }}
                isDisabled={state == null || simulationCount >= totalSimulations}
                onClick={handleSimulate}
                isLoading={handleSimulateMutation.isLoading}
                requiredResources={['write:::simulator/simulations/*']}
              >
                Run simulation
              </Button>
            </div>
          </div>
        </div>
      </VerticalMenu>
    </Card.Root>
  );
});

export default NewSimulation;
