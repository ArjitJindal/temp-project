import { test, describe, expect } from '@jest/globals';
import { render } from 'testing-library-wrapper';
import Checkbox from '..';
import {
  findCheckboxByTestName,
  clickCheckbox,
  expectCheckboxDisabled,
  expectCheckboxIndeterminate,
} from './checkbox.jest-helpers';

describe('Checkbox Component', () => {
  test('renders checkbox correctly', () => {
    render(<Checkbox testName="testCheckbox" />);
    const checkbox = findCheckboxByTestName('testCheckbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toHaveAttribute('type', 'checkbox');
  });

  test('handles checkbox change', async () => {
    const handleChange = jest.fn();
    render(<Checkbox onChange={handleChange} testName="testCheckbox" />);
    await clickCheckbox('testCheckbox');
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  test('is disabled when isDisabled is true', () => {
    render(<Checkbox isDisabled={true} testName="testCheckbox" />);
    expectCheckboxDisabled('testCheckbox', true);
  });

  test('has indeterminate classes when value is undefined', () => {
    render(<Checkbox value={undefined} testName="testCheckbox" />);
    expectCheckboxIndeterminate('testCheckbox', true);
  });
});
