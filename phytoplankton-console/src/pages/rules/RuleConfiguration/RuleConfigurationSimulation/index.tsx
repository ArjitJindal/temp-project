import React, { useState, useMemo, useRef, useCallback, useEffect, Ref } from 'react';
import { cloneDeep, merge } from 'lodash';
import { useMutation } from '@tanstack/react-query';
import { usePrevious } from 'ahooks';
import RuleConfigurationFormV8, {
  RuleConfigurationFormV8Values,
  STEPS,
} from '../RuleConfigurationV8/RuleConfigurationFormV8';
import s from './style.module.less';
import { SimulationStatistics } from './SimulationStatistics';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import RuleConfigurationForm, {
  RULE_CONFIGURATION_STEPS,
  RuleConfigurationFormValues,
} from '@/pages/rules/RuleConfiguration/RuleConfigurationV2/RuleConfigurationForm';
import { FormRef } from '@/components/library/Form';
import {
  formValuesToRuleInstance,
  useUpdateRuleInstance,
  useCreateRuleInstance,
  ruleInstanceToFormValues,
  ruleInstanceToFormValuesV8,
  formValuesToRuleInstanceV8,
} from '@/pages/rules/utils';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { useDemoMode } from '@/components/AppWrapper/Providers/DemoModeProvider';
import { useQuery } from '@/utils/queries/hooks';
import { SIMULATION_JOB } from '@/utils/queries/keys';
import { isSuccess } from '@/utils/asyncResource';
import * as Card from '@/components/ui/Card';
import { LoadingCard } from '@/components/ui/Card';
import Label from '@/components/library/Label';
import { H4 } from '@/components/ui/Typography';
import Tooltip from '@/components/library/Tooltip';
import AddLineIcon from '@/components/ui/icons/Remix/system/add-line.react.svg';
import { notEmpty } from '@/utils/array';
import {
  SimulationPostResponse,
  SimulationIteration,
  SimulationBeaconParameters,
  Rule,
  RuleInstance,
  SimulationBeaconParametersRequest,
  SimulationBeaconJob,
} from '@/apis';
import StepButtons from '@/components/library/StepButtons';
import Button from '@/components/library/Button';
import Tabs from '@/components/library/Tabs';

const DUPLICATE_TAB_KEY = 'duplicate';
const MAX_SIMULATION_ITERATIONS = 3;
const POLL_STATUS_INTERVAL_SECONDS = 15;
const DEFAULT_ITERATION: Omit<SimulationBeaconParameters, 'ruleInstance'> = {
  type: 'BEACON',
  name: 'Iteration 1',
  description: '',
  sampling: {
    transactionsCount: 10000,
  },
};

function allIterationsCompleted(iterations: SimulationIteration[]): boolean {
  return iterations.every(
    (iteration) =>
      iteration.latestStatus.status === 'SUCCESS' || iteration.latestStatus.status === 'FAILED',
  );
}

export interface Props {
  v8Mode?: boolean;
  rule?: Rule;
  ruleInstance: RuleInstance;
  jobId?: string;
  onRuleInstanceUpdated?: (ruleInstance: RuleInstance) => void;
  onCancel?: () => void;
}

