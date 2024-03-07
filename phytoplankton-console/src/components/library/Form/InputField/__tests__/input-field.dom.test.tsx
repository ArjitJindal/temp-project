import React from 'react';
import { describe, expect } from '@jest/globals';
import { render, screen } from 'testing-library-wrapper';
import InputField from '..';
import { FormValues } from '@/components/Narrative';
import Select from '@/components/library/Select';
import TextInput from '@/components/library/TextInput';

jest.mock(`../../GenericFormField`, () => ({
  __esModule: true,
  default: jest.fn(({ children }) =>
    children({
      value: '',
      onChange: jest.fn(),
      isValid: false,
      isDisabled: false,
      showError: true,
      errorMessage: 'This field is required', //custom error message
      onFocus: jest.fn(),
      onBlur: jest.fn(),
    }),
  ),
}));

const commonLabelProps = {
  required: {
    value: true,
    showHint: true,
  },
};

describe('InputField component', () => {
  it('renders InputField with Select component', () => {
    const possibleReasons = ['Reason1', 'Reason2'];

    render(
      <InputField<FormValues<any>, 'reasons'>
        name={'reasons'}
        label={'Reason'}
        labelProps={commonLabelProps}
      >
        {(inputProps) => (
          <Select<any>
            {...inputProps}
            mode={'MULTIPLE'}
            options={possibleReasons.map((label) => ({ value: label, label }))}
          />
        )}
      </InputField>,
    );

    expect(screen.getByText('Reason')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders InputField with TextInput component when isOtherReason is true', () => {
    render(
      <InputField<FormValues<any>, 'reasonOther'>
        name="reasonOther"
        label="Describe the reason"
        labelProps={commonLabelProps}
      >
        {(inputProps) => <TextInput {...inputProps} />}
      </InputField>,
    );

    expect(screen.getByText('Describe the reason')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders InputField with Select component and shows error', () => {
    const possibleReasons = ['Reason1', 'Reason2'];

    render(
      <InputField<FormValues<any>, 'reasons'>
        name={'reasons'}
        label={'Reason'}
        labelProps={commonLabelProps}
      >
        {(inputProps) => (
          <Select<any>
            {...inputProps}
            mode={'MULTIPLE'}
            options={possibleReasons.map((label) => ({ value: label, label }))}
          />
        )}
      </InputField>,
    );

    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('renders InputField with TextInput component and shows error', () => {
    render(
      <InputField<FormValues<any>, 'reasonOther'>
        name="reasonOther"
        label="Describe the reason"
        labelProps={commonLabelProps}
      >
        {(inputProps) => <TextInput {...inputProps} />}
      </InputField>,
    );
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('renders InputField with TextInput component and hides label when hideLabel prop is true', () => {
    render(
      <InputField<FormValues<any>, 'reasonOther'>
        name="reasonOther"
        label="Describe the reason"
        labelProps={commonLabelProps}
        hideLabel={true}
      >
        {(inputProps) => <TextInput {...inputProps} />}
      </InputField>,
    );
    expect(screen.queryByText('Describe the reason')).toBeNull();
  });
});
