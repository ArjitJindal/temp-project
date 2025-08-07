import { describe, expect } from '@jest/globals';
import { render, waitFor } from 'testing-library-wrapper';
import {
  clickStep,
  findStepByNumber,
  expectStepOptional,
  expectStepHasClass,
  expectStepperLayout,
} from './stepper.jest-helpers';
import Stepper from '@/components/library/Stepper';
import '@testing-library/jest-dom/extend-expect';

describe('Stepper Component', () => {
  const styles = {
    optional: 'src_components_library_Stepper_style_module_less___optional',
    isInvalid: 'src_components_library_Stepper_style_module_less___isInvalid',
    isUnfilled: 'src_components_library_Stepper_style_module_less___inUnfilled',
  };
  const steps = [
    {
      key: 'first_item',
      title: 'Basic details',
      description: 'Configure the basic details for this rule',
      isUnfilled: true,
    },
    {
      key: 'second_item',
      title: 'Standard filters',
      description:
        'Configure filters that are applicable to all rules. This decription can be quite long',
      isOptional: true,
    },
    {
      key: 'third_item',
      title: 'Third step',
      description: 'This step is invalid',
      isOptional: true,
      isInvalid: true,
    },
    {
      key: 'last_item',
      title: 'Last step',
      description: 'Some short description here',
      isOptional: true,
    },
  ];

  it('handles step click and calls onChange correctly', async () => {
    const handleChange = jest.fn();
    render(<Stepper steps={steps} active={steps[0].key} onChange={handleChange} />);

    // Click on the second step
    await clickStep(steps[1].title);

    // Check if onChange is called with the correct step key
    expect(handleChange).toHaveBeenCalledWith(steps[1].key);
  });

  it('handles step click correctly', async () => {
    const mockOnChange = jest.fn();
    render(<Stepper steps={steps} active={steps[0].key} onChange={mockOnChange} />);

    // Click on the second step
    await clickStep('Standard filters');

    // Check if the onChange function is called with the correct key
    expect(mockOnChange).toHaveBeenCalledWith('second_item');
  });

  it('renders the correct step number', () => {
    render(<Stepper steps={steps} active={steps[0].key} onChange={() => {}} />);
    const stepNumber = findStepByNumber('1');
    expect(stepNumber).toBeInTheDocument();
  });

  it('renders children component correctly based on active step', async () => {
    const mockChildren = jest.fn();
    render(
      <Stepper steps={steps} active={steps[0].key} onChange={() => {}} children={mockChildren} />,
    );
    await waitFor(() => expect(mockChildren).toHaveBeenCalledWith(steps[0].key));
  });

  it('handles layout prop correctly for Vertical layout', () => {
    render(<Stepper steps={steps} active={steps[0].key} onChange={() => {}} layout="VERTICAL" />);
    expectStepperLayout('VERTICAL');
  });

  it('handles layout prop correctly for Horizontal layout', () => {
    render(<Stepper steps={steps} active={steps[0].key} onChange={() => {}} layout="HORIZONTAL" />);
    expectStepperLayout('HORIZONTAL');
  });

  it('renders optional indicator for optional steps', () => {
    render(<Stepper steps={steps} active={steps[0].key} onChange={() => {}} />);
    expectStepOptional('Standard filters', true);
    expectStepOptional('Last step', true);
    expectStepOptional('Basic details', false);
  });

  it('renders steps with "isOptional" class when isOptional is true', () => {
    render(<Stepper steps={steps} active={steps[1].key} onChange={() => {}} />);
    expectStepOptional('Standard filters', true);
  });

  it('renders steps with "isInvalid" class when isInvalid is true', () => {
    render(<Stepper steps={steps} active={steps[2].key} onChange={() => {}} />);
    expectStepHasClass('Third step', styles.isInvalid);
  });

  it('renders steps with "isUnfilled" class when isUnfilled is true', () => {
    render(<Stepper steps={steps} active={steps[0].key} onChange={() => {}} />);
    expectStepHasClass('Basic details', styles.isUnfilled);
  });
});
