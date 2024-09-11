import React, { useCallback, useMemo, useRef, useState } from 'react';
import { EditOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import {
  formValuesToRuleInstance,
  ruleInstanceToFormValues,
  useCreateRuleInstance,
  useUpdateRuleInstance,
} from '../../utils';
import { RuleModeModal } from '../components/RuleModeModal';
import s from './style.module.less';
import RuleConfigurationForm, {
  RULE_CONFIGURATION_STEPS,
  RuleConfigurationFormValues,
} from './RuleConfigurationForm';
import ArrowLeftSLineIcon from '@/components/ui/icons/Remix/system/arrow-left-s-line.react.svg';
import ArrowRightSLineIcon from '@/components/ui/icons/Remix/system/arrow-right-s-line.react.svg';
import Button from '@/components/library/Button';
import { Rule, RuleInstance, RuleRunMode } from '@/apis';
import StepButtons from '@/components/library/StepButtons';
import { FormRef } from '@/components/library/Form';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

export interface Props {
  rule?: Rule | null;
  ruleInstance?: RuleInstance;
  readOnly?: boolean;
  isClickAwayEnabled?: boolean;
  onChangeToEditMode?: () => void;
  onCancel?: () => void;
  onRuleInstanceUpdated?: (ruleInstance: RuleInstance) => void;
  type: 'EDIT' | 'CREATE' | 'DUPLICATE' | 'READ';
}

export default function RuleConfigurationV2(props: Props) {
  const { rule, readOnly = false, ruleInstance, type, onCancel, onRuleInstanceUpdated } = props;
  const [activeStepKey, setActiveStepKey] = useState(RULE_CONFIGURATION_STEPS[0]);
  const activeStepIndex = RULE_CONFIGURATION_STEPS.findIndex((key) => key === activeStepKey);
  const formRef = useRef<FormRef<RuleConfigurationFormValues>>(null);
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  const formInitialValues = ruleInstanceToFormValues(isRiskLevelsEnabled, ruleInstance);
  const [isValuesSame, setIsValuesSame] = useState(true);
  const [ruleMode, setRuleMode] = useState<RuleRunMode>('LIVE');
  const [isRuleModeModalOpen, setIsRuleModeModalOpen] = useState(false);
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
            {
              ruleId: rule.id,
              type: rule.type,
              ruleRunMode: ruleMode,
              ruleExecutionMode: 'SYNC',
            } as RuleInstance,
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
      ruleMode,
    ],
  );

  const isMutable = useMemo(() => ['CREATE', 'EDIT', 'DUPLICATE'].includes(type), [type]);

  return (
    <div className={s.root}>
      <RuleConfigurationForm
        ref={formRef}
        rule={rule}
        formInitialValues={formInitialValues}
        readOnly={readOnly || type === 'READ'}
        activeStepKey={activeStepKey}
        onSubmit={handleSubmit}
        onActiveStepKeyChange={setActiveStepKey}
        setIsValuesSame={setIsValuesSame}
      />
      <div className={s.footer}>
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
          {(readOnly || type === 'EDIT') && (
            <Button
              type="TETRIARY"
              onClick={() => {
                onCancel?.();
              }}
            >
              Cancel
            </Button>
          )}
          {isMutable && (
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
          {(type === 'EDIT' || activeStepIndex !== 2) && (
            <Button
              type="SECONDARY"
              onClick={() => {
                const nextStep = RULE_CONFIGURATION_STEPS[activeStepIndex + 1];
                setActiveStepKey(nextStep);
              }}
              isDisabled={activeStepIndex === RULE_CONFIGURATION_STEPS.length - 1}
              iconRight={<ArrowRightSLineIcon />}
              testName="drawer-next-button"
            >
              Next
            </Button>
          )}
          {!readOnly && (type === 'CREATE' || type === 'DUPLICATE') && activeStepIndex === 2 && (
            <>
              {isValuesSame && type === 'DUPLICATE' ? (
                <Tooltip
                  placement="topRight"
                  title="Rule parameters have not changed. To save the rule, please modify some rule parameters."
                >
                  <div>
                    <Button isDisabled={true} requiredPermissions={['rules:my-rules:write']}>
                      Create
                    </Button>
                  </div>
                </Tooltip>
              ) : (
                <Button
                  htmlType="submit"
                  isLoading={createRuleInstanceMutation.isLoading}
                  isDisabled={readOnly}
                  onClick={() => {
                    if (!formRef?.current?.validate()) {
                      formRef?.current?.submit(); // To show errors
                      return;
                    }

                    setIsRuleModeModalOpen(true);
                  }}
                  requiredPermissions={['rules:my-rules:write']}
                  testName="drawer-create-save-button"
                >
                  Create
                </Button>
              )}
            </>
          )}
          {!readOnly && type === 'EDIT' && (
            <Button
              htmlType="submit"
              isLoading={updateRuleInstanceMutation.isLoading}
              isDisabled={readOnly || isValuesSame}
              onClick={() => {
                formRef?.current?.submit(); // To show errors
              }}
              requiredPermissions={['rules:my-rules:write']}
              testName="drawer-create-save-button"
            >
              Save
            </Button>
          )}
          {!readOnly && type === 'READ' && (
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
        <RuleModeModal
          isOpen={isRuleModeModalOpen}
          ruleId={rule?.id || ''}
          onOk={() => {
            formRef?.current?.submit();
            setIsRuleModeModalOpen(false);
          }}
          ruleMode={ruleMode}
          onChangeRuleMode={setRuleMode}
          onCancel={() => setIsRuleModeModalOpen(false)}
        />
      </div>
    </div>
  );
}
