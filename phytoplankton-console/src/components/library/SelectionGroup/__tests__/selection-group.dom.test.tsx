import React from 'react';
import { describe, expect } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from 'testing-library-wrapper';
import SelectionGroup from '..';

describe('SelectionGroup Component', () => {
  const options = [
    { value: 'option1', label: 'Option 1', description: 'Description 1' },
    { value: 'option2', label: 'Option 2', description: 'Description 2' },
    { value: 'option3', label: 'Option 3', description: 'Description 3', isDisabled: true },
  ];

  it('renders SelectionGroup in SINGLE mode with descriptions', () => {
    const onChange = jest.fn();
    render(<SelectionGroup mode="SINGLE" options={options} value="option1" onChange={onChange} />);
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Description 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    expect(screen.getByText('Description 2')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();
    expect(screen.getByText('Description 3')).toBeInTheDocument();
  });

  it('renders SelectionGroup in MULTIPLE mode with descriptions', () => {
    const onChange = jest.fn();
    render(
      <SelectionGroup mode="MULTIPLE" options={options} value={['option1']} onChange={onChange} />,
    );
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Description 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    expect(screen.getByText('Description 2')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();
    expect(screen.getByText('Description 3')).toBeInTheDocument();
  });

  it('calls onChange when an option is clicked', async () => {
    const onChange = jest.fn();
    render(<SelectionGroup mode="SINGLE" options={options} value="option1" onChange={onChange} />);
    fireEvent.click(screen.getByText('Option 2'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('option2'));
  });

  it('Checkbox selection works as expected in single-select mode', async () => {
    const onChange = jest.fn();
    render(<SelectionGroup mode="SINGLE" options={options} value="option2" onChange={onChange} />);

    const option2Checkbox = screen.getByRole('checkbox', { name: 'Option 2 Description 2' });
    const option1Checkbox = screen.getByRole('checkbox', { name: 'Option 1 Description 1' });
    expect(option2Checkbox).toBeChecked();
    expect(option1Checkbox).not.toBeChecked();
    fireEvent.change(option1Checkbox, { target: { checked: true } });

    await waitFor(() => {
      expect(option1Checkbox).toBeChecked();
    });
  });

  it('Checkbox selection works as expected in multiple-select mode', async () => {
    const onChange = jest.fn();
    render(
      <SelectionGroup mode="MULTIPLE" options={options} value={['option2']} onChange={onChange} />,
    );

    const option1Checkbox = screen.getByRole('checkbox', { name: 'Option 1 Description 1' });
    const option2Checkbox = screen.getByRole('checkbox', { name: 'Option 2 Description 2' });
    const option3Checkbox = screen.getByRole('checkbox', { name: 'Option 3 Description 3' });

    expect(option1Checkbox).not.toBeChecked();
    expect(option2Checkbox).toBeChecked();
    expect(option3Checkbox).not.toBeChecked();

    fireEvent.change(option1Checkbox, { target: { checked: true } });

    await waitFor(() => {
      expect(option1Checkbox).toBeChecked();
    });

    expect(option2Checkbox).toBeChecked();
    expect(option3Checkbox).not.toBeChecked();
  });

  it('does not change checked state when clicking on a disabled option in single-select mode', async () => {
    const onChange = jest.fn();
    render(<SelectionGroup mode="SINGLE" options={options} value="option1" onChange={onChange} />);

    const disabledOptionRadio = screen.getByRole('checkbox', { name: 'Option 3 Description 3' });
    expect(disabledOptionRadio).toBeDisabled();
    expect(disabledOptionRadio).not.toBeChecked();

    fireEvent.click(disabledOptionRadio);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('option3');
      expect(disabledOptionRadio).not.toBeChecked();
    });
  });

  it('does not change checked state when clicking on a disabled option in multiple-select mode', async () => {
    const onChange = jest.fn();
    render(
      <SelectionGroup mode="MULTIPLE" options={options} value={['option1']} onChange={onChange} />,
    );

    const disabledOptionCheckbox = screen.getByRole('checkbox', { name: 'Option 3 Description 3' });
    expect(disabledOptionCheckbox).toBeDisabled();
    expect(disabledOptionCheckbox).not.toBeChecked();

    fireEvent.click(disabledOptionCheckbox);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(['option1', 'option3']);
      expect(disabledOptionCheckbox).not.toBeChecked();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
