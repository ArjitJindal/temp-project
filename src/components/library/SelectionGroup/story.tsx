import React, { useState } from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  const [selected1, setSelected1] = useState<string>('disabled');
  const [selected2, setSelected2] = useState<string[]>([]);
  const [selected3, setSelected3] = useState<string>('disabled');
  return (
    <>
      <UseCase title={'Radio-buttons mode'}>
        <Component
          mode="SINGLE"
          value={selected1}
          onChange={setSelected1}
          options={[
            { value: 'fraud', label: 'Fraud' },
            { value: 'aml', label: 'AML' },
            { value: 'disabled', label: 'Disabled option', isDisabled: true },
          ]}
        />
      </UseCase>
      <UseCase title={'Checkbox-buttons mode'}>
        <Component
          mode="MULTIPLE"
          value={selected2}
          onChange={setSelected2}
          options={[
            { value: 'fraud', label: 'Fraud' },
            { value: 'aml', label: 'AML' },
            { value: 'disabled', label: 'Disabled', isDisabled: true },
          ]}
        />
      </UseCase>

      <UseCase title={'With descriptions'}>
        <Component
          mode="SINGLE"
          value={selected3}
          onChange={setSelected3}
          options={[
            {
              value: 'fraud',
              label: 'Fraud',
              description:
                'Transactions that are hit for this rule will be added to the existing case until the case is CLOSED',
            },
            {
              value: 'aml',
              label: 'AML',
              description:
                'Transactions that are hit for this rule will be added as a new transaction case for each hit.',
            },
            {
              value: 'disabled',
              label: 'Disabled',
              description: 'This is a description of disabled option',
              isDisabled: true,
            },
          ]}
        />
      </UseCase>
    </>
  );
}
