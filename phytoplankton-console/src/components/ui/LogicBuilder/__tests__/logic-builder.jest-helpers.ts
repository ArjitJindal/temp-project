import { screen, fireEvent, waitFor } from 'testing-library-wrapper';
import { expect } from '@jest/globals';
import { makeConfig } from '@/components/ui/LogicBuilder/helpers';

/**
 * Generate initial state for LogicBuilder with default or custom configuration
 * @param customConfig Custom configuration to override defaults
 * @returns Initial state object with value, config, and onChange mock
 */
export function generateInitialState(customConfig = {}): {
  value: undefined;
  config: ReturnType<typeof makeConfig>;
  onChange: jest.Mock;
} {
  return {
    value: undefined,
    config: makeConfig({
      fields: { 'Transaction:id': { label: 'Transaction/id', type: 'text' } },
      enableNesting: false,
      ...customConfig,
    }),
    onChange: jest.fn(),
  };
}

/**
 * Find the query builder container element
 * @param container The container element from render result
 * @returns The query builder element or null if not found
 */
export function findQueryBuilder(container: HTMLElement): HTMLElement | null {
  return container.querySelector('.query-builder');
}

/**
 * Find the add condition button
 * @returns Promise resolving to the add condition button element
 */
export async function findAddConditionButton(): Promise<HTMLElement> {
  return await waitFor(() => screen.getByText('Add condition'));
}

/**
 * Click the add condition button
 */
export async function clickAddCondition(): Promise<void> {
  const addConditionButton = await findAddConditionButton();
  fireEvent.click(addConditionButton);
}

/**
 * Find the conjunctions element (AND/OR operators)
 * @param container The container element from render result
 * @returns The conjunctions element or null if not found
 */
export function findConjunctions(container: HTMLElement): HTMLElement | null {
  return container.querySelector('.group--header .group--conjunctions');
}

/**
 * Find the drag handle for reordering
 * @param container The container element from render result
 * @returns The drag handle element or null if not found
 */
export function findDragHandle(container: HTMLElement): HTMLElement | null {
  return container.querySelector('.group--header .group--actions .action--DRAG');
}

/**
 * Find all rule elements
 * @param container The container element from render result
 * @returns Array of rule elements
 */
export function findRules(container: HTMLElement): NodeListOf<Element> {
  return container.querySelectorAll('.rule');
}

/**
 * Find all group elements
 * @param container The container element from render result
 * @returns Array of group elements
 */
export function findGroups(container: HTMLElement): NodeListOf<Element> {
  return container.querySelectorAll('.group');
}

/**
 * Expect the query builder to exist in the document
 * @param container The container element from render result
 */
export function expectQueryBuilderExists(container: HTMLElement): void {
  const queryBuilder = findQueryBuilder(container);
  expect(queryBuilder).toBeInTheDocument();
}

/**
 * Expect the onChange handler to be called with updated values
 * @param onChangeMock The mock onChange function
 */
export function expectOnChangeCalledWithUpdatedValues(onChangeMock: jest.Mock): void {
  const [updatedValue, updatedConfig] = onChangeMock.mock.calls[0];
  expect(updatedValue).toBeDefined();
  expect(updatedConfig).toBeDefined();
}

/**
 * Expect conjunctions to be visible or hidden
 * @param container The container element from render result
 * @param shouldBeVisible Whether conjunctions should be visible
 */
export function expectConjunctionsVisibility(
  container: HTMLElement,
  shouldBeVisible: boolean,
): void {
  const conjunctions = findConjunctions(container);
  if (shouldBeVisible) {
    expect(conjunctions).toBeInTheDocument();
  } else {
    expect(conjunctions).not.toBeInTheDocument();
  }
}

/**
 * Expect reordering to be enabled or disabled
 * @param container The container element from render result
 * @param shouldBeEnabled Whether reordering should be enabled
 */
export function expectReorderingEnabled(container: HTMLElement, shouldBeEnabled: boolean): void {
  const dragHandle = findDragHandle(container);
  if (shouldBeEnabled) {
    expect(dragHandle).toBeInTheDocument();
  } else {
    expect(dragHandle).toBeNull();
  }
}

/**
 * Select a field in a rule
 * @param container The container element from render result
 * @param ruleIndex The index of the rule to select a field in
 * @param fieldName The name of the field to select
 */
export async function selectField(
  container: HTMLElement,
  ruleIndex: number,
  fieldName: string,
): Promise<void> {
  const rules = findRules(container);
  const rule = rules[ruleIndex];

  if (!rule) {
    throw new Error(`Rule at index ${ruleIndex} not found`);
  }

  const fieldSelect = rule.querySelector('.rule--field');
  if (fieldSelect) {
    fireEvent.click(fieldSelect);
    const fieldOption = await waitFor(() => screen.getByText(fieldName));
    fireEvent.click(fieldOption);
  }
}

/**
 * Select an operator in a rule
 * @param container The container element from render result
 * @param ruleIndex The index of the rule to select an operator in
 * @param operatorName The name of the operator to select
 */
export async function selectOperator(
  container: HTMLElement,
  ruleIndex: number,
  operatorName: string,
): Promise<void> {
  const rules = findRules(container);
  const rule = rules[ruleIndex];

  if (!rule) {
    throw new Error(`Rule at index ${ruleIndex} not found`);
  }

  const operatorSelect = rule.querySelector('.rule--operator');
  if (operatorSelect) {
    fireEvent.click(operatorSelect);
    const operatorOption = await waitFor(() => screen.getByText(operatorName));
    fireEvent.click(operatorOption);
  }
}

/**
 * Enter a value in a rule
 * @param container The container element from render result
 * @param ruleIndex The index of the rule to enter a value in
 * @param value The value to enter
 */
export async function enterValue(
  container: HTMLElement,
  ruleIndex: number,
  value: string,
): Promise<void> {
  const rules = findRules(container);
  const rule = rules[ruleIndex];

  if (!rule) {
    throw new Error(`Rule at index ${ruleIndex} not found`);
  }

  const valueInput = rule.querySelector('.rule--value input');
  if (valueInput) {
    fireEvent.change(valueInput, { target: { value } });
  }
}
