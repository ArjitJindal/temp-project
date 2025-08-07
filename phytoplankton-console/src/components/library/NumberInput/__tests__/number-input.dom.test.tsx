import { describe, expect, test } from '@jest/globals';

import { Dispatch, SetStateAction, useState } from 'react';
import { render, screen } from 'testing-library-wrapper';
import NumberInput, { Props, Styles as NumberInputStyles } from '..';
import {
  typeIntoInput,
  clearInputByBackspace,
  clearInputWithButton,
  expectInputValue,
  expectInputDisabled,
  expectBorderColor,
  tabOutOfInput,
  getBorderColor,
} from './number-input.jest-helpers';
import {
  FIGMA_VARS_TOKENS_COLOR_STROKE_ACTION,
  FIGMA_VARS_TOKENS_COLOR_STROKE_ERROR,
  FIGMA_VARS_TOKENS_COLOR_STROKE_TERTIARY,
} from '@/components/ui/colors';

describe('Different states', () => {
  test.each<Props['size']>(['X1', 'X2'])('Input is rendered in %p size', async (size) => {
    render(<RenderNumberInput size={size} />);
    const rootEl = screen.queryByClassName(NumberInputStyles.root);
    expect(rootEl).toBeInTheDocument();
    expect(rootEl).toBeVisible();
  });
  test('Disabled state', () => {
    render(<RenderNumberInput isDisabled={true} />);
    expectInputDisabled(true);
    expectBorderColor(FIGMA_VARS_TOKENS_COLOR_STROKE_TERTIARY);
  });
  test.each([false, true])('Focused state when error is %p', async (isError) => {
    render(<RenderNumberInput isError={isError} />);
    await typeIntoInput('123');
    const borderColor = getBorderColor();
    if (isError) {
      expect(borderColor).toEqual(FIGMA_VARS_TOKENS_COLOR_STROKE_ERROR);
    } else {
      expect(borderColor).toEqual(FIGMA_VARS_TOKENS_COLOR_STROKE_ACTION);
    }
  });
  test.each([false, true])('Error state when disabled is %p', (isDisabled) => {
    render(<RenderNumberInput isError={true} isDisabled={isDisabled} />);
    const borderColor = getBorderColor();
    if (isDisabled) {
      expect(borderColor).not.toEqual(FIGMA_VARS_TOKENS_COLOR_STROKE_ERROR);
    } else {
      expect(borderColor).toEqual(FIGMA_VARS_TOKENS_COLOR_STROKE_ERROR);
    }
  });
});

describe('Editing', () => {
  test('Simple editing', async () => {
    render(<RenderNumberInput />);
    await typeIntoInput('123abc456');
    expectInputValue('123456');
    await clearInputByBackspace();
    expectInputValue('');
  });
  test('Floating numbers', async () => {
    render(<RenderNumberInput />);
    await typeIntoInput('123.45');
    await tabOutOfInput();
    expectInputValue('123.45');
    await typeIntoInput('');
    await clearInputByBackspace();
    expectInputValue('');
  });
  test('Floating numbers with coma as separator', async () => {
    render(<RenderNumberInput />);
    await typeIntoInput('12,34');
    expectInputValue('12.34');
    await clearInputByBackspace();
  });
  test('Negative numbers', async () => {
    render(<RenderNumberInput />);
    await typeIntoInput('-123');
    expectInputValue('-123');
    await clearInputByBackspace();
    expectInputValue('');
  });
  test('Min/max values', async () => {
    render(<RenderNumberInput min={5} max={10} allowClear={true} />);
    await typeIntoInput('123');
    await tabOutOfInput();
    expectInputValue('10');
    await clearInputWithButton();
    await typeIntoInput('2');
    await tabOutOfInput();
    expectInputValue('5');
  });
  test('Clearing', async () => {
    render(<RenderNumberInput allowClear={true} />);
    await typeIntoInput('123');
    expectInputValue('123');
    await clearInputWithButton();
    expectInputValue('');
  });
});

describe('Confirm modes', () => {
  test('ON_CHANGE', async () => {
    render(
      <RenderWithState<number>>
        {([value, setValue]) => (
          <div>
            <p data-cy="state">{value}</p>
            <NumberInput commitMode={'ON_CHANGE'} value={value} onChange={setValue} />
          </div>
        )}
      </RenderWithState>,
    );
    const stateEl = screen.getByTestId('state');
    await typeIntoInput('123abc456');
    expectInputValue('123456');
    expect(stateEl).toHaveTextContent('123456');
    await clearInputByBackspace();
    expectInputValue('');
    expect(stateEl).toHaveTextContent('');
  });
  test('ON_BLUR', async () => {
    render(
      <RenderWithState<number>>
        {([value, setValue]) => (
          <div>
            <p data-cy="state">{value}</p>
            <NumberInput commitMode={'ON_BLUR'} value={value} onChange={setValue} />
          </div>
        )}
      </RenderWithState>,
    );
    const stateEl = screen.getByTestId('state');
    await typeIntoInput('123abc456');
    expectInputValue('123456');
    expect(stateEl).toHaveTextContent('');
    await tabOutOfInput();
    expect(stateEl).toHaveTextContent('123456');
  });
});

/*
  Helpers
 */
function RenderWithState<T>(props: {
  children: (state: [T | undefined, Dispatch<SetStateAction<T | undefined>>]) => JSX.Element;
}) {
  const state = useState<T | undefined>(undefined);
  return <>{props.children(state)}</>;
}

function RenderNumberInput(props: Props) {
  return (
    <RenderWithState<number>>
      {([value, setValue]) => <NumberInput {...props} value={value} onChange={setValue} />}
    </RenderWithState>
  );
}
