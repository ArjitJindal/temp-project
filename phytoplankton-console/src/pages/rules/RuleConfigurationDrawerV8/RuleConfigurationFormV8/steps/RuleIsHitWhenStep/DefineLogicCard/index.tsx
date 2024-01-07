import ApplyToOtherLevelsCard from 'src/pages/rules/RuleConfigurationDrawerV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/DefineLogicCard/ApplyRiskLevels';
import { RuleIsHitWhenStepFormValues } from '..';
import { RuleLogicBuilder } from '../RuleLogicBuilder';
import s from './style.module.less';
import IfThen from './IfThen';
import RuleActionsCard from './RuleActionsCard';
import * as Card from '@/components/ui/Card';
import Label from '@/components/library/Label';
import RiskLevelSwitch from '@/components/library/RiskLevelSwitch';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { FieldState } from '@/components/library/Form/utils/hooks';

const TEMPORALY_DISABLED = false;

interface Props {
  variablesFieldState: FieldState<RuleIsHitWhenStepFormValues['ruleLogicAggregationVariables']>;
  logicFieldState: FieldState<RuleIsHitWhenStepFormValues['ruleLogic']>;
}

export default function DefineLogicCard(props: Props) {
  const { variablesFieldState, logicFieldState } = props;
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  return (
    <Card.Root>
      <Card.Section>
        <div className={s.cardHeader}>
          <Label
            required={true}
            label={'Rule logic'}
            description={
              'Using the above defined variables create a rule logic using operators for the rule to execute'
            }
          />
        </div>
      </Card.Section>
      <Card.Section>
        {isRiskLevelsEnabled && !TEMPORALY_DISABLED && (
          <RiskLevelSwitch
            value={'LOW'}
            onChange={(newRiskLevel) => {
              console.info('newRiskLevel', newRiskLevel);
            }}
          />
        )}
        <IfThen
          renderIf={
            <RuleLogicBuilder
              entityVariableTypes={['TRANSACTION', 'CONSUMER_USER', 'BUSINESS_USER']}
              jsonLogic={logicFieldState.value}
              aggregationVariables={variablesFieldState.value}
              onChange={logicFieldState.onChange!}
            />
          }
          renderThen={
            <div className={s.root}>
              <RuleActionsCard />
              {isRiskLevelsEnabled && !TEMPORALY_DISABLED && (
                <ApplyToOtherLevelsCard currentRiskLevel="HIGH" />
              )}
            </div>
          }
        />
      </Card.Section>
    </Card.Root>
  );
}
