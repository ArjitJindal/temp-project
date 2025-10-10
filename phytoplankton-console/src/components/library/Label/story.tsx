import React, { useState } from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import TextInput from '@/components/library/TextInput';
import Checkbox from '@/components/library/Checkbox';

export default function (): JSX.Element {
  const [textValue, setTextValue] = useState<undefined | string>('');
  const [checkboxValue, setCheckboxValue] = useState<undefined | boolean>(false);
  return (
    <>
      <UseCase title={'Basic case'}>
        <Component label="Label text">
          <TextInput value={textValue} onChange={setTextValue} />
        </Component>
        <Component label="Optional label" required={{ value: true, showHint: true }}>
          <TextInput value={textValue} onChange={setTextValue} />
        </Component>
      </UseCase>
      <UseCase title={'Checkbox-mode'}>
        <Component label="Label to the right of the input" position="RIGHT" level={2}>
          <Checkbox value={checkboxValue} onChange={setCheckboxValue} />
        </Component>
      </UseCase>
      <UseCase title={'Different levels'}>
        <Component label="Level 1" level={1}>
          <TextInput value={textValue} onChange={setTextValue} />
        </Component>
        <Component label="Level 2" level={2}>
          <TextInput value={textValue} onChange={setTextValue} />
        </Component>
        <Component label="Level 3" level={3}>
          <TextInput value={textValue} onChange={setTextValue} />
        </Component>
      </UseCase>
      <UseCase title={'Description'}>
        <Component label="Default position" description="Some details about field">
          <TextInput value={textValue} onChange={setTextValue} />
        </Component>
        <Component
          label="Right position"
          description="Some details about field"
          position="RIGHT"
          level={2}
        >
          <Checkbox value={checkboxValue} onChange={setCheckboxValue} />
        </Component>
      </UseCase>
    </>
  );
}
