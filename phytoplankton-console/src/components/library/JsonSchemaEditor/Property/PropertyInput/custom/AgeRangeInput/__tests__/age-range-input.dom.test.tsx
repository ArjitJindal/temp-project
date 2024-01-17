import { test, describe, expect } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from 'testing-library-wrapper';
import AgeRangeInput from '..';

describe('AgeRangeInput Component', () => {
  test('renders elements correctly', () => {
    render(<AgeRangeInput />);
    expect(screen.getByTestId('min-age-input')).toBeInTheDocument();
    expect(screen.getByTestId('max-age-input')).toBeInTheDocument();
    expect(screen.getByTestId('age-range-slider')).toBeInTheDocument();
    expect(screen.getByTestId('granularity-select')).toBeInTheDocument();
  });

  test('handles min age input change', () => {
    const handleChange = jest.fn();
    render(<AgeRangeInput onChange={handleChange} />);

    const minAgeInput = screen.getByTestId('min-age-input');
    fireEvent.change(minAgeInput, { target: { value: '25' } });

    expect(handleChange).toHaveBeenCalledWith({
      minAge: { units: 25, granularity: 'year' },
    });
  });

  test('handles max age input change', async () => {
    const handleChange = jest.fn();
    render(<AgeRangeInput onChange={handleChange} />);
    const maxAgeInput = screen.getByTestId('max-age-input');
    await fireEvent.change(maxAgeInput, { target: { value: '40' } });
    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledTimes(1);
      const [callArguments] = handleChange.mock.calls;
      expect(callArguments[0]).toEqual({
        maxAge: { units: 40, granularity: 'year' },
      });
    });
  });

  test('handles invalid input', () => {
    const handleChange = jest.fn();
    render(<AgeRangeInput onChange={handleChange} />);

    const minAgeInput = screen.getByTestId('min-age-input');
    fireEvent.change(minAgeInput, { target: { value: 'abc' } });

    expect(handleChange).not.toHaveBeenCalled();
  });

  test('handles empty values', () => {
    const handleChange = jest.fn();
    render(<AgeRangeInput onChange={handleChange} />);
  });
});
