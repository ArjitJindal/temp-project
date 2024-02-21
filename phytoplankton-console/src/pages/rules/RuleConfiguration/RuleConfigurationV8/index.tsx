import React, { useCallback, useRef, useState, useMemo } from 'react';
import { EditOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import { isEqual } from 'lodash';
import {
  formValuesToRuleInstanceV8,
  ruleInstanceToFormValuesV8,
  useCreateRuleInstance,
  useUpdateRuleInstance,
} from '../../utils';
import s from './style.module.less';
import RuleConfigurationFormV8, {
  STEPS,
  RuleConfigurationFormV8Values,
} from './RuleConfigurationFormV8';
import ArrowLeftSLineIcon from '@/components/ui/icons/Remix/system/arrow-left-s-line.react.svg';
import ArrowRightSLineIcon from '@/components/ui/icons/Remix/system/arrow-right-s-line.react.svg';
import Button from '@/components/library/Button';
import { Rule, RuleInstance } from '@/apis';
import { FormRef } from '@/components/library/Form';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

export type Mode = 'EDIT' | 'CREATE' | 'DUPLICATE' | 'READ';

export interface Props {
  rule?: Rule | null;
  ruleInstance?: RuleInstance;
  readOnly?: boolean;
  isClickAwayEnabled?: boolean;
  onChangeToEditMode?: () => void;
  onRuleInstanceUpdated?: (ruleInstance: RuleInstance) => void;
  onCancel: () => void;
  type: Mode;
}

export default function RuleConfigurationV8(props: Props) {
  const { rule, readOnly = false, ruleInstance, type, onRuleInstanceUpdated, onCancel } = props;
  const [activeStepKey, setActiveStepKey] = useState(STEPS[0]);
  const activeStepIndex = STEPS.findIndex((key) => key === activeStepKey);
  const formRef = useRef<FormRef<RuleConfigurationFormV8Values>>(null);
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  const formInitialValues = ruleInstanceToFormValuesV8(isRiskLevelsEnabled, ruleInstance);
  const [isValuesSame, setIsValuesSame] = useState(
    isEqual(formInitialValues, formRef.current?.getValues()),
  );
  const updateRuleInstanceMutation = useUpdateRuleInstance(onRuleInstanceUpdated);
  const createRuleInstanceMutation = useCreateRuleInstance(onRuleInstanceUpdated);
  const handleSubmit = useCallback(
    (formValues: RuleConfigurationFormV8Values) => {
      if (type === 'EDIT' && ruleInstance) {
        updateRuleInstanceMutation.mutate(
          formValuesToRuleInstanceV8(ruleInstance, formValues, isRiskLevelsEnabled),
        );
      } else if (type === 'CREATE' || type === 'DUPLICATE') {
        createRuleInstanceMutation.mutate(
          formValuesToRuleInstanceV8(
            { ruleId: rule?.id, type: rule?.type ?? 'TRANSACTION' } as RuleInstance,
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

  const isMutableOnly = useMemo(() => {
    return ['CREATE', 'EDIT', 'DUPLICATE'].includes(type) && !readOnly;
  }, [type, readOnly]);

  return (
    <div className={s.root}>
      <RuleConfigurationFormV8
        ref={formRef}
        rule={rule}
        formInitialValues={formInitialValues}
        readOnly={readOnly || type === 'READ'}
        activeStepKey={activeStepKey}
        onSubmit={handleSubmit}
        onActiveStepKeyChange={setActiveStepKey}
        setIsValuesSame={setIsValuesSame}
      />
      <div className={s.footerButtons}>
        {readOnly && type === 'EDIT' && (
          <Button type="TETRIARY" onClick={onCancel}>
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
            testName="drawer-next-button-v8"
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
        {type === 'READ' && (
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
  );
}
