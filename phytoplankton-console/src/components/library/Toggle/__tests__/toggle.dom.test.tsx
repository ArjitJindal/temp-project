import React from 'react';
import { describe, expect } from '@jest/globals';
import { fireEvent, render } from 'testing-library-wrapper';
import Toggle from '..';

describe('Toggle Component', () => {
  test('renders basic Toggle', () => {
    const { getByTestId } = render(<Toggle value={true} onChange={() => {}} />);
    expect(getByTestId('anonymous-toggle')).toBeInTheDocument();
  });

  it('handles onChange event', () => {
    let toggleValue = false;
    const handleChange = (value) => {
      toggleValue = value;
    };

    const { getByTestId } = render(<Toggle value={toggleValue} onChange={handleChange} />);
    fireEvent.click(getByTestId('anonymous-toggle'));

    expect(toggleValue).toBe(true);
  });

  it('renders disabled Toggle', () => {
    const { getByTestId } = render(<Toggle isDisabled={true} value={false} onChange={() => {}} />);
    const toggle = getByTestId('anonymous-toggle');

    expect(toggle).toBeDisabled();
  });

  it('uses appropriate color based on props(green)', () => {
    const { getByTestId } = render(<Toggle value={true} green onChange={() => {}} />);

    const switchBackground = getByTestId('anonymous-toggle-bg');

    const backgroundColor = getComputedStyle(switchBackground as any).backgroundColor;

    expect(backgroundColor).toBe('rgb(17, 105, 249)');
  });
});
