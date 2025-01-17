import React from 'react';
import DateRangePicker from '.';
import { UseCase } from '@/pages/storybook/components';
import Alert from '@/components/library/Alert';
import Toggle from '@/components/library/Toggle';
import Label from '@/components/library/Label';
import { dayjs } from '@/utils/dayjs';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title="Basic case">
        {([state, setState]) => (
          <>
            <Alert type={'info'}>
              State: {state.value?.map((x) => x?.format() ?? 'null').join(' - ') ?? 'null'}
            </Alert>
            <DateRangePicker
              value={state['value']}
              onChange={(value) => {
                setState({ value });
              }}
            />
          </>
        )}
      </UseCase>
      <UseCase
        title="Predefined state"
        initialState={{
          value: [dayjs(), dayjs().add(1, 'days')],
        }}
      >
        {([state, setState]) => (
          <>
            <Alert type={'info'}>
              State: {state.value?.map((x) => x?.format() ?? 'null').join(' - ') ?? 'null'}
            </Alert>
            <DateRangePicker
              value={state['value']}
              onChange={(value) => {
                setState({ value });
              }}
            />
          </>
        )}
      </UseCase>
      <UseCase title="Do not allow clear">
        {([state, setState]) => (
          <>
            <Alert type={'info'}>
              State: {state.value?.map((x) => x?.format() ?? 'null').join(' - ') ?? 'null'}
            </Alert>
            <DateRangePicker
              value={state['value']}
              onChange={(value) => {
                setState({ value });
              }}
              allowClear={[false, false]}
            />
          </>
        )}
      </UseCase>
      <UseCase title="Do not allow clear, with tooltip">
        {([state, setState]) => (
          <>
            <Alert type={'info'}>
              State: {state.value?.map((x) => x?.format() ?? 'null').join(' - ') ?? 'null'}
            </Alert>
            <DateRangePicker
              value={state['value']}
              onChange={(value) => {
                setState({ value });
              }}
              allowClear={[false, false]}
              clearNotAllowedTooltip={'Some information about disabled clear button'}
            />
          </>
        )}
      </UseCase>
      <UseCase title="Hidden by default">
        {([state, setState]) => (
          <>
            <Label label={'Show'} position={'LEFT'}>
              <Toggle
                size={'S'}
                value={state.show || false}
                onChange={(newValue) => {
                  setState((state) => ({ ...state, show: newValue }));
                }}
              />
            </Label>
            <Alert type={'info'}>
              State: {state.value?.map((x) => x?.format() ?? 'null').join(' - ') ?? 'null'}
            </Alert>
            {state.show && (
              <DateRangePicker
                value={state['value']}
                onChange={(value) => {
                  setState((state) => ({ ...state, value }));
                }}
              />
            )}
          </>
        )}
      </UseCase>
    </>
  );
}
