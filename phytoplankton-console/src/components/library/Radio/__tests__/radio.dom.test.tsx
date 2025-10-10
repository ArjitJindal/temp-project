import { test, describe, expect } from '@jest/globals';
import { render } from 'testing-library-wrapper';
import Radio from '..';
import {
  findRadio,
  clickRadio,
  expectRadioChecked,
  expectRadioDisabled,
} from './radio.jest-helpers';

describe('Radio Component', () => {
  test('renders correctly', () => {
    render(<Radio />);
    const radio = findRadio();
    expect(radio).toBeInTheDocument();
  });

  test('is disabled when isDisabled is true', () => {
    render(<Radio isDisabled={true} />);
    expectRadioDisabled(true);
  });

  test('reflects checked state based on value prop', () => {
    render(<Radio value={true} />);
    expectRadioChecked(true);
  });

  test('calls onChange with correct value on click', async () => {
    const handleChange = jest.fn();
    render(<Radio onChange={handleChange} />);
    await clickRadio();
    expect(handleChange).toHaveBeenCalledWith(true);
  });
});
