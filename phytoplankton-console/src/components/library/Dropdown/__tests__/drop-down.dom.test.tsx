import React from 'react';
import { describe, expect } from '@jest/globals';
import { render, screen } from 'testing-library-wrapper';
import Dropdown from '..';
import {
  openDropdown,
  closeDropdownByClickingOutside,
  selectOptionByText,
  expectOptionsVisible,
  expectOptionsNotVisible,
  expectOptionDisabled,
} from './drop-down.jest-helpers';

describe('Dropdown', () => {
  it('dropdown is initially closed', () => {
    render(<Dropdown options={[]} children={<div>Dropdown</div>} />);
    expect(screen.queryByText('Option 1')).not.toBeInTheDocument();
  });

  it('opens dropdown on click and selects an option', async () => {
    const mockOnSelect = jest.fn();
    const options = [
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2' },
    ];

    render(
      <Dropdown
        options={options}
        onSelect={mockOnSelect}
        children={<div>Dropdown</div>}
        arrow="FILLED"
      />,
    );

    await openDropdown('Dropdown');
    expectOptionsVisible(['Option 1', 'Option 2']);
    await selectOptionByText('Option 1');
    expect(mockOnSelect).toHaveBeenCalledWith({ value: 'option1', label: 'Option 1' });
  });

  it('dropdown closes on outside click', async () => {
    render(
      <Dropdown
        options={[{ value: 'option1', label: 'Option 1' }]}
        children={<div>Dropdown</div>}
      />,
    );
    await openDropdown('Dropdown');
    await closeDropdownByClickingOutside();
    expectOptionsNotVisible(['Option 1']);
  });

  it('dropdown does not open when disabled', async () => {
    render(
      <Dropdown
        disabled
        options={[{ value: 'option1', label: 'Option 1' }]}
        children={<div>Dropdown</div>}
      />,
    );
    await openDropdown('Dropdown');
    expectOptionsNotVisible(['Option 1']);
  });

  it('dropdown does not open when there are no options', async () => {
    render(<Dropdown options={[]} children={<div>Dropdown</div>} />);
    await openDropdown('Dropdown');
    expectOptionsNotVisible(['Option 1']);
  });

  it('renders dropdown with tags', async () => {
    const tags = [
      { value: 'tag1', label: 'Tag 1' },
      { value: 'tag2', label: 'Tag 2' },
    ];

    render(
      <Dropdown
        options={tags}
        children={<div>Dropdown with Tags</div>}
        arrow="LINE"
        extraBottomMargin
      />,
    );

    await openDropdown('Dropdown with Tags');
    expectOptionsVisible(tags.map((tag) => tag.label));
  });

  it('disables and skips rendering disabled options', async () => {
    const mockOnSelect = jest.fn();
    const options = [
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2', isDisabled: true },
      { value: 'option3', label: 'Option 3' },
    ];

    render(
      <Dropdown
        options={options}
        onSelect={mockOnSelect}
        children={<div>Dropdown</div>}
        arrow="FILLED"
      />,
    );

    await openDropdown('Dropdown');
    expectOptionDisabled('Option 2');
    await selectOptionByText('Option 3');
    expect(mockOnSelect).toHaveBeenCalledWith({ value: 'option3', label: 'Option 3' });
  });
});
