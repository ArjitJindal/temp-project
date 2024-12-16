import { test, describe, expect } from '@jest/globals';
import { render, screen, userEvent } from 'testing-library-wrapper';
import Button, { ButtonSize, ButtonType } from '..';

const BUTTON_TYPES: ButtonType[] = ['PRIMARY', 'SECONDARY', 'TETRIARY', 'TEXT', 'DANGER'];
const BUTTON_SIZES: ButtonSize[] = ['SMALL', 'MEDIUM', 'LARGE'];

describe('Button Component', () => {
  test.each(BUTTON_TYPES)('renders correctly for type %s', (type) => {
    render(<Button type={type}>Test</Button>);
    const button = getInput('Test');
    const classNames = Array.from(button.classList);
    const hasTypeClass = classNames?.some((className) => className.includes(`type-${type}`));
    expect(hasTypeClass).toBe(true);
  });

  test.each(BUTTON_SIZES)('renders correctly for size %s', (size) => {
    render(<Button size={size}>Test</Button>);
    const button = getInput('Test');
    const classNames = Array.from(button.classList);
    const hasSizeClass = classNames?.some((className) => className.includes(`size-${size}`));
    expect(hasSizeClass).toBe(true);
  });

  test('handles click events', async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);
    const button = getInput('Click Me');
    await userEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('is disabled when isDisabled is true', () => {
    render(<Button isDisabled={true}>Disabled</Button>);
    const button = getInput('Disabled');
    expect(button).toBeDisabled();
  });

  test('is disabled when isLoading is true', () => {
    render(<Button isLoading={true}>Loading</Button>);
    const button = getInput('Loading');
    expect(button).toBeDisabled();
  });
});

function getInput(text: string) {
  return screen.getByText(text);
}
