import { test, describe, expect } from '@jest/globals';
import { render, screen, userEvent } from 'testing-library-wrapper';
import Radio from '..';

describe('Radio Component', () => {
  test('renders correctly', () => {
    render(<Radio />);
    const radio = screen.getByRole('checkbox');
    expect(radio).toBeInTheDocument();
  });

  test('is disabled when isDisabled is true', () => {
    render(<Radio isDisabled={true} />);
    const radio = screen.getByRole('checkbox');
    expect(radio).toBeDisabled();
  });

  test('reflects checked state based on value prop', () => {
    render(<Radio value={true} />);
    const radio = screen.getByRole('checkbox');
    expect(radio).toBeChecked();
  });

  test('calls onChange with correct value on click', async () => {
    const handleChange = jest.fn();
    render(<Radio onChange={handleChange} />);
    const radio = screen.getByRole('checkbox');
    await userEvent.click(radio);
    expect(handleChange).toHaveBeenCalledWith(true);
  });
});
