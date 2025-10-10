import { screen, userEvent, within } from 'testing-library-wrapper';
import { expect } from '@jest/globals';
import InputFieldStyles from '@/components/library/Form/InputField/index.module.less';
import CardStyles from '@/components/ui/Card/index.module.less';
import ArrayPropertyInputStyles from '@/components/library/JsonSchemaEditor/Property/PropertyInput/ArrayPropertyInput/style.module.less';
import ExpandIconStyles from '@/components/library/ExpandIcon/style.module.less';

/**
 * Find an input field by its field name
 * @param fieldName The name of the field
 * @returns The field element
 */
export async function findInputField(fieldName: string): Promise<HTMLElement> {
  const result = await screen.queryByTestId(`Property/${fieldName}`);
  expect(result).not.toBeNull();
  return result as HTMLElement;
}

/**
 * Add an item to an array field
 * @param arrayField The array field element
 * @returns The newly added item element
 */
export async function addArrayItem(arrayField: HTMLElement): Promise<HTMLElement> {
  const addItemButton = await within(arrayField).findByClassName(
    ArrayPropertyInputStyles.addButton,
  );
  await userEvent.click(addItemButton);
  const itemsEl = await within(arrayField).findByClassName(ArrayPropertyInputStyles.items);
  const items = await within(itemsEl).queryAllByClassName(CardStyles.root);
  expect(items).not.toHaveLength(0);
  return items[items.length - 1];
}

/**
 * Toggle the expanded state of an array item
 * @param item The array item element
 * @param expectedOpenState Optional expected state after toggling
 */
export async function toggleArrayItem(
  item: HTMLElement,
  expectedOpenState?: boolean,
): Promise<void> {
  const expandButton = await within(item).findByClassName(ExpandIconStyles.root);
  await userEvent.click(expandButton);
  if (expectedOpenState != null) {
    if (expectedOpenState) {
      expect(item).not.toHaveClass(CardStyles.isCollapsed);
    } else {
      expect(item).toHaveClass(CardStyles.isCollapsed);
    }
  }
}

/**
 * Toggle the expanded state of an item by clicking on it
 * @param item The item element
 */
export async function toggleItem(item: HTMLElement): Promise<void> {
  await userEvent.click(item);
}

/**
 * Check if an array item has an error state
 * @param item The array item element
 * @param isErrorExpected Whether an error is expected
 */
export async function expectArrayItemError(
  item: HTMLElement,
  isErrorExpected: boolean,
): Promise<void> {
  if (isErrorExpected) {
    expect(item).toHaveClass(CardStyles.isInvalid);
  } else {
    expect(item).not.toHaveClass(CardStyles.isInvalid);
  }
}

/**
 * Check if a field has an error state
 * @param inputField The input field element
 * @param isErrorExpected Whether an error is expected
 */
export async function expectFieldError(
  inputField: HTMLElement,
  isErrorExpected: boolean,
): Promise<void> {
  if (isErrorExpected) {
    const hint = await within(inputField).findByClassName(InputFieldStyles.hint);
    expect(hint).toHaveClass(InputFieldStyles.isError);
    expect(hint).toHaveTextContent('This field can not be empty');
  } else {
    const hint = await within(inputField).queryByClassName(InputFieldStyles.hint);
    expect(hint).toBeNull();
  }
}

/**
 * Type text into an input field
 * @param inputField The input field element
 * @param text The text to type
 */
export async function typeIntoField(inputField: HTMLElement, text: string): Promise<void> {
  await userEvent.click(inputField);
  if (text.length > 0) {
    await userEvent.keyboard(text);
  }
}

/**
 * Clear the content of an input field
 * @param inputField The input field element
 * @param backspaceCount Number of times to press backspace (default: 3)
 */
export async function clearField(inputField: HTMLElement, backspaceCount: number): Promise<void> {
  await userEvent.click(inputField);
  await userEvent.keyboard('{Backspace}'.repeat(backspaceCount));
}
