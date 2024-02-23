import React from 'react';
import { describe, expect } from '@jest/globals';
import { render, fireEvent, screen, waitFor } from 'testing-library-wrapper';
import '@testing-library/jest-dom/extend-expect';
import RiskLevelSwitch from '..';

describe('RiskLevelSwitch Component', () => {
  it('renders correctly', () => {
    render(<RiskLevelSwitch value={'LOW'} onChange={() => {}} />);
    const riskLabels = screen.getAllByRole('radio');
    expect(riskLabels).toHaveLength(5);

    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('handles onChange event', () => {
    const handleChange = jest.fn();
    render(<RiskLevelSwitch value={'LOW'} onChange={handleChange} />);

    const highRiskInput = screen.getByLabelText('High');
    fireEvent.click(highRiskInput);

    expect(handleChange).toHaveBeenCalledWith('HIGH');
  });

  it('renders disabled inputs with "isDisabled" prop', () => {
    render(<RiskLevelSwitch value={'LOW'} isDisabled />);

    const riskInputs = screen.getAllByRole('radio');
    riskInputs.forEach((input) => {
      expect(input).toBeDisabled();
    });

    expect(screen.getByLabelText('Low')).toBeDisabled();
    expect(screen.getByLabelText('Medium')).toBeDisabled();
    expect(screen.getByLabelText('High')).toBeDisabled();
  });

  it('handles radio button clicks when isDisabled is false', async () => {
    const handleChange = jest.fn();
    render(<RiskLevelSwitch value={'LOW'} onChange={handleChange} isDisabled={false} />);

    const highRiskInput = screen.getByLabelText('High');
    fireEvent.click(highRiskInput);

    await waitFor(() => expect(handleChange).toHaveBeenCalledWith('HIGH'));
  });
});
