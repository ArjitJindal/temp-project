import { describe } from '@jest/globals';
import { render } from 'testing-library-wrapper';
import AgeRangeInput, { ValueType } from '..';
import {
  setMinAge,
  setMaxAge,
  expectMinAgeValue,
  expectMaxAgeValue,
  expectMaxAgeDisabled,
  expectOnChangeCalledWith,
} from './age-range-input.jest-helpers';

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
    expectMinAgeValue(18);
    expectMaxAgeValue(null);
    expectMaxAgeDisabled(true);
  });

  it('updates the minAge value correctly', () => {
    const onChange = jest.fn();
    renderComponent(defaultValue, onChange);

    setMinAge('25');

    expectOnChangeCalledWith(onChange, {
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

    setMaxAge('25');

    expectOnChangeCalledWith(onChange, {
      minAge: { granularity: 'year', units: 18 },
      maxAge: { granularity: 'year', units: 25 },
    });
  });
});
