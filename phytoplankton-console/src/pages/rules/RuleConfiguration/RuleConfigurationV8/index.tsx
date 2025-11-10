import React, { useCallback, useMemo, useRef, useState } from 'react';
import { EditOutlined } from '@ant-design/icons';
import { formValuesToRuleInstanceV8, ruleInstanceToFormValuesV8 } from '../../utils';
import { RuleModeModal } from '../components/RuleModeModal';
import s from './style.module.less';
import RuleConfigurationFormV8, {
  RuleConfigurationFormV8Values,
  STEPS,
} from './RuleConfigurationFormV8';
import Tooltip from '@/components/library/Tooltip';
import { Rule, RuleInstance, RuleRunMode } from '@/apis';
import ArrowLeftSLineIcon from '@/components/ui/icons/Remix/system/arrow-left-s-line.react.svg';
import ArrowRightSLineIcon from '@/components/ui/icons/Remix/system/arrow-right-s-line.react.svg';
import Button from '@/components/library/Button';
import { FormRef } from '@/components/library/Form';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { isLoading } from '@/utils/asyncResource';
import Spinner from '@/components/library/Spinner';
import { useNewRuleId, useCreateRuleInstance, useUpdateRuleInstance } from '@/utils/api/rules';

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
  const [ruleMode, setRuleMode] = useState<RuleRunMode>('LIVE');
  const [isRuleModeModalOpen, setIsRuleModeModalOpen] = useState(false);
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  const settings = useSettings();
  const formInitialValues = ruleInstanceToFormValuesV8(isRiskLevelsEnabled, ruleInstance, settings);
  const [isValuesSame, setIsValuesSame] = useState(true);
  const queryResult = useNewRuleId(ruleInstance?.ruleId);
  const updateRuleInstanceMutation = useUpdateRuleInstance(onRuleInstanceUpdated);
  const createRuleInstanceMutation = useCreateRuleInstance(onRuleInstanceUpdated);
  const handleSubmit = useCallback(
    (formValues: RuleConfigurationFormV8Values) => {
      if (type === 'EDIT' && ruleInstance) {
        updateRuleInstanceMutation.mutate(
          formValuesToRuleInstanceV8(ruleInstance, formValues, isRiskLevelsEnabled, settings),
        );
      } else if (type === 'CREATE' || type === 'DUPLICATE') {
        createRuleInstanceMutation.mutate(
          formValuesToRuleInstanceV8(
            {
              ruleId: rule?.id ?? ruleInstance?.ruleId,
              type: rule?.type ?? 'TRANSACTION',
              ruleExecutionMode: 'SYNC',
              ruleRunMode: ruleMode,
            } as RuleInstance,
            formValues,
            isRiskLevelsEnabled,
            settings,
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
      settings,
    ],
  );

  const isMutable = useMemo(() => ['CREATE', 'EDIT', 'DUPLICATE'].includes(type), [type]);

  return (
    <div className={s.root}>
      <AsyncResourceRenderer
        resource={queryResult.data}
        renderLoading={() => (
          <Spinner>
            <RuleConfigurationFormV8
              mode={type}
              readOnly={true}
              activeStepKey={activeStepKey}
              onSubmit={handleSubmit}
              onActiveStepKeyChange={() => {}}
              newRuleId={undefined}
            />
          </Spinner>
        )}
      >
        {({ id: ruleInstanceId }) => (
          <>
            <RuleConfigurationFormV8
              ref={formRef}
              mode={type}
              rule={rule}
              formInitialValues={formInitialValues}
              readOnly={readOnly || type === 'READ'}
              activeStepKey={activeStepKey}
              onSubmit={handleSubmit}
              onActiveStepKeyChange={setActiveStepKey}
              setIsValuesSame={setIsValuesSame}
              newRuleId={type === 'EDIT' || type === 'READ' ? ruleInstance?.id : ruleInstanceId}
            />
            <RuleModeModal
              submitRes={
                (type === 'EDIT' ? updateRuleInstanceMutation : createRuleInstanceMutation)
                  .dataResource
              }
              ruleId={rule?.id ?? ruleInstance?.ruleId ?? ruleInstanceId ?? ''}
              isOpen={isRuleModeModalOpen}
              onOk={() => {
                formRef?.current?.submit();
              }}
              onCancel={() => setIsRuleModeModalOpen(false)}
              ruleMode={ruleMode}
              onChangeRuleMode={setRuleMode}
            />
          </>
        )}
      </AsyncResourceRenderer>
      <div className={s.footerButtons}>
        {(readOnly || type === 'EDIT') && (
          <Button type="TETRIARY" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {(isMutable || activeStepIndex !== 0) && (
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
        {(type === 'EDIT' || activeStepIndex !== STEPS.length - 1) && (
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
        {!readOnly &&
          (type === 'CREATE' || type === 'DUPLICATE') &&
          activeStepIndex === STEPS.length - 1 && (
            <>
              {isValuesSame && type === 'DUPLICATE' ? (
                <Tooltip
                  placement="topRight"
                  title="Rule parameters have not changed. To save the rule, please modify some rule parameters."
                >
                  <div>
                    <Button isDisabled={true} requiredResources={['write:::rules/my-rules/*']}>
                      Create
                    </Button>
                  </div>
                </Tooltip>
              ) : (
                <Button
                  htmlType="submit"
                  isLoading={isLoading(createRuleInstanceMutation.dataResource)}
                  isDisabled={readOnly}
                  onClick={() => {
                    if (!formRef?.current?.validate()) {
                      formRef?.current?.submit(); // To show errors
                      return;
                    }
                    setIsRuleModeModalOpen(true);
                  }}
                  requiredResources={['write:::rules/my-rules/*']}
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
            isLoading={
              isLoading(updateRuleInstanceMutation.dataResource) ||
              isLoading(createRuleInstanceMutation.dataResource)
            }
            isDisabled={readOnly || isValuesSame}
            onClick={() => {
              formRef?.current?.submit();
            }}
            requiredResources={['write:::rules/my-rules/*']}
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
            requiredResources={['write:::rules/my-rules/*']}
          >
            Edit
          </Button>
        )}
      </div>
    </div>
  );
}
