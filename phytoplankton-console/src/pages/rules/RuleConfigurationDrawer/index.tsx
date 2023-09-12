import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePrevious } from 'ahooks';
import { EditOutlined } from '@ant-design/icons';
import { Tabs, Tooltip } from 'antd';
import { cloneDeep, isEqual, merge } from 'lodash';
import { useMutation } from '@tanstack/react-query';
import {
  formValuesToRuleInstance,
  ruleInstanceToFormValues,
  useCreateRuleInstance,
  useUpdateRuleInstance,
} from '../utils';
import s from './style.module.less';
import RuleConfigurationForm, {
  RULE_CONFIGURATION_STEPS,
  RuleConfigurationFormValues,
} from './RuleConfigurationForm';
import { SimulationStatistics } from './SimulationStatistics';
import ArrowLeftSLineIcon from '@/components/ui/icons/Remix/system/arrow-left-s-line.react.svg';
import ArrowRightSLineIcon from '@/components/ui/icons/Remix/system/arrow-right-s-line.react.svg';
import AddLineIcon from '@/components/ui/icons/Remix/system/add-line.react.svg';
import { isSuccess } from '@/utils/asyncResource';
import Button from '@/components/library/Button';
import {
  Rule,
  RuleInstance,
  SimulationBeaconJob,
  SimulationBeaconParameters,
  SimulationBeaconParametersRequest,
  SimulationIteration,
  SimulationPostResponse,
} from '@/apis';
import Drawer from '@/components/library/Drawer';
import StepButtons from '@/components/library/StepButtons';
import { FormRef } from '@/components/library/Form';
import PageTabs from '@/components/ui/PageTabs';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import { LoadingCard } from '@/components/ui/Card';
import { SIMULATION_JOB } from '@/utils/queries/keys';
import { H4 } from '@/components/ui/Typography';
import Label from '@/components/library/Label';
import { getErrorMessage } from '@/utils/lang';
import { useQuery } from '@/utils/queries/hooks';

interface RuleConfigurationDrawerProps {
  rule?: Rule | null;
  ruleInstance?: RuleInstance;
  isVisible: boolean;
  onChangeVisibility: (isVisible: boolean) => void;
  readOnly?: boolean;
  isClickAwayEnabled?: boolean;
  onChangeToEditMode?: () => void;
  onRuleInstanceUpdated?: (ruleInstance: RuleInstance) => void;
  type: 'EDIT' | 'CREATE' | 'DUPLICATE' | 'READ';
}

