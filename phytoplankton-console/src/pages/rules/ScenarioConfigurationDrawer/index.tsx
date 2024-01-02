import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePrevious } from 'ahooks';
import { EditOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import { isEqual } from 'lodash';
import { ruleInstanceToFormValues, useCreateRuleInstance, useUpdateRuleInstance } from '../utils';
import s from './style.module.less';
import ScenarioConfigurationForm, {
  STEPS,
  ScenarioConfigurationFormValues,
} from './ScenarioConfigurationForm';
import ArrowLeftSLineIcon from '@/components/ui/icons/Remix/system/arrow-left-s-line.react.svg';
import ArrowRightSLineIcon from '@/components/ui/icons/Remix/system/arrow-right-s-line.react.svg';
import Button from '@/components/library/Button';
import { Rule, RuleInstance } from '@/apis';
import Drawer from '@/components/library/Drawer';
import StepButtons from '@/components/library/StepButtons';
import { FormRef } from '@/components/library/Form';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

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

export default function ScenarioConfigurationDrawer(props: RuleConfigurationDrawerProps) {
  const {
    isVisible,
    onChangeVisibility,
    rule,
    readOnly = false,
    ruleInstance,
    type,
    onRuleInstanceUpdated,
  } = props;
  const [activeStepKey, setActiveStepKey] = useState(STEPS[0]);
  const activeStepIndex = STEPS.findIndex((key) => key === activeStepKey);
  const formRef = useRef<FormRef<ScenarioConfigurationFormValues>>(null);
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  const formInitialValues = ruleInstanceToFormValues(isRiskLevelsEnabled, ruleInstance);
  const [isValuesSame, setIsValuesSame] = useState(
    isEqual(formInitialValues, formRef.current?.getValues()),
  );
  const prevIsVisible = usePrevious(isVisible);
  const updateRuleInstanceMutation = useUpdateRuleInstance(onRuleInstanceUpdated);
  const createRuleInstanceMutation = useCreateRuleInstance(onRuleInstanceUpdated);
  const handleSubmit = useCallback((formValues: ScenarioConfigurationFormValues) => {
    throw new Error(`Not implemented yet. ${JSON.stringify(formValues)}`);
  }, []);
  useEffect(() => {
    if (prevIsVisible !== isVisible) {
      setActiveStepKey(STEPS[0]);
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
          ? `Edit scenario`
          : props.type === 'DUPLICATE'
          ? `Duplicate scenario`
          : 'Create scenario'
      }
      isClickAwayEnabled={props.isClickAwayEnabled}
      footer={
        <div className={isMutableOnly ? s.footerEnd : s.footer}>
          {type === 'EDIT' && readOnly && (
            <StepButtons
              nextDisabled={activeStepIndex === STEPS.length - 1}
              prevDisabled={activeStepIndex === 0}
              onNext={() => {
                const nextStep = STEPS[activeStepIndex + 1];
                setActiveStepKey(nextStep);
              }}
              onPrevious={() => {
                const prevStep = STEPS[activeStepIndex - 1];
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
                  const prevStep = STEPS[activeStepIndex - 1];
                  setActiveStepKey(prevStep);
                }}
                icon={<ArrowLeftSLineIcon />}
                isDisabled={activeStepIndex === 0}
              >
                Previous
              </Button>
            )}
            {isMutableOnly && activeStepIndex !== STEPS.length - 1 && (
              <Button
                type="SECONDARY"
                onClick={() => {
                  const nextStep = STEPS[activeStepIndex + 1];
                  setActiveStepKey(nextStep);
                }}
                isDisabled={activeStepIndex === STEPS.length - 1}
                iconRight={<ArrowRightSLineIcon />}
                testName="drawer-next-button"
              >
                Next
              </Button>
            )}
            {(!readOnly || ['CREATE', 'DUPLICATE'].includes(type)) &&
              activeStepIndex === STEPS.length - 1 && (
                <>
                  {isValuesSame && ['DUPLICATE'].includes(type) ? (
                    <Tooltip
                      placement="topRight"
                      title="Rule parameters have not changed. To save the rule, please modify some rule parameters."
                    >
                      <div>
                        <Button isDisabled={true} requiredPermissions={['rules:my-rules:write']}>
                          {props.type === 'CREATE' ? 'Done' : 'Save'}
                        </Button>
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
                      requiredPermissions={['rules:my-rules:write']}
                      testName="drawer-create-save-button"
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
                requiredPermissions={['rules:my-rules:write']}
              >
                Edit
              </Button>
            )}
          </div>
        </div>
      }
    >
      <ScenarioConfigurationForm
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
