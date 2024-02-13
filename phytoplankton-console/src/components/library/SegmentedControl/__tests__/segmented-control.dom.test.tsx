import '@testing-library/jest-dom';
import { describe, expect } from '@jest/globals';
import { render, fireEvent } from 'testing-library-wrapper';
import SegmentedControl from '..';

const commonItems = [
  { value: 'daily', label: 'Dayly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'annually', label: 'Annually' },
];

describe('SegmentedControl', () => {
  it('renders the component with different sizes', () => {
    const { container } = render(
      <>
        <SegmentedControl active="daily" onChange={() => {}} size="LARGE" items={commonItems} />
        <SegmentedControl active="daily" onChange={() => {}} size="MEDIUM" items={commonItems} />
        <SegmentedControl active="daily" onChange={() => {}} size="SMALL" items={commonItems} />
      </>,
    );
    expect(
      container.querySelectorAll(
        '.src_components_library_SegmentedControl_style_module_less___size-LARGE',
      ),
    ).toHaveLength(1);
    expect(
      container.querySelectorAll(
        '.src_components_library_SegmentedControl_style_module_less___size-MEDIUM',
      ),
    ).toHaveLength(1);
    expect(
      container.querySelectorAll(
        '.src_components_library_SegmentedControl_style_module_less___size-SMALL',
      ),
    ).toHaveLength(1);
  });

  it('renders the component with different states', () => {
    const { getByRole } = render(
      <SegmentedControl
        active="daily"
        onChange={() => {}}
        items={[
          { value: 'daily', label: 'Dayly' },
          { value: 'weekly', label: 'Weekly', isDisabled: true },
          { value: 'monthly', label: 'Monthly', icon: <div data-testid="icon" /> },
          {
            value: 'annually',
            label: 'Annually',
            isDisabled: true,
            icon: <div data-testid="icon" />,
          },
        ]}
      />,
    );

    expect(getByRole('button', { name: 'Weekly' })).toHaveAttribute('disabled');
    expect(
      getByRole('button', { name: 'Monthly' }).querySelector('[data-testid="icon"]'),
    ).toBeInTheDocument();
    expect(
      getByRole('button', { name: 'Annually' }).querySelector('[data-testid="icon"]'),
    ).toBeInTheDocument();
  });

  it('calls onChange when a button is clicked', () => {
    const handleChange = jest.fn();
    const { getByText } = render(
      <SegmentedControl
        active="daily"
        onChange={handleChange}
        items={[{ value: 'daily', label: 'Dayly' }]}
      />,
    );

    fireEvent.click(getByText('Dayly'));
    expect(handleChange).toHaveBeenCalledWith('daily');
  });

  it('renders the provided icon when the icon prop is present', () => {
    const { getByRole } = render(
      <SegmentedControl
        active="daily"
        onChange={() => {}}
        items={[{ value: 'daily', label: 'Dayly', icon: <div data-testid="icon" /> }]}
      />,
    );

    expect(
      getByRole('button', { name: 'Dayly' }).querySelector('[data-testid="icon"]'),
    ).toBeInTheDocument();
  });

  it('renders the component with different sizes dynamically', () => {
    const { rerender, container } = render(
      <SegmentedControl active="daily" onChange={() => {}} size="LARGE" items={commonItems} />,
    );

    expect(
      container.querySelectorAll(
        '.src_components_library_SegmentedControl_style_module_less___size-LARGE',
      ),
    ).toHaveLength(1);

    rerender(
      <SegmentedControl active="daily" onChange={() => {}} size="SMALL" items={commonItems} />,
    );
    expect(
      container.querySelectorAll(
        '.src_components_library_SegmentedControl_style_module_less___size-SMALL',
      ),
    ).toHaveLength(1);
  });

  it('does not call onChange for a disabled button when clicked', () => {
    const handleChange = jest.fn();
    const { getByText } = render(
      <SegmentedControl
        active="daily"
        onChange={handleChange}
        items={[{ value: 'weekly', label: 'Weekly', isDisabled: true }]}
      />,
    );

    fireEvent.click(getByText('Weekly'));
    expect(handleChange).not.toHaveBeenCalled();
  });
});
