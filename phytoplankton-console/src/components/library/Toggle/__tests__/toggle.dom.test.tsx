import React from 'react';
import { describe, expect } from '@jest/globals';
import { fireEvent, render } from 'testing-library-wrapper';
import Toggle from '..';

describe('Toggle Component', () => {
  test('renders basic Toggle', () => {
    const { getByTestId } = render(<Toggle value={true} onChange={() => {}} />);
    expect(getByTestId('toggle')).toBeInTheDocument();
  });

  it('renders Toggle with label', () => {
    const { queryAllByText } = render(
      <Toggle showLabel value={true} onChange={() => {}} label="Test Label" />,
    );
    const labelElements = queryAllByText('Test Label');
    expect(labelElements).toHaveLength(2);
    expect(labelElements[0]).toBeInTheDocument();
  });

  it('handles onChange event', () => {
    let toggleValue = false;
    const handleChange = (value) => {
      toggleValue = value;
    };

    const { getByTestId } = render(<Toggle value={toggleValue} onChange={handleChange} />);
    fireEvent.click(getByTestId('toggle'));

    expect(toggleValue).toBe(true);
  });

  it('renders disabled Toggle', () => {
    const { getByTestId } = render(<Toggle disabled value={false} onChange={() => {}} />);
    const toggle = getByTestId('toggle');

    expect(toggle).toBeDisabled();
  });

  it('renders Toggle without label when showLabel is false', () => {
    const { queryAllByText } = render(
      <Toggle showLabel={false} value={true} onChange={() => {}} label="Test Label" />,
    );
    const labelElements = queryAllByText('Test Label');
    expect(labelElements).toHaveLength(0);
  });

  it('uses appropriate color based on props(green)', () => {
    const { container } = render(<Toggle value={true} green onChange={() => {}} />);

    const switchBackground = container.querySelector('.react-switch-bg');

    const backgroundColor = getComputedStyle(switchBackground as any).backgroundColor;

    expect(backgroundColor).toBe('rgb(82, 196, 26)');
  });

  it('render LARGE toggle', () => {
    const { container } = render(<Toggle value={true} size="LARGE" onChange={() => {}} />);

    const switchStyle = container.querySelector('.react-switch-bg');

    const height = getComputedStyle(switchStyle as any).height;
    const width = getComputedStyle(switchStyle as any).width;

    expect(height).toBe('40px');
    expect(width).toBe('80px');
  });

  it('render SMALL toggle', () => {
    const { container } = render(<Toggle value={true} size="SMALL" onChange={() => {}} />);

    const switchStyle = container.querySelector('.react-switch-bg');

    const height = getComputedStyle(switchStyle as any).height;
    const width = getComputedStyle(switchStyle as any).width;

    expect(height).toBe('26px');
    expect(width).toBe('50px');
  });
});
