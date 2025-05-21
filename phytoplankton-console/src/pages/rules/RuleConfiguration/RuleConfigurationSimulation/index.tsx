import { Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cloneDeep, merge } from 'lodash';
import { useMutation } from '@tanstack/react-query';
import RuleConfigurationFormV8, {
  RuleConfigurationFormV8Values,
  STEPS,
} from '../RuleConfigurationV8/RuleConfigurationFormV8';
import s from './style.module.less';
import { SimulationStatistics } from './SimulationStatistics';
import { SimulationTransactionsHit } from './SimulationResults/Transactions';
import { SimulationUsersHit } from './SimulationResults/Users';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import RuleConfigurationForm, {
  RULE_CONFIGURATION_STEPS,
  RuleConfigurationFormValues,
} from '@/pages/rules/RuleConfiguration/RuleConfigurationV2/RuleConfigurationForm';
import { FormRef } from '@/components/library/Form';
import {
  formValuesToRuleInstance,
  formValuesToRuleInstanceV8,
  ruleInstanceToFormValues,
  ruleInstanceToFormValuesV8,
  useCreateRuleInstance,
  useUpdateRuleInstance,
} from '@/pages/rules/utils';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { useDemoMode } from '@/components/AppWrapper/Providers/DemoModeProvider';
import { useQuery } from '@/utils/queries/hooks';
import { SIMULATION_JOB } from '@/utils/queries/keys';
import { getOr, isLoading as isResourceLoading, isSuccess } from '@/utils/asyncResource';
import Label from '@/components/library/Label';
import { H4 } from '@/components/ui/Typography';
import Tooltip from '@/components/library/Tooltip';
import AddLineIcon from '@/components/ui/icons/Remix/system/add-line.react.svg';
import { notEmpty } from '@/utils/array';
import {
  Rule,
  RuleInstance,
  SimulationBeaconJob,
  SimulationBeaconParameters,
  SimulationIteration,
  SimulationPostResponse,
  VarThresholdData,
} from '@/apis';
import StepButtons from '@/components/library/StepButtons';
import Button from '@/components/library/Button';
import Tabs from '@/components/library/Tabs';
import { Progress } from '@/components/Simulation/Progress';
import {
  EMPTY_THRESHOLD_DATA,
  updateCurrentInstance,
  UPDATED_VAR_DATA_KEY,
} from '@/utils/ruleThreshold';
import DownloadAsPDF from '@/components/DownloadAsPdf/DownloadAsPDF';
import { usePrevious, useSafeLocalStorageState } from '@/utils/hooks';

