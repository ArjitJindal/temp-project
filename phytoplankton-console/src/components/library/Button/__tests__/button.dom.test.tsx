import { test, describe, expect } from '@jest/globals';
import { render } from 'testing-library-wrapper';
import Button, { ButtonSize, ButtonType } from '..';
import {
  expectButtonDisabled,
  expectButtonType,
  expectButtonSize,
  clickButton,
} from './button.jest-helpers';

const BUTTON_TYPES: ButtonType[] = ['PRIMARY', 'SECONDARY', 'TETRIARY', 'TEXT', 'DANGER'];
const BUTTON_SIZES: ButtonSize[] = ['SMALL', 'MEDIUM', 'LARGE'];

describe('Button Component', () => {
  test.each(BUTTON_TYPES)('renders correctly for type %s', (type) => {
    render(<Button type={type}>Test</Button>);
    expectButtonType('Test', type);
  });

  test.each(BUTTON_SIZES)('renders correctly for size %s', (size) => {
    render(<Button size={size}>Test</Button>);
    expectButtonSize('Test', size);
  });

  test('handles click events', async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);
    await clickButton('Click Me');
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('is disabled when isDisabled is true', () => {
    render(<Button isDisabled={true}>Disabled</Button>);
    expectButtonDisabled('Disabled', true);
  });

  test('is disabled when isLoading is true', () => {
    render(<Button isLoading={true}>Loading</Button>);
    expectButtonDisabled('Loading', true);
  });
});
