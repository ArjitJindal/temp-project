import React from 'react';
import { describe, expect } from '@jest/globals';
import { render, waitFor, fireEvent } from 'testing-library-wrapper';
import SelectionGroup from '..';
import {
  clickOption,
  expectOptionsPresent,
  findCheckboxByLabelAndDescription,
  expectCheckboxState,
  expectCheckboxDisabled,
  setCheckboxState,
  waitForCheckboxState,
} from './selection-group.jest-helpers';

describe('SelectionGroup Component', () => {
  const options = [
    { value: 'option1', label: 'Option 1', description: 'Description 1' },
    { value: 'option2', label: 'Option 2', description: 'Description 2' },
    { value: 'option3', label: 'Option 3', description: 'Description 3', isDisabled: true },
  ];

  it('renders SelectionGroup in SINGLE mode with descriptions', () => {
    const onChange = jest.fn();
    render(<SelectionGroup mode="SINGLE" options={options} value="option1" onChange={onChange} />);
    expectOptionsPresent([
      { label: 'Option 1', description: 'Description 1' },
      { label: 'Option 2', description: 'Description 2' },
      { label: 'Option 3', description: 'Description 3' },
    ]);
  });

  it('renders SelectionGroup in MULTIPLE mode with descriptions', () => {
    const onChange = jest.fn();
    render(
      <SelectionGroup mode="MULTIPLE" options={options} value={['option1']} onChange={onChange} />,
    );
    expectOptionsPresent([
      { label: 'Option 1', description: 'Description 1' },
      { label: 'Option 2', description: 'Description 2' },
      { label: 'Option 3', description: 'Description 3' },
    ]);
  });

  it('calls onChange when an option is clicked', async () => {
    const onChange = jest.fn();
    render(<SelectionGroup mode="SINGLE" options={options} value="option1" onChange={onChange} />);
    await clickOption('Option 2');
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('option2'));
  });

  it('Checkbox selection works as expected in single-select mode', async () => {
    const onChange = jest.fn();
    render(<SelectionGroup mode="SINGLE" options={options} value="option2" onChange={onChange} />);

    expectCheckboxState('Option 2', 'Description 2', true);
    expectCheckboxState('Option 1', 'Description 1', false);
    await setCheckboxState('Option 1', 'Description 1', true);

    await waitForCheckboxState('Option 1', 'Description 1', true);
  });

  it('Checkbox selection works as expected in multiple-select mode', async () => {
    const onChange = jest.fn();
    render(
      <SelectionGroup mode="MULTIPLE" options={options} value={['option2']} onChange={onChange} />,
    );

    expectCheckboxState('Option 1', 'Description 1', false);
    expectCheckboxState('Option 2', 'Description 2', true);
    expectCheckboxState('Option 3', 'Description 3', false);

    await setCheckboxState('Option 1', 'Description 1', true);

    await waitForCheckboxState('Option 1', 'Description 1', true);
    expectCheckboxState('Option 2', 'Description 2', true);
    expectCheckboxState('Option 3', 'Description 3', false);
  });

  it('does not change checked state when clicking on a disabled option in single-select mode', async () => {
    const onChange = jest.fn();
    render(<SelectionGroup mode="SINGLE" options={options} value="option1" onChange={onChange} />);

    const disabledOptionRadio = findCheckboxByLabelAndDescription('Option 3', 'Description 3');
    expectCheckboxDisabled('Option 3', 'Description 3', true);
    expectCheckboxState('Option 3', 'Description 3', false);

    fireEvent.click(disabledOptionRadio);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('option3');
      expectCheckboxState('Option 3', 'Description 3', false);
    });
  });

  it('does not change checked state when clicking on a disabled option in multiple-select mode', async () => {
    const onChange = jest.fn();
    render(
      <SelectionGroup mode="MULTIPLE" options={options} value={['option1']} onChange={onChange} />,
    );

    const disabledOptionCheckbox = findCheckboxByLabelAndDescription('Option 3', 'Description 3');
    expectCheckboxDisabled('Option 3', 'Description 3', true);
    expectCheckboxState('Option 3', 'Description 3', false);

    fireEvent.click(disabledOptionCheckbox);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(['option1', 'option3']);
      expectCheckboxState('Option 3', 'Description 3', false);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
