import { FormValues } from '../index';
import Label from '@/components/library/Label';
import NestedForm from '@/components/library/Form/NestedForm';
import { ExpandContentButton } from '@/components/library/ExpandContentButton';
import { UserStatusTriggersAdvancedOptionsForm } from '@/components/UserStatusTriggersAdvancedOptionsForm';
import { RuleType } from '@/apis';

interface Props {
  riskLevel?: string;
  ruleType?: RuleType;
}

export const AdvancedOptions = (props: Props) => {
  const { riskLevel, ruleType } = props;

  return (
    <ExpandContentButton suffixText="advanced options">
      <NestedForm<FormValues> name={riskLevel ? 'riskLevelsTriggersOnHit' : 'triggersOnHit'}>
        <Label
          label={'Advanced options'}
          description="Configured settings will automatically apply when the rule is triggered. In the case of this rule with multiple instances, the status is updated to reflect the highest priority set."
          required={{
            value: false,
            showHint: true,
          }}
        >
          {riskLevel ? (
            <NestedForm<FormValues['riskLevelsTriggersOnHit']> name={riskLevel}>
              <UserStatusTriggersAdvancedOptionsForm type="RULE" ruleType={ruleType} />
            </NestedForm>
          ) : (
            <UserStatusTriggersAdvancedOptionsForm type="RULE" ruleType={ruleType} />
          )}
        </Label>
      </NestedForm>
    </ExpandContentButton>
  );
};
