import { useEffect } from 'react';
import s from './styles.module.less';
import { RuleRunMode } from '@/apis';
import Modal from '@/components/library/Modal';
import SelectionGroup, { Option } from '@/components/library/SelectionGroup';
import { AsyncResource, isLoading, useFinishedSuccessfully } from '@/utils/asyncResource';

const RULE_MODE_OPTIONS: Option<RuleRunMode>[] = [
  {
    value: 'LIVE',
    label: 'Live rule',
    description:
      'A live rule deploys the model and generates alerts when triggered. It is recommended to test the rule parameters and operational impact by using the simulator and shadow rules prior to enabling a live rule.',
  },
  {
    value: 'SHADOW',
    label: 'Shadow rule',
    description:
      'A shadow rule processes live transaction data but does not generate alerts. It helps monitor model performance before deploying it live.',
  },
];

type Props = {
  submitRes: AsyncResource;
  isOpen: boolean;
  onCancel: () => void;
  ruleId: string;
  onOk: () => void;
  ruleMode: RuleRunMode;
  onChangeRuleMode: (mode: RuleRunMode) => void;
};

export const RuleModeModal = (props: Props) => {
  const { submitRes, isOpen, ruleMode, onChangeRuleMode, ruleId, onOk, onCancel } = props;
  const finishedSuccessfully = useFinishedSuccessfully(submitRes);
  useEffect(() => {
    if (finishedSuccessfully) {
      onCancel();
    }
  }, [finishedSuccessfully, onCancel]);
  return (
    <Modal
      isOpen={isOpen}
      onCancel={onCancel}
      title={`Configure rule ${ruleId}`}
      onOk={onOk}
      okText={isLoading(submitRes) ? 'Creating...' : 'Confirm'}
      okProps={{
        isLoading: isLoading(submitRes),
      }}
      cancelProps={{
        isLoading: isLoading(submitRes),
      }}
    >
      <div className={s.modalDescription}>
        <SelectionGroup<RuleRunMode>
          mode="SINGLE"
          options={RULE_MODE_OPTIONS}
          value={ruleMode}
          onChange={(value) => {
            onChangeRuleMode(value as RuleRunMode);
          }}
        />
      </div>
    </Modal>
  );
};
