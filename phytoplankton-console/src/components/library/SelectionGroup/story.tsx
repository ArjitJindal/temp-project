import React, { useState } from 'react';
import Component, { SelectionGroupValueType } from './index';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  const [selected1, setSelected1] = useState<SelectionGroupValueType | undefined>(undefined);
  const [selected2, setSelected2] = useState<SelectionGroupValueType[] | undefined>([]);
  const [selected3, setSelected3] = useState<SelectionGroupValueType | undefined>('disabled');
  return (
    <>
      <UseCase title={'Radio-buttons mode'}>
        <Component
          mode="SINGLE"
          value={selected1}
          onChange={setSelected1}
          options={[
            { value: 'fraud', label: 'Fraud', tooltip: 'Options can have tooltips' },
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
      <UseCase title={'Number Options'}>
        <Component
          mode="MULTIPLE"
          value={selected2}
          onChange={setSelected2}
          options={[
            {
              value: 1,
              label: 'Customer friendly',
              description: 'Click on this radio button if you found us customer friendly',
            },
            {
              value: 2,
              label: 'Interactive usecase',
              description: 'Click on this radio button if you found our usecase interactive',
            },
            {
              value: 3,
              label: 'Value for money',
              description: 'Click on this radio button if you found out product value for money',
              isDisabled: true,
            },
          ]}
        />
      </UseCase>

      <UseCase title={'Boolean Options'}>
        <Component
          mode="SINGLE"
          value={selected1}
          onChange={setSelected1}
          options={[
            {
              value: true,
              label: 'Yes',
              description: 'Do you wanna confirm to make a transaction?',
            },
            { value: false, label: 'No', description: 'Do you wanna cancel your transaction? ' },
          ]}
        />
      </UseCase>
      <UseCase title={'Number Options'}>
        <Component
          mode="SINGLE"
          value={selected1}
          onChange={setSelected1}
          options={[
            { value: 1, label: '1 star Rating', description: 'Give our service a one star rating' },
            { value: 2, label: '2 star Rating', description: 'Give our service a two star rating' },
            {
              value: 3,
              label: '3 star Rating',
              description: 'Give our service a three star rating',
              isDisabled: true,
            },
          ]}
        />
      </UseCase>
    </>
  );
}