const DUPLICATE_TAB_KEY = 'duplicate';
const MAX_SIMULATION_ITERATIONS = 3;
const POLL_STATUS_INTERVAL_SECONDS = 10;
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
  const [demoMode] = useDemoMode();
  const isDemoMode = getOr(demoMode, false);
  const [showDemoProgress, setShowDemoProgress] = useState(false);
  const { v8Mode, ruleInstance, onCancel, onRuleInstanceUpdated, rule } = props;
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  const [showValidationError, setShowValidationError] = useState(false);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const steps = v8Mode ? STEPS : RULE_CONFIGURATION_STEPS;
  const [activeStepKey, setActiveStepKey] = useState(steps[0]);
  const [simulationVarUpdatedData] = useSafeLocalStorageState<VarThresholdData>(
    UPDATED_VAR_DATA_KEY,
    EMPTY_THRESHOLD_DATA,
  );
  const updatedDefaultInstance = simulationVarUpdatedData.varKey
    ? updateCurrentInstance(ruleInstance, simulationVarUpdatedData)
    : ruleInstance;

  useEffect(() => {
    const key = 'UPDATED_VAR_DATA';
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
    }
  }, []);

  const [newIterations, setNewIterations] = useState<SimulationBeaconParameters[]>([
    {
      ...DEFAULT_ITERATION,
      ruleInstance: updatedDefaultInstance,
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
                {
                  ...iteration.ruleInstance,
                  ruleRunMode: 'LIVE',
                  ruleExecutionMode: 'SYNC',
                },
                formValues as RuleConfigurationFormV8Values,
                isRiskLevelsEnabled,
              )
            : formValuesToRuleInstance(
                {
                  ...iteration.ruleInstance,
                  ruleRunMode: 'LIVE',
                  ruleExecutionMode: 'SYNC',
                },
                formValues as RuleConfigurationFormValues,
                isRiskLevelsEnabled,
              )
          : iteration.ruleInstance ?? ruleInstance,
        ...(formValues?.basicDetailsStep.simulationIterationTimeRange
          ? {
              sampling: {
                transactionsCount: 10_000,
                filters: {
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
        SimulationPostRequest: {
          beaconParameters: {
            type: 'BEACON',
            parameters: iterations,
            defaultRuleInstance: ruleInstance,
          },
        },
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
          : isDemoMode
          ? 9000
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
      if (isDemoMode) {
        setShowDemoProgress(true);
        setTimeout(() => setShowDemoProgress(false), 5000);
      }
      startSimulationMutation.mutate(newIterations);
    }
  }, [
    activeTabIndex,
    isRiskLevelsEnabled,
    iterationFormRefs,
    startSimulationMutation,
    syncFormValues,
    v8Mode,
    isDemoMode,
  ]);

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
  }, [prevRuleInstance, ruleInstance]);
  const isShowingResults = useMemo(
    () => Boolean(startSimulationMutation.isLoading || jobId),
    [jobId, startSimulationMutation.isLoading],
  );
  const iterations = useMemo(() => {
    return jobId && isSuccess(jobResult.data)
      ? jobResult.data?.value.iterations.map((iteration) => {
          return {
            ...iteration.parameters,
            taskId: iteration.taskId,
          };
        }) ?? []
      : newIterations.map((iteration) => {
          return {
            ...iteration,
            taskId: undefined,
          };
        });
  }, [jobId, jobResult.data, newIterations]);
  const iterationResults = useMemo(() => {
    if (!jobId) {
      return [];
    }

    if (jobId && isSuccess(jobResult.data)) {
      return jobResult.data.value.iterations ?? [];
    } else if (isResourceLoading(jobResult.data)) {
      return jobResult.data.lastValue?.iterations ?? [];
    }
    return [];
  }, [jobId, jobResult.data]);
  const isLoading = useMemo(() => {
    return Boolean(
      startSimulationMutation.isLoading ||
        (jobId &&
          !(
            isSuccess(jobResult.data) &&
            jobResult.data.value?.iterations &&
            allIterationsCompleted(jobResult.data.value.iterations)
          )),
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

  const [pdfRef, setPdfRef] = useState<HTMLElement | null>(null);
  const handleReportDownload = async () => {
    const hideMessage = message.loading('Downloading report...');

    if (pdfRef == null) {
      return;
    }

    try {
      if (pdfRef) {
        await DownloadAsPDF({
          pdfRef: Array.from(pdfRef.children)
            .map((x) => (x instanceof HTMLElement ? x : null))
            .filter(notEmpty),
          fileName: `rule-simulation-result-${ruleInstance.id}-report.pdf`,
          reportTitle: 'Simulation result report',
        });
      }
      message.success('Report successfully downloaded');
    } catch (err) {
      message.fatal('Unable to complete the download!', err);
    } finally {
      hideMessage();
    }
  };

  const allSimulationsDone = iterations.every((iteration, i) => {
    return (iterationResults[i]?.latestStatus?.status ?? 'SUCCESS') === 'SUCCESS';
  });

  return (
    <div className={s.root}>
      <div className={s.pdfTarget}>
        <div ref={setPdfRef}>
          {iterations.map((iteration, i) => {
            return (
              <div key={i}>
                {iterationResults.length > 0 && iterationResults[i].progress < 0.1 ? (
                  <div className={s.loadingCard}>
                    <Progress
                      simulationStartedAt={iterationResults[i]?.createdAt}
                      width="HALF"
                      progress={(iterationResults[i]?.progress ?? 0) * 100}
                      message="Running the simulation on subset of transactions & generating results for you."
                      status={iterationResults[i]?.latestStatus?.status ?? 'SUCCESS'}
                      totalEntities={iterationResults[i]?.totalEntities ?? 0}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      breakBefore: 'page',
                    }}
                  >
                    {jobId && (
                      <div>
                        <Label label={iteration.name}>{iteration.description}</Label>
                      </div>
                    )}
                    {jobId && (
                      <div className={s.result} ref={setPdfRef}>
                        {iterationResults.length > 0 ? (
                          <SimulationStatistics pdfMode={true} iteration={iterationResults[i]} />
                        ) : undefined}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
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
            children:
              (iterationResults.length > 0 && iterationResults[i].progress < 0.1) ||
              (isDemoMode && showDemoProgress) ? (
                <div className={s.loadingCard}>
                  <Progress
                    simulationStartedAt={iterationResults[i]?.createdAt}
                    width="HALF"
                    progress={(iterationResults[i]?.progress ?? 0) * 100}
                    message="Running the simulation on subset of transactions & generating results for you."
                    status={
                      showDemoProgress
                        ? 'IN_PROGRESS'
                        : iterationResults[i]?.latestStatus?.status ?? 'SUCCESS'
                    }
                    totalEntities={iterationResults[i]?.totalEntities ?? 0}
                  />
                </div>
              ) : (
                <>
                  {jobId && (
                    <div>
                      <Label label={iteration.name}>{iteration.description}</Label>
                    </div>
                  )}
                  {jobId && (
                    <div className={s.result}>
                      {iterationResults.length > 0 ? (
                        <SimulationStatistics iteration={iterationResults[i]} />
                      ) : undefined}
                      {iterations[i].taskId && (
                        <SimulationTransactionsHit taskId={iterations[i].taskId as string} />
                      )}
                      {iterations[i].taskId && (
                        <SimulationUsersHit taskId={iterations[i].taskId as string} />
                      )}
                      <H4>Changed rule parameters</H4>
                    </div>
                  )}

                  {v8Mode ? (
                    <RuleConfigurationFormV8
                      mode={'CREATE'}
                      ref={iterationFormRefs[i] as Ref<FormRef<RuleConfigurationFormV8Values>>}
                      rule={rule}
                      formInitialValues={merge(
                        ruleInstanceToFormValuesV8(isRiskLevelsEnabled, iteration.ruleInstance),
                        {
                          basicDetailsStep: {
                            simulationIterationName: iteration.name,
                            simulationIterationDescription: iteration.description,
                            ...(iteration?.sampling?.filters?.afterTimestamp
                              ? {
                                  simulationIterationTimeRange: {
                                    start: iteration.sampling.filters.afterTimestamp,
                                    end: iteration.sampling.filters.beforeTimestamp,
                                  },
                                }
                              : {}),
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
                            ...(iteration?.sampling?.filters?.afterTimestamp
                              ? {
                                  simulationIterationTimeRange: {
                                    start: iteration.sampling.filters.afterTimestamp,
                                    end: iteration.sampling.filters.beforeTimestamp,
                                  },
                                }
                              : {}),
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
        <div className={s.footerButtons}>
          {!jobId && (
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
        </div>
        <div className={s.footerButtons}>
          <Button type="TETRIARY" onClick={onCancel}>
            Cancel
          </Button>
          {isShowingResults && allSimulationsDone && !isLoading && (
            <Button onClick={handleReportDownload} type={'TETRIARY'}>
              PDF report
            </Button>
          )}
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
