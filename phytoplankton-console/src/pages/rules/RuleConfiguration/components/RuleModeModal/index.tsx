import s from './styles.module.less';
import { RuleRunMode } from '@/apis';
import Modal from '@/components/library/Modal';
import SelectionGroup, { Option } from '@/components/library/SelectionGroup';

const RULE_MODE_OPTIONS: Option<RuleRunMode>[] = [
  {
    value: 'LIVE',
    label: 'Live rule',
    description:
      'A live rule deploys the model and generates alerts when triggered. It is suggested for rules that do not require validation.',
  },
  {
    value: 'SHADOW',
    label: 'Shadow rule',
    description:
      'A shadow rule processes live transaction data but does not generate alerts. It helps monitor model performance before deploying it live.',
  },
];

type Props = {
  isOpen: boolean;
  onCancel: () => void;
  ruleId: string;
  onOk: () => void;
  ruleMode: RuleRunMode;
  onChangeRuleMode: (mode: RuleRunMode) => void;
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
