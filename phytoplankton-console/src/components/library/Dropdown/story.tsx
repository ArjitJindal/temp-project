import React from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import CaseStatusTag from '@/components/library/Tag/CaseStatusTag';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Basic'}>
        <Component
          options={[
            { value: 'option1', label: 'First option' },
            { value: 'option2', label: 'Second option' },
            { value: 'option3', label: 'Third option', isDisabled: true },
          ]}
          onSelect={(option) => {
            alert(option.label);
          }}
        >
          <div>Test</div>
        </Component>
      </UseCase>
      <UseCase title={'Disabled'}>
        <Component
          disabled
          options={[
            { value: 'option1', label: 'First option' },
            { value: 'option2', label: 'Second option' },
          ]}
          onSelect={(option) => {
            alert(option.label);
          }}
        >
          <div>Test</div>
        </Component>
      </UseCase>
      <UseCase title={'With Tags'}>
        <Component
          options={[
            { value: 'ON_HOLD', label: <CaseStatusTag caseStatus={'OPEN_ON_HOLD'} /> },
            { value: 'IN_PROGRESS', label: <CaseStatusTag caseStatus={'OPEN_IN_PROGRESS'} /> },
          ]}
          onSelect={(option) => {
            alert(option.value);
          }}
          arrow={'FILLED'}
        >
          <div>
            <CaseStatusTag caseStatus={'OPEN_IN_PROGRESS'} />
          </div>
        </Component>
      </UseCase>
    </>
  );
}