export default function RuleConfigurationDrawer(props: RuleConfigurationDrawerProps) {
  const {
    isVisible,
    onChangeVisibility,
    rule,
    readOnly = false,
    ruleInstance,
    type,
    onRuleInstanceUpdated,
  } = props;
  const [activeStepKey, setActiveStepKey] = useState(RULE_CONFIGURATION_STEPS[0]);
  const activeStepIndex = RULE_CONFIGURATION_STEPS.findIndex((key) => key === activeStepKey);
  const formRef = useRef<FormRef<RuleConfigurationFormValues>>(null);
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  const formInitialValues = ruleInstanceToFormValues(isRiskLevelsEnabled, ruleInstance);
  const [isValuesSame, setIsValuesSame] = useState(
    isEqual(formInitialValues, formRef.current?.getValues()),
  );
  const prevIsVisible = usePrevious(isVisible);
  const updateRuleInstanceMutation = useUpdateRuleInstance(onRuleInstanceUpdated);
  const createRuleInstanceMutation = useCreateRuleInstance(onRuleInstanceUpdated);
  const handleSubmit = useCallback(
    (formValues: RuleConfigurationFormValues) => {
      if (type === 'EDIT' && ruleInstance) {
        updateRuleInstanceMutation.mutate(
          formValuesToRuleInstance(ruleInstance, formValues, isRiskLevelsEnabled),
        );
      } else if ((type === 'CREATE' || type === 'DUPLICATE') && rule) {
        createRuleInstanceMutation.mutate(
          formValuesToRuleInstance(
            { ruleId: rule.id } as RuleInstance,
            formValues,
            isRiskLevelsEnabled,
          ),
        );
      }
    },
    [
      createRuleInstanceMutation,
      isRiskLevelsEnabled,
      rule,
      ruleInstance,
      type,
      updateRuleInstanceMutation,
    ],
  );
  useEffect(() => {
    if (prevIsVisible !== isVisible) {
      setActiveStepKey(RULE_CONFIGURATION_STEPS[0]);
    }
  }, [activeStepKey, isVisible, prevIsVisible]);

  const isMutableOnly = useMemo(() => {
    return ['CREATE', 'EDIT', 'DUPLICATE'].includes(type) && !readOnly;
  }, [type, readOnly]);

  return (
    <Drawer
      isVisible={isVisible}
      onChangeVisibility={onChangeVisibility}
      title={
        props.type === 'EDIT'
          ? `${rule?.id} (${formInitialValues?.basicDetailsStep?.ruleInstanceId})`
          : props.type === 'DUPLICATE'
          ? `Duplicate ${rule?.id} (${formInitialValues?.basicDetailsStep?.ruleName})`
          : 'Configure rule'
      }
      description={
        readOnly
          ? props.type === 'EDIT'
            ? `View the configured parameters of the rule. Click on ‘Edit’ to update the parameters.`
            : 'Read all relevant rule information'
          : props.type === 'EDIT'
          ? `Edit the parameters of the rule. Click on ‘Save’ to update the rule`
          : 'Add all relevant information to configure this rule'
      }
      isClickAwayEnabled={props.isClickAwayEnabled}
      footer={
        <div className={isMutableOnly ? s.footerEnd : s.footer}>
          {type === 'EDIT' && readOnly && (
            <StepButtons
              nextDisabled={activeStepIndex === RULE_CONFIGURATION_STEPS.length - 1}
              prevDisabled={activeStepIndex === 0}
              onNext={() => {
                const nextStep = RULE_CONFIGURATION_STEPS[activeStepIndex + 1];
                setActiveStepKey(nextStep);
              }}
              onPrevious={() => {
                const prevStep = RULE_CONFIGURATION_STEPS[activeStepIndex - 1];
                setActiveStepKey(prevStep);
              }}
            />
          )}
          <div className={s.footerButtons}>
            {readOnly && type === 'EDIT' && (
              <Button type="TETRIARY" onClick={() => onChangeVisibility(false)}>
                Cancel
              </Button>
            )}
            {isMutableOnly && (
              <Button
                type="TETRIARY"
                onClick={() => {
                  const prevStep = RULE_CONFIGURATION_STEPS[activeStepIndex - 1];
                  setActiveStepKey(prevStep);
                }}
                icon={<ArrowLeftSLineIcon />}
                isDisabled={activeStepIndex === 0}
              >
                Previous
              </Button>
            )}
            {isMutableOnly && activeStepIndex !== 2 && (
              <Button
                type="SECONDARY"
                onClick={() => {
                  const nextStep = RULE_CONFIGURATION_STEPS[activeStepIndex + 1];
                  setActiveStepKey(nextStep);
                }}
                isDisabled={activeStepIndex === RULE_CONFIGURATION_STEPS.length - 1}
                iconRight={<ArrowRightSLineIcon />}
              >
                Next
              </Button>
            )}
            {(!readOnly || ['CREATE', 'DUPLICATE'].includes(type)) && activeStepIndex === 2 && (
              <>
                {isValuesSame && ['DUPLICATE'].includes(type) ? (
                  <Tooltip
                    placement="topRight"
                    title="Rule parameters have not changed. To save the rule, please modify some rule parameters."
                  >
                    <div>
                      <Button isDisabled={true}>{props.type === 'CREATE' ? 'Done' : 'Save'}</Button>
                    </div>
                  </Tooltip>
                ) : (
                  <Button
                    htmlType="submit"
                    isLoading={
                      updateRuleInstanceMutation.isLoading || createRuleInstanceMutation.isLoading
                    }
                    isDisabled={readOnly}
                    onClick={() => {
                      formRef?.current?.submit();
                    }}
                  >
                    {props.type === 'CREATE' ? 'Done' : 'Save'}
                  </Button>
                )}
              </>
            )}
            {readOnly && type === 'EDIT' && (
              <Button
                type="SECONDARY"
                onClick={() => {
                  if (props.onChangeToEditMode) {
                    props.onChangeToEditMode();
                  }
                }}
                icon={<EditOutlined />}
              >
                Edit
              </Button>
            )}
          </div>
        </div>
      }
    >
      <RuleConfigurationForm
        key={`${isVisible}`}
        ref={formRef}
        rule={rule}
        formInitialValues={formInitialValues}
        readOnly={readOnly}
        activeStepKey={activeStepKey}
        onSubmit={handleSubmit}
        onActiveStepKeyChange={setActiveStepKey}
        setIsValuesSame={setIsValuesSame}
      />
    </Drawer>
  );
}

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

