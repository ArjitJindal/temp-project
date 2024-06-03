import { test, describe, expect } from '@jest/globals';

import React, { useState, Dispatch, SetStateAction } from 'react';
import { render, screen, userEvent } from 'testing-library-wrapper';
import NumberInput, { Props, Styles as NumberInputStyles } from '..';
import {
  COLORS_V2_ALERT_CRITICAL,
  COLORS_V2_PRIMARY_FLAGRIGHTBLUE,
  COLORS_V2_STATE_DISABLED,
} from '@/components/ui/colors';

describe('Different states', () => {
  test.each<Props['size']>(['DEFAULT', 'LARGE'])('Input is rendered in %p size', async (size) => {
    render(<RenderNumberInput size={size} />);
    const rootEl = screen.queryByClassName(NumberInputStyles.root);
    expect(rootEl).toBeInTheDocument();
    expect(rootEl).toBeVisible();
  });
  test('Disabled state', () => {
    render(<RenderNumberInput isDisabled={true} />);
    const inputEl = getInput();
    expect(inputEl).toBeDisabled();
    const borderColor = getBorderColor();
    expect(borderColor).toBeColor(COLORS_V2_STATE_DISABLED);
  });
  test.each([false, true])('Focused state when error is %p', async (isError) => {
    render(<RenderNumberInput isError={isError} />);
    const input = getInput();
    await userEvent.click(input);
    const borderColor = getBorderColor();
    if (isError) {
      expect(borderColor).toEqual(COLORS_V2_ALERT_CRITICAL);
    } else {
      expect(borderColor).toEqual(COLORS_V2_PRIMARY_FLAGRIGHTBLUE);
    }
  });
  test.each([false, true])('Error state when disabled is %p', (isDisabled) => {
    render(<RenderNumberInput isError={true} isDisabled={isDisabled} />);
    const borderColor = getBorderColor();
    if (isDisabled) {
      expect(borderColor).not.toEqual(COLORS_V2_ALERT_CRITICAL);
    } else {
      expect(borderColor).toEqual(COLORS_V2_ALERT_CRITICAL);
    }
  });
});

describe('Editing', () => {
  test('Simple editing', async () => {
    render(<RenderNumberInput />);
    const inputEl = getInput();
    await userEvent.click(inputEl);
    await userEvent.keyboard('123abc456');
    expect(inputEl).toHaveDisplayValue('123456');
    await userEvent.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}');
    expect(inputEl).toHaveDisplayValue('');
  });
  test('Floating numbers', async () => {
    render(<RenderNumberInput />);
    const inputEl = getInput();
    await userEvent.click(inputEl);
    await userEvent.keyboard('123.45');
    await userEvent.keyboard('{Tab}');
    expect(inputEl).toHaveDisplayValue('123.45');
    await userEvent.click(inputEl);
    await userEvent.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}');
    expect(inputEl).toHaveDisplayValue('');
  });
  test('Floating numbers with coma as separator', async () => {
    render(<RenderNumberInput />);
    const inputEl = getInput();
    await userEvent.click(inputEl);
    await userEvent.keyboard('12,34');
    expect(inputEl).toHaveDisplayValue('12.34');
    await userEvent.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}');
  });
  test('Negative numbers', async () => {
    render(<RenderNumberInput />);
    const inputEl = getInput();
    await userEvent.click(inputEl);
    await userEvent.keyboard('-123');
    expect(inputEl).toHaveDisplayValue('-123');
    await userEvent.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}');
    expect(inputEl).toHaveDisplayValue('');
  });
  test('Min/max values', async () => {
    render(<RenderNumberInput min={5} max={10} allowClear={true} />);
    const inputEl = getInput();
    await userEvent.click(inputEl);
    await userEvent.keyboard('123');
    await userEvent.keyboard('{Tab}');
    expect(inputEl).toHaveDisplayValue('10');
    const clearBtn = getClearButton();
    await userEvent.click(clearBtn);
    await userEvent.click(inputEl);
    await userEvent.keyboard('2');
    await userEvent.keyboard('{Tab}');
    expect(inputEl).toHaveDisplayValue('5');
  });
  test('Clearing', async () => {
    render(<RenderNumberInput allowClear={true} />);
    const inputEl = getInput();
    await userEvent.click(inputEl);
    await userEvent.keyboard('123');
    expect(inputEl).toHaveDisplayValue('123');
    const clearBtn = getClearButton();
    await userEvent.click(clearBtn);
    expect(inputEl).toHaveDisplayValue('');
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
    const inputEl = getInput();
    const stateEl = screen.getByTestId('state');
    await userEvent.click(inputEl);
    await userEvent.keyboard('123abc456');
    expect(inputEl).toHaveDisplayValue('123456');
    expect(stateEl).toHaveTextContent('123456');
    await userEvent.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}');
    expect(inputEl).toHaveDisplayValue('');
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
    const inputEl = getInput();
    const stateEl = screen.getByTestId('state');
    await userEvent.click(inputEl);
    await userEvent.keyboard('123abc456');
    expect(inputEl).toHaveDisplayValue('123456');
    expect(stateEl).toHaveTextContent('');
    await userEvent.keyboard('{Tab}');
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

function getInput() {
  return screen.getByRole('textbox');
}

function getClearButton() {
  return screen.getByRole('button', { name: 'Clear' });
}

function getBorderColor(): string {
  const rootEl = screen.getByClassName(NumberInputStyles.root);
  const style = window.getComputedStyle(rootEl);
  return style.getPropertyValue('border-color');
}
