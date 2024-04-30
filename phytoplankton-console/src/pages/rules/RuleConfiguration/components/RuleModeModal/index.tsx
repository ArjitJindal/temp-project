import s from './styles.module.less';
import Modal from '@/components/library/Modal';
import SelectionGroup, { Option } from '@/components/library/SelectionGroup';
import { RuleInstance } from '@/apis';

const RULE_MODE_OPTIONS: Option<RuleInstance['mode']>[] = [
  {
    value: 'LIVE_SYNC',
    label: 'Live rule',
    description:
      'Live rule would be deploying the model and will generate alerts when hit. Suggested for rules which doesn’t require validation.',
  },
  {
    value: 'SHADOW_SYNC',
    label: 'Shadow rule',
    description:
      'Shadow rule would run the rule with live transaction data but would not be generating any alerts. It helps to monitor the model performance before deploying it live.',
  },
];

type Props = {
  isOpen: boolean;
  onCancel: () => void;
  ruleId: string;
  onOk: () => void;
  ruleMode: RuleInstance['mode'];
  onChangeRuleMode: (mode: RuleInstance['mode']) => void;
};

export const RuleModeModal = (props: Props) => {
  const { isOpen, ruleMode, onChangeRuleMode, ruleId, onOk, onCancel } = props;
  return (
    <Modal
      isOpen={isOpen}
      onCancel={onCancel}
      title={`Configure rule ${ruleId}`}
      onOk={onOk}
      okText="Confirm"
    >
      <div className={s.modalDescription}>
        <SelectionGroup<RuleInstance['mode']>
          mode="SINGLE"
          options={RULE_MODE_OPTIONS}
          value={ruleMode}
          onChange={(value) => {
            onChangeRuleMode(value as RuleInstance['mode']);
          }}
        />
      </div>
    </Modal>
  );
};
