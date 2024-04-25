import React from 'react';
import { render, fireEvent, screen } from 'testing-library-wrapper';
import { describe, expect } from '@jest/globals';
import AgeRangeInput, { ValueType } from '..';
describe('AgeRangeInput', () => {
  const defaultValue: ValueType = {
    minAge: {
      granularity: 'year',
      units: 18,
    },
  };

  const renderComponent = (
    value: ValueType = defaultValue,
    onChange: (value: ValueType | undefined) => void = jest.fn(),
  ) => {
    return render(<AgeRangeInput value={value} onChange={onChange} />);
  };

  it('renders the component with default values', () => {
    renderComponent();
    const minAgeInput = screen.getByTestId('min-age-input');
    const maxAgeInput = screen.getByTestId('max-age-input');

    expect(minAgeInput).toHaveValue(18);
    expect(maxAgeInput).toHaveValue(null);
    expect(maxAgeInput).toBeDisabled();
  });

  it('updates the minAge value correctly', () => {
    const onChange = jest.fn();
    renderComponent(defaultValue, onChange);
    const minAgeInput = screen.getByTestId('min-age-input', {});

    fireEvent.change(minAgeInput, { target: { value: '25' } });

    expect(onChange).toHaveBeenCalledWith({
      minAge: { granularity: 'year', units: 25 },
    });
  });
  it('updates the maxAge value correctly', () => {
    const onChange = jest.fn();
    renderComponent(
      {
        minAge: {
          granularity: 'year',
          units: 18,
        },
        maxAge: {
          granularity: 'year',
          units: 20,
        },
      },
      onChange,
    );
    const maxAgeInput = screen.getByTestId('max-age-input', {});

    fireEvent.change(maxAgeInput, { target: { value: '25' } });

    expect(onChange).toHaveBeenCalledWith({
      minAge: { granularity: 'year', units: 18 },
      maxAge: { granularity: 'year', units: 25 },
    });
  });
});
