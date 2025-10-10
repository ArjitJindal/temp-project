import React from 'react';
import { describe, expect } from '@jest/globals';
import { render } from 'testing-library-wrapper';
import Toggle from '..';
import {
  findToggle,
  clickToggle,
  expectToggleDisabled,
  expectToggleBackgroundColor,
} from './toggle.jest-helpers';

describe('Toggle Component', () => {
  test('renders basic Toggle', () => {
    render(<Toggle value={true} onChange={() => {}} />);
    expect(findToggle()).toBeInTheDocument();
  });

  it('handles onChange event', async () => {
    let toggleValue = false;
    const handleChange = (value) => {
      toggleValue = value;
    };

    render(<Toggle value={toggleValue} onChange={handleChange} />);
    await clickToggle();

    expect(toggleValue).toBe(true);
  });

  it('renders disabled Toggle', () => {
    render(<Toggle isDisabled={true} value={false} onChange={() => {}} />);
    expectToggleDisabled(true);
  });

  it('uses appropriate color based on props(green)', () => {
    render(<Toggle value={true} green onChange={() => {}} />);
    expectToggleBackgroundColor('rgb(17, 105, 249)');
  });
});
