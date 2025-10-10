import { getSelectedRiskLevel, getSelectedRiskScore } from '../../../utils';
import { BasicDetailsFormValues } from '../../utils';
import s from './style.module.less';
import { PropertyListLayout } from '@/components/library/JsonSchemaEditor/PropertyList';
import * as Card from '@/components/ui/Card';
import InputField from '@/components/library/Form/InputField';
import TextInput from '@/components/library/TextInput';
import Slider from '@/components/library/Slider';
import RiskLevelSwitch from '@/components/library/RiskLevelSwitch';
import NumberInput from '@/components/library/NumberInput';
import { useRiskClassificationScores } from '@/utils/risk-levels';

interface Props {
  newRiskId?: string;
}
export const BasicDetailsStep = (props: Props) => {
  const { newRiskId } = props;
  const riskClassificationValues = useRiskClassificationScores();
  return (
    <div className={s.root}>
      <Card.Root>
        <Card.Section>
          <PropertyListLayout>
            <InputField<BasicDetailsFormValues, 'riskFactorId'>
              name={'riskFactorId'}
              label={'Risk Factor ID'}
              labelProps={{ required: true }}
            >
              {(inputProps) => <TextInput {...inputProps} value={newRiskId} isDisabled />}
            </InputField>
            <InputField<BasicDetailsFormValues, 'name'>
              name={'name'}
              label={'Risk factor name'}
              labelProps={{ required: { showHint: true, value: true } }}
            >
              {(inputProps) => <TextInput {...inputProps} placeholder={'Enter risk factor name'} />}
            </InputField>
            <InputField<BasicDetailsFormValues, 'description'>
              name={'description'}
              label={'Risk factor description'}
              labelProps={{ required: { showHint: true, value: true } }}
            >
              {(inputProps) => (
                <TextInput {...inputProps} placeholder={'Enter risk factor description'} />
              )}
            </InputField>
            <InputField<BasicDetailsFormValues, 'defaultRiskValue'>
              name={'defaultRiskValue'}
              label={'Default risk level'}
              labelProps={{ required: { showHint: true, value: true } }}
              description="Add a default risk level to consider for this risk factor if no risk factor value is defined during configuration."
            >
              {(inputProps) => (
                <div className={s.risklevelInput}>
                  <RiskLevelSwitch
                    {...inputProps}
                    value={getSelectedRiskLevel(inputProps.value, riskClassificationValues)}
                  />
                  <span>or</span>
                  <NumberInput
                    {...inputProps}
                    value={getSelectedRiskScore(inputProps.value, riskClassificationValues)}
                    min={0}
                    max={100}
                    placeholder="Enter risk score (0-100)"
                  />
                </div>
              )}
            </InputField>
            <InputField<BasicDetailsFormValues, 'defaultWeight'>
              name={'defaultWeight'}
              label={'Default risk weight'}
              labelProps={{ required: { showHint: true, value: true } }}
              description="Add a default risk weight to consider for this risk factor if no risk factor value is defined during configuration."
            >
              {(inputProps) => (
                <Slider
                  {...inputProps}
                  mode="SINGLE"
                  min={0.01}
                  max={1}
                  step={0.01}
                  textInput={{ min: 0.01, max: 1, step: 0.01 }}
                />
              )}
            </InputField>
          </PropertyListLayout>
        </Card.Section>
      </Card.Root>
    </div>
  );
};
