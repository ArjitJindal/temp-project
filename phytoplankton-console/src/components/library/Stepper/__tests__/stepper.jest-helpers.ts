import { screen, fireEvent, within } from 'testing-library-wrapper';
import { expect } from '@jest/globals';

/**
 * Find a step by its title
 * @param title The title of the step
 * @returns The step element
 */
export function findStepByTitle(title: string): HTMLElement {
  return screen.getByText(title);
}

/**
 * Click on a step
 * @param title The title of the step
 */
export async function clickStep(title: string): Promise<void> {
  const step = findStepByTitle(title);
  fireEvent.click(step);
}

/**
 * Find a step by its number
 * @param number The number of the step
 * @returns The step element
 */
export function findStepByNumber(number: string): HTMLElement {
  return screen.getByText(number);
}

/**
 * Expect a step to have the optional indicator
 * @param title The title of the step
 * @param isOptional Whether the step should have the optional indicator
 */
export function expectStepOptional(title: string, isOptional: boolean): void {
  const step = findStepByTitle(title);

  if (isOptional) {
    expect(step).toHaveTextContent(/optional/i);
    const optionalSpan = within(step).getByTestId('optional-span');
    expect(optionalSpan).toBeInTheDocument();
  } else {
    expect(step).not.toHaveTextContent(/optional/i);
  }
}

/**
 * Expect a step to have the invalid class
 * @param title The title of the step
 * @param className The class name to check for
 */
export function expectStepHasClass(title: string, className: string): void {
  const steps = screen.queryAllByTestId('step-prop');

  const matchingStep = steps.find((step) => {
    return step.textContent?.includes(title) && step.classList.contains(className);
  });

  expect(matchingStep).toBeTruthy();
}

/**
 * Expect the stepper to have the correct layout
 * @param layout The layout to check for (VERTICAL or HORIZONTAL)
 */
export function expectStepperLayout(layout: 'VERTICAL' | 'HORIZONTAL'): void {
  const stepper = screen.getByTestId('stepper');
  expect(stepper.className).toContain(`layout-${layout}`);
}
