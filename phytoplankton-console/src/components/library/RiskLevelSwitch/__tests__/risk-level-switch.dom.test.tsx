import { describe, expect } from '@jest/globals';

import '@testing-library/jest-dom/extend-expect';
import { render, waitFor } from 'testing-library-wrapper';
import RiskLevelSwitch from '..';
import {
  findAllRiskInputs,
  clickRiskLevel,
  expectAllRiskInputsDisabled,
  expectRiskLabelsPresent,
} from './risk-level-switch.jest-helpers';

describe('RiskLevelSwitch Component', () => {
  it('renders correctly', () => {
    render(<RiskLevelSwitch value={'LOW'} onChange={() => {}} />);
    const riskLabels = findAllRiskInputs();
    expect(riskLabels).toHaveLength(5);

    expectRiskLabelsPresent(['Low', 'Medium', 'High']);
  });

  it('handles onChange event', async () => {
    const handleChange = jest.fn();
    render(<RiskLevelSwitch value={'LOW'} onChange={handleChange} />);

    await clickRiskLevel('High');

    expect(handleChange).toHaveBeenCalledWith('HIGH');
  });

  it('renders disabled inputs with "isDisabled" prop', () => {
    render(<RiskLevelSwitch value={'LOW'} isDisabled />);

    expectAllRiskInputsDisabled(true);
  });

  it('handles radio button clicks when isDisabled is false', async () => {
    const handleChange = jest.fn();
    render(<RiskLevelSwitch value={'LOW'} onChange={handleChange} isDisabled={false} />);

    await clickRiskLevel('High');

    await waitFor(() => expect(handleChange).toHaveBeenCalledWith('HIGH'));
  });
});
