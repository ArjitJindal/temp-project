import s from './index.module.less';
import { InputProps } from '@/components/library/Form';
import { UiSchemaNumberRange } from '@/components/library/JsonSchemaEditor/types';
import Slider from '@/components/library/Slider';

interface Props
  extends InputProps<{
    lowerBound: number;
    upperBound: number;
  }> {
  uiSchema: UiSchemaNumberRange;
}

export const NumberRangeInput = (props: Props) => {
  return (
    <div className={s.root}>
      <span>{props.uiSchema['ui:minimum']}</span>
      <Slider
        mode="RANGE"
        min={props.uiSchema['ui:minimum']}
        max={props.uiSchema['ui:maximum']}
        step={props.uiSchema['ui:multipleOf']}
        value={[
          props.value?.lowerBound ?? props.uiSchema['ui:minimum'],
          props.value?.upperBound ?? props.uiSchema['ui:maximum'],
        ]}
        onChange={(value) => {
          props.onChange?.({
            lowerBound: value?.[0] ?? props.uiSchema['ui:minimum'],
            upperBound: value?.[1] ?? props.uiSchema['ui:maximum'],
          });
        }}
      />
      <span>{props.uiSchema['ui:maximum']}</span>
    </div>
  );
};
