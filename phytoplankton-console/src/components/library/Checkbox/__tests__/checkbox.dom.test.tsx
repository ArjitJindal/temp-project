import { test, describe, expect } from '@jest/globals';
import { render, screen, fireEvent } from 'testing-library-wrapper';
import Checkbox from '..';
import s from '../style.module.less';

describe('Checkbox Component', () => {
  test('renders checkbox correctly', () => {
    render(<Checkbox testName="testCheckbox" />);
    const checkbox = screen.getByTestId('testCheckbox-checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toHaveAttribute('type', 'checkbox');
  });

  test('handles checkbox change', () => {
    const handleChange = jest.fn();
    render(<Checkbox onChange={handleChange} testName="testCheckbox" />);
    const checkbox = screen.getByTestId('testCheckbox-checkbox');
    fireEvent.click(checkbox);
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  test('is disabled when isDisabled is true', () => {
    render(<Checkbox isDisabled={true} testName="testCheckbox" />);
    const checkbox = screen.getByTestId('testCheckbox-checkbox');
    expect(checkbox).toBeDisabled();
  });

  test('has indeterminate classes when value is undefined', () => {
    const { container } = render(<Checkbox value={undefined} testName="testCheckbox" />);
    const indeterminateDiv = container.querySelector(`.${s.isIndeterminate}`);
    expect(indeterminateDiv).toBeInTheDocument();
  });
});