export function RuleConfigurationSimulation(props: Props) {
  const { v8Mode, ruleInstance, onCancel, onRuleInstanceUpdated, rule } = props;
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  const [showValidationError, setShowValidationError] = useState(false);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const steps = v8Mode ? STEPS : RULE_CONFIGURATION_STEPS;
  const [activeStepKey, setActiveStepKey] = useState(steps[0]);
  const [newIterations, setNewIterations] = useState<SimulationBeaconParameters[]>([
    {
      ...DEFAULT_ITERATION,
      ruleInstance,
    },
  ]);
  const [createdJobId, setCreatedJobId] = useState<string | undefined>();
  const jobId = useMemo(() => createdJobId ?? props.jobId, [createdJobId, props.jobId]);
  const activeStepIndex = steps.findIndex((key) => key === activeStepKey);
  const formRef1 =
    useRef<FormRef<RuleConfigurationFormValues | RuleConfigurationFormV8Values>>(null);
  const formRef2 =
    useRef<FormRef<RuleConfigurationFormValues | RuleConfigurationFormV8Values>>(null);
  const formRef3 =
    useRef<FormRef<RuleConfigurationFormValues | RuleConfigurationFormV8Values>>(null);
  const iterationFormRefs = useMemo(
    () => [formRef1, formRef2, formRef3],
    [formRef1, formRef2, formRef3],
  );
  const syncFormValues = useCallback(() => {
    const updatedIterations = newIterations.map((iteration, i) => {
      const formValues = iterationFormRefs[i].current?.getValues();
      if (!formValues) {
        return iteration;
      }
      return {
        ...iteration,
        name: formValues.basicDetailsStep.simulationIterationName || '',
        description: formValues.basicDetailsStep.simulationIterationDescription || '',
        ruleInstance: iterationFormRefs[i].current
          ? v8Mode
            ? formValuesToRuleInstanceV8(
                ruleInstance,
                formValues as RuleConfigurationFormV8Values,
                isRiskLevelsEnabled,
              )
            : formValuesToRuleInstance(
                ruleInstance,
                formValues as RuleConfigurationFormValues,
                isRiskLevelsEnabled,
              )
          : iteration.ruleInstance ?? ruleInstance,
        ...(formValues?.basicDetailsStep.simulationIterationTimeRange
          ? {
              sampling: {
                transactionsCount: 10_000,
                timestamps: {
                  afterTimestamp:
                    formValues.basicDetailsStep.simulationIterationTimeRange?.start ?? 0,
                  beforeTimestamp:
                    formValues.basicDetailsStep.simulationIterationTimeRange?.end ??
                    Number.MAX_SAFE_INTEGER,
                },
              },
            }
          : {}),
      };
    });

    setNewIterations(updatedIterations);
    return updatedIterations;
  }, [isRiskLevelsEnabled, iterationFormRefs, newIterations, ruleInstance, v8Mode]);
  const handleDuplicate = useCallback(() => {
    const newIterations = syncFormValues();
    const activeIteration = newIterations[activeTabIndex];
    if (activeIteration) {
      setNewIterations([...newIterations, cloneDeep(activeIteration)]);
    }
  }, [activeTabIndex, syncFormValues]);
  const handleChangeIterationTab = useCallback(
    (newActiveTabKey) => {
      const newActiveTabIndex = Number(newActiveTabKey);
      if (newActiveTabKey !== DUPLICATE_TAB_KEY) {
        syncFormValues();
        setActiveTabIndex(newActiveTabIndex);
      }
    },
    [syncFormValues],
  );
  const api = useApi();
  const updateRuleInstanceMutation = useUpdateRuleInstance(onRuleInstanceUpdated);
  const createRuleInstanceMutation = useCreateRuleInstance(onRuleInstanceUpdated);
  const startSimulationMutation = useMutation<
    SimulationPostResponse,
    unknown,
    SimulationBeaconParameters[]
  >(
    async (iterations) => {
      return api.postSimulation({
        SimulationRiskLevelsParametersRequest___SimulationBeaconParametersRequest___SimulationRiskFactorsParametersRequest:
          {
            type: 'BEACON',
            parameters: iterations,
            defaultRuleInstance: ruleInstance,
          } as SimulationBeaconParametersRequest,
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

  const [isDemoModeRes] = useDemoMode();

  const jobResult = useQuery(
    SIMULATION_JOB(jobId ?? ''),
    () =>
      api.getSimulationTestId({
        jobId: jobId ?? '',
      }) as Promise<SimulationBeaconJob>,
    {
      refetchInterval: (data) =>
        allIterationsCompleted(data?.iterations || [])
          ? false
          : isDemoModeRes
          ? 8000
          : POLL_STATUS_INTERVAL_SECONDS * 1000,
      enabled: Boolean(jobId),
    },
  );
  const handleStartSimulation = useCallback(() => {
    const formRef = iterationFormRefs[activeTabIndex];
    const newIterations = syncFormValues();
    const invalidIteration = newIterations.find(
      (iteration) =>
        !formRef.current?.validate(
          v8Mode
            ? ruleInstanceToFormValuesV8(isRiskLevelsEnabled, iteration.ruleInstance)
            : ruleInstanceToFormValues(isRiskLevelsEnabled, iteration.ruleInstance),
        ),
    );
    if (invalidIteration) {
      setShowValidationError(true);
      message.warn(
        `Please make sure that all the required fields are filled. (${invalidIteration.name})`,
      );
    } else {
      startSimulationMutation.mutate(newIterations);
    }
  }, [
    activeTabIndex,
    isRiskLevelsEnabled,
    iterationFormRefs,
    startSimulationMutation,
    syncFormValues,
    v8Mode,
  ]);

  // const prevIsVisible = usePrevious(isVisible);
  const prevRuleInstance = usePrevious(ruleInstance);
  useEffect(() => {
    if (!prevRuleInstance && ruleInstance) {
      setNewIterations([
        {
          ...DEFAULT_ITERATION,
          ruleInstance,
        },
      ]);
    }
  }, [activeStepKey, prevRuleInstance, ruleInstance, startSimulationMutation]);
  const isShowingResults = useMemo(
    () => Boolean(startSimulationMutation.isLoading || jobId),
    [jobId, startSimulationMutation.isLoading],
  );
  const iterations = useMemo(() => {
    return jobId && isSuccess(jobResult.data)
      ? jobResult.data?.value.iterations.map((iteration) => iteration.parameters) ?? []
      : newIterations;
  }, [jobId, jobResult.data, newIterations]);
  const isLoading = useMemo(() => {
    return Boolean(
      startSimulationMutation.isLoading ||
        (jobId &&
          !(isSuccess(jobResult.data) && allIterationsCompleted(jobResult.data.value.iterations))),
    );
  }, [jobId, jobResult.data, startSimulationMutation.isLoading]);
  const handleDeleteIteration = (index: number) => {
    const updatedIterations = newIterations.filter((_, i) => i !== index);
    setNewIterations(updatedIterations);
    updatedIterations.forEach((iteration, i) => {
      const formValues = v8Mode
        ? ruleInstanceToFormValuesV8(isRiskLevelsEnabled, iteration.ruleInstance)
        : ruleInstanceToFormValues(isRiskLevelsEnabled, iteration.ruleInstance);
      if (formValues) {
        formValues.basicDetailsStep.simulationIterationName = iteration.name;
        formValues.basicDetailsStep.simulationIterationDescription = iteration.description;
        iterationFormRefs[i].current?.setValues(formValues);
      }
    });
    setActiveTabIndex(Math.max(0, activeTabIndex - 1));
  };
  const onEdit = (action: 'add' | 'remove', key?: string) => {
    if (action === 'add') {
      handleDuplicate();
    } else if (action === 'remove' && key) {
      handleDeleteIteration(parseInt(key));
    }
  };
  return (
    <div className={s.root}>
      <Tabs
        type="editable-card"
        activeKey={`${activeTabIndex}`}
        onChange={handleChangeIterationTab}
        hideAdd={iterations.length >= MAX_SIMULATION_ITERATIONS || isShowingResults}
        addIcon={
          <Tooltip
            title="You can simulate a maximum of 3 iterations for this rule at once."
            placement="bottom"
          >
            <div onClick={handleDuplicate} className={s.duplicateButton}>
              <AddLineIcon width={20} /> <span>Duplicate</span>
            </div>
          </Tooltip>
        }
        onEdit={(action, key) => onEdit(action, key)}
        items={[
          ...iterations.map((iteration, i) => ({
            title: `Iteration ${i + 1}`,
            key: `${i}`,
            isClosable: iterations.length > 1 && !isShowingResults,
            children: isLoading ? (
              <LoadingCard loadingMessage="Running the simulation for a subset of transactions & generating results for you." />
            ) : (
              <>
                {jobId && (
                  <div>
                    <Label label={iteration.name}>{iteration.description}</Label>
                  </div>
                )}
                {jobId && (
                  <div className={s.result}>
                    <Card.Root>
                      <Card.Section>
                        {isSuccess(jobResult.data) ? (
                          <SimulationStatistics iteration={jobResult.data.value.iterations[i]} />
                        ) : undefined}
                      </Card.Section>
                    </Card.Root>
                    <H4>Changed rule parameters</H4>
                  </div>
                )}
                {v8Mode ? (
                  <RuleConfigurationFormV8
                    ref={iterationFormRefs[i] as Ref<FormRef<RuleConfigurationFormV8Values>>}
                    rule={rule}
                    formInitialValues={merge(
                      ruleInstanceToFormValuesV8(isRiskLevelsEnabled, iteration.ruleInstance),
                      {
                        basicDetailsStep: {
                          simulationIterationName: iteration.name,
                          simulationIterationDescription: iteration.description,
                        },
                      },
                    )}
                    readOnly={Boolean(jobId)}
                    simulationMode={true}
                    activeStepKey={activeStepKey}
                    onSubmit={() => {}}
                    onActiveStepKeyChange={setActiveStepKey}
                    newRuleId={ruleInstance?.id ?? 'RC'}
                  />
                ) : (
                  <RuleConfigurationForm
                    key={iteration.ruleInstance?.ruleId}
                    readOnly={Boolean(jobId)}
                    ref={iterationFormRefs[i] as Ref<FormRef<RuleConfigurationFormValues>>}
                    rule={rule}
                    formInitialValues={merge(
                      ruleInstanceToFormValues(isRiskLevelsEnabled, iteration.ruleInstance),
                      {
                        basicDetailsStep: {
                          simulationIterationName: iteration.name,
                          simulationIterationDescription: iteration.description,
                        },
                      },
                    )}
                    simulationMode={true}
                    activeStepKey={activeStepKey}
                    showValidationError={showValidationError}
                    onSubmit={() => {}}
                    onActiveStepKeyChange={setActiveStepKey}
                  />
                )}
              </>
            ),
          })),
        ].filter(notEmpty)}
      />
      <div className={s.footer}>
        {jobId ? (
          <div>{/* placeholder invisible component */}</div>
        ) : (
          <StepButtons
            nextDisabled={activeStepIndex === steps.length - 1}
            prevDisabled={activeStepIndex === 0}
            onNext={() => {
              const nextStep = steps[activeStepIndex + 1];
              setActiveStepKey(nextStep);
            }}
            onPrevious={() => {
              const prevStep = steps[activeStepIndex - 1];
              setActiveStepKey(prevStep);
            }}
          />
        )}
        <div className={s.footerButtons}>
          <Button type="TETRIARY" onClick={onCancel}>
            Cancel
          </Button>
          {isShowingResults ? (
            <Button
              onClick={() => {
                if (iterations[activeTabIndex]?.ruleInstance?.id) {
                  updateRuleInstanceMutation.mutate(iterations[activeTabIndex]?.ruleInstance);
                } else {
                  createRuleInstanceMutation.mutate(iterations[activeTabIndex]?.ruleInstance);
                }
              }}
              isDisabled={isLoading}
              requiredPermissions={['rules:my-rules:write']}
            >
              {iterations[activeTabIndex]?.ruleInstance?.id ? 'Update rule' : 'Create rule'}
            </Button>
          ) : (
            <Button
              isLoading={startSimulationMutation.isLoading}
              onClick={handleStartSimulation}
              requiredPermissions={['simulator:simulations:write']}
              testName="run-simulation-button"
            >
              Run simulation
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
