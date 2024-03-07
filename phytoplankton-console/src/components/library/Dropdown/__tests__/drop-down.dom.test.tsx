import React from 'react';
import { describe, expect } from '@jest/globals';
import { fireEvent, render, screen, userEvent } from 'testing-library-wrapper';
import Dropdown from '..';

describe('Dropdown', () => {
  it('dropdown is initially closed', () => {
    render(<Dropdown options={[]} children={<div>Dropdown</div>} />);
    expect(screen.queryByText('Option 1')).not.toBeInTheDocument();
  });

  it('opens dropdown on click and selects an option', () => {
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

    fireEvent.click(screen.getByText('Dropdown'));
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Option 1'));
    expect(mockOnSelect).toHaveBeenCalledWith({ value: 'option1', label: 'Option 1' });
  });

  it('dropdown closes on outside click', () => {
    render(
      <Dropdown
        options={[{ value: 'option1', label: 'Option 1' }]}
        children={<div>Dropdown</div>}
      />,
    );
    userEvent.click(screen.getByText('Dropdown'));
    userEvent.click(document.body);
    expect(screen.queryByText('Option 1')).not.toBeInTheDocument();
  });

  it('dropdown does not open when disabled', () => {
    render(
      <Dropdown
        disabled
        options={[{ value: 'option1', label: 'Option 1' }]}
        children={<div>Dropdown</div>}
      />,
    );
    userEvent.click(screen.getByText('Dropdown'));
    expect(screen.queryByText('Option 1')).not.toBeInTheDocument();
  });

  it('dropdown does not open when there are no options', () => {
    render(<Dropdown options={[]} children={<div>Dropdown</div>} />);
    userEvent.click(screen.getByText('Dropdown'));
    expect(screen.queryByText('Option 1')).not.toBeInTheDocument();
  });

  it('renders dropdown with tags', () => {
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

    fireEvent.click(screen.getByText('Dropdown with Tags'));

    tags.forEach((tag) => {
      expect(screen.getByText(tag.label)).toBeInTheDocument();
    });
  });

  it('disables and skips rendering disabled options', () => {
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

    fireEvent.click(screen.getByText('Dropdown'));
    expect(screen.queryByText('Option 2')).toBeDisabled;
    fireEvent.click(screen.getByText('Option 3'));
    expect(mockOnSelect).toHaveBeenCalledWith({ value: 'option3', label: 'Option 3' });
  });
});