interface RuleConfigurationSimulationDrawerProps {
  rule?: Rule;
  ruleInstance: RuleInstance;
  isVisible: boolean;
  jobId?: string;
  onChangeVisibility: (isVisible: boolean) => void;
  onRuleInstanceUpdated?: (ruleInstance: RuleInstance) => void;
}
export function RuleConfigurationSimulationDrawer(props: RuleConfigurationSimulationDrawerProps) {
  const { isVisible, ruleInstance, onChangeVisibility, onRuleInstanceUpdated, rule } = props;
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  const [showValidationError, setShowValidationError] = useState(false);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [activeStepKey, setActiveStepKey] = useState(RULE_CONFIGURATION_STEPS[0]);
  const [newIterations, setNewIterations] = useState<SimulationBeaconParameters[]>([
    {
      ...DEFAULT_ITERATION,
      ruleInstance,
    },
  ]);
  const [createdJobId, setCreatedJobId] = useState<string | undefined>();
  const jobId = useMemo(() => createdJobId ?? props.jobId, [createdJobId, props.jobId]);
  const activeStepIndex = RULE_CONFIGURATION_STEPS.findIndex((key) => key === activeStepKey);
  const formRef1 = useRef<FormRef<RuleConfigurationFormValues>>(null);
  const formRef2 = useRef<FormRef<RuleConfigurationFormValues>>(null);
  const formRef3 = useRef<FormRef<RuleConfigurationFormValues>>(null);
  const iterationFormRefs = useMemo(
    () => [formRef1, formRef2, formRef3],
    [formRef1, formRef2, formRef3],
  );
  const syncFormValues = useCallback(() => {
    const updatedIterations = newIterations.map((iteration, i) => {
      const formValues = iterationFormRefs[i].current?.getValues();
      return formValues
        ? {
            ...iteration,
            name: formValues.basicDetailsStep.simulationIterationName || '',
            description: formValues.basicDetailsStep.simulationIterationDescription || '',
            ruleInstance: iterationFormRefs[i].current
              ? formValuesToRuleInstance(ruleInstance, formValues, isRiskLevelsEnabled)
              : iteration.ruleInstance ?? ruleInstance,
          }
        : iteration;
    });
    setNewIterations(updatedIterations);
    return updatedIterations;
  }, [isRiskLevelsEnabled, iterationFormRefs, newIterations, ruleInstance]);
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
        SimulationPulseParametersRequest___SimulationBeaconParametersRequest: {
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
  const jobResult = useQuery(
    SIMULATION_JOB(jobId!),
    () =>
      api.getSimulationTestId({
        jobId: jobId!,
      }) as Promise<SimulationBeaconJob>,
    {
      refetchInterval: (data) =>
        allIterationsCompleted(data?.iterations || [])
          ? false
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
          ruleInstanceToFormValues(isRiskLevelsEnabled, iteration.ruleInstance),
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
  ]);

  const prevIsVisible = usePrevious(isVisible);
  const prevRuleInstance = usePrevious(ruleInstance);
  useEffect(() => {
    if (prevIsVisible !== isVisible) {
      // Reset states
      startSimulationMutation.reset();
      setCreatedJobId(undefined);
      setShowValidationError(false);
      setActiveStepKey(RULE_CONFIGURATION_STEPS[0]);
      setActiveTabIndex(0);
      setNewIterations([
        {
          ...DEFAULT_ITERATION,
          ruleInstance,
        },
      ]);
    }
    if (!prevRuleInstance && ruleInstance) {
      setNewIterations([
        {
          ...DEFAULT_ITERATION,
          ruleInstance,
        },
      ]);
    }
  }, [
    activeStepKey,
    isVisible,
    prevIsVisible,
    prevRuleInstance,
    ruleInstance,
    startSimulationMutation,
  ]);
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

  return (
    <Drawer
      isVisible={isVisible}
      onChangeVisibility={onChangeVisibility}
      title={isShowingResults ? 'Simulation results' : 'New simulation'}
      description="Run a simulation using different parameters to see how the rule performs on the existing transactions to make informed decisions."
      isClickAwayEnabled={true}
      footer={
        <div className={s.footer}>
          {jobId ? (
            <div>{/* placeholder invisible component */}</div>
          ) : (
            <StepButtons
              nextDisabled={activeStepIndex === RULE_CONFIGURATION_STEPS.length - 1}
              prevDisabled={activeStepIndex === 0}
              onNext={() => {
                const nextStep = RULE_CONFIGURATION_STEPS[activeStepIndex + 1];
                setActiveStepKey(nextStep);
              }}
              onPrevious={() => {
                const prevStep = RULE_CONFIGURATION_STEPS[activeStepIndex - 1];
                setActiveStepKey(prevStep);
              }}
            />
          )}
          <div className={s.footerButtons}>
            <Button type="TETRIARY" onClick={() => onChangeVisibility(false)}>
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
              >
                {iterations[activeTabIndex]?.ruleInstance?.id ? 'Update rule' : 'Create rule'}
              </Button>
            ) : (
              <Button isLoading={startSimulationMutation.isLoading} onClick={handleStartSimulation}>
                Run simulation
              </Button>
            )}
          </div>
        </div>
      }
    >
      <PageTabs
        key={`${isVisible}`}
        isPrimary={false}
        type="card"
        activeKey={`${activeTabIndex}`}
        onChange={handleChangeIterationTab}
        destroyInactiveTabPane
      >
        {iterations.map((iteration, i) => {
          return (
            <Tabs.TabPane tab={`Iteration ${i + 1}`} key={`${i}`}>
              {isLoading ? (
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
                      {isSuccess(jobResult.data) ? (
                        <SimulationStatistics iteration={jobResult.data.value.iterations[i]} />
                      ) : undefined}
                      <H4>Changed rule parameters</H4>
                    </div>
                  )}
                  <RuleConfigurationForm
                    key={iteration.ruleInstance?.ruleId}
                    readOnly={Boolean(jobId)}
                    ref={iterationFormRefs[i]}
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
                </>
              )}
            </Tabs.TabPane>
          );
        })}
        {iterations.length < MAX_SIMULATION_ITERATIONS && !isShowingResults && (
          <Tabs.TabPane
            tab={
              <Tooltip
                title="You can simulate a maximum of 3 iterations for this rule at once."
                placement="bottom"
              >
                <div onClick={handleDuplicate} className={s.duplicateButton}>
                  <AddLineIcon width={20} /> <span>Duplicate</span>
                </div>
              </Tooltip>
            }
            key={DUPLICATE_TAB_KEY}
          ></Tabs.TabPane>
        )}
      </PageTabs>
    </Drawer>
  );
}
