import { useState } from 'react';
import ProgressBar from '.';
import { UseCase } from '@/pages/storybook/components';
import Slider from '@/components/library/Slider';
import Label from '@/components/library/Label';

export default function () {
  const [value, setValue] = useState(100);
  const [maxValue, setMaxValue] = useState(1000);
  return (
    <>
      <Label label={'Value'}>
        <Slider mode={'SINGLE'} value={value} onChange={setValue} min={0} max={1000} />
      </Label>
      <Label label={'Max value'}>
        <Slider mode={'SINGLE'} value={maxValue} onChange={setMaxValue} min={0} max={1000} />
      </Label>
      <UseCase title={'Basic use case'}>
        <ProgressBar value={value / maxValue} />
      </UseCase>
      <UseCase title={'With max value'}>
        <ProgressBar value={value} maxValue={maxValue} />
      </UseCase>
      <UseCase title={'Show percentage'}>
        <ProgressBar value={value} maxValue={maxValue} showPercentage={true} />
      </UseCase>
    </>
  );
}
