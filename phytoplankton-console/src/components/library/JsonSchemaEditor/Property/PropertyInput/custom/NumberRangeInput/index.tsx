import s from './index.module.less';
import { InputProps } from '@/components/library/Form';
import { UiSchemaNumberSlider } from '@/components/library/JsonSchemaEditor/types';
import Slider, { RangeModeProps, SingleModeProps } from '@/components/library/Slider';

interface Props
  extends InputProps<{
    lowerBound: number;
    upperBound: number;
  }> {
  uiSchema: UiSchemaNumberSlider;
  mode: 'SINGLE' | 'RANGE';
}

export const NumberRangeInput = (props: Props) => {
  const { uiSchema, mode, value, onChange } = props;
  const min = uiSchema['ui:minimum'];
  const max = uiSchema['ui:maximum'];
  const step = uiSchema['ui:multipleOf'];
  let sliderProps: SingleModeProps | RangeModeProps;

  if (mode === 'SINGLE') {
    sliderProps = {
      mode,
      min,
      max,
      step,
      value: value?.upperBound ?? max,
      onChange: (v: number | undefined) => {
        onChange?.({
          lowerBound: min,
          upperBound: v ?? max,
        });
      },
    };
  } else {
    sliderProps = {
      mode,
      min,
      max,
      step,
      value: [value?.lowerBound ?? min, value?.upperBound ?? max],
      onChange: (v: [number, number] | undefined) => {
        const [lower, upper] = v ?? [min, max];
        onChange?.({
          lowerBound: lower ?? min,
          upperBound: upper ?? max,
        });
      },
    };
  }
  return (
    <div className={s.root}>
      <span>{uiSchema['ui:minimum']}</span>
      <Slider {...sliderProps} />
      <span>{uiSchema['ui:maximum']}</span>
    </div>
  );
};
