import { useState } from 'react';
import ProgressBar from '.';
import { UseCase } from '@/pages/storybook/components';
import Slider from '@/components/library/Slider';
import Label from '@/components/library/Label';

export default function () {
  const [value, setValue] = useState<number | undefined>(100);
  const [maxValue, setMaxValue] = useState<number | undefined>(1000);
  return (
    <>
      <Label label={'Value'}>
        <Slider mode={'SINGLE'} value={value} onChange={setValue} min={0} max={1000} />
      </Label>
      <Label label={'Max value'}>
        <Slider mode={'SINGLE'} value={maxValue} onChange={setMaxValue} min={0} max={1000} />
      </Label>
      <UseCase title={'Basic use case'}>
        <ProgressBar value={value} maxValue={maxValue} />
      </UseCase>
      <UseCase title={'Show percentage'}>
        <ProgressBar value={value} maxValue={maxValue} showPercentage={true} />
      </UseCase>
      <UseCase title={'Show percentage and value'}>
        <ProgressBar value={value} maxValue={maxValue} showPercentage={true} showValue={true} />
      </UseCase>
      <UseCase title={'Undefined state'}>
        <ProgressBar showPercentage={true} />
      </UseCase>
      <UseCase title={'Undefined state with value'}>
        <ProgressBar showPercentage={true} value={value} showValue={true} />
      </UseCase>
    </>
  );
}
