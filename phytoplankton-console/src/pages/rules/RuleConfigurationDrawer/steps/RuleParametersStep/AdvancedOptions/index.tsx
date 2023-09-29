import { FormValues } from '..';
import Label from '@/components/library/Label';
import NestedForm from '@/components/library/Form/NestedForm';
import { ExpandContentButton } from '@/components/library/ExpandContentButton';
import { UserStatusTriggersAdvancedOptionsForm } from '@/components/UserStatusTriggersAdvancedOptionsForm';

interface Props {
  riskLevel?: string;
}

export const AdvancedOptions = (props: Props) => {
  const { riskLevel } = props;

  return (
    <ExpandContentButton suffixText="advanced options">
      <NestedForm<FormValues> name={riskLevel ? 'riskLevelsTriggersOnHit' : 'triggersOnHit'}>
        <Label
          label={'Advanced options'}
          description="Configured settings will automatically apply when the rule is triggered. In the case of this rule with multiple instances, the status is updated to reflect the highest priority set."
        >
          {riskLevel ? (
            <NestedForm<FormValues['riskLevelsTriggersOnHit']> name={riskLevel}>
              <UserStatusTriggersAdvancedOptionsForm type="RULE" />
            </NestedForm>
          ) : (
            <UserStatusTriggersAdvancedOptionsForm type="RULE" />
          )}
        </Label>
      </NestedForm>
    </ExpandContentButton>
  );
};
