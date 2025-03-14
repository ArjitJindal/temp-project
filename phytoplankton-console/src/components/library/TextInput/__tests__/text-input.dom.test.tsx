import { describe, expect, test } from '@jest/globals';

import React, { useState } from 'react';
import { render, screen, userEvent } from 'testing-library-wrapper';
import TextInput, { Props } from '..';
import TextInputStyles from '../style.module.less';
import {
  FIGMA_VARS_TOKENS_COLOR_STROKE_ACTION,
  FIGMA_VARS_TOKENS_COLOR_STROKE_ERROR,
  FIGMA_VARS_TOKENS_COLOR_STROKE_TERTIARY,
} from '@/components/ui/colors';

describe('Different states', () => {
  test.each<Props['size']>(['X1', 'X2'])('Input is rendered in %p size', async (size) => {
    render(<RenderTextInput size={size} />);
    const rootEl = screen.queryByClassName(TextInputStyles.root);
    expect(rootEl).toBeInTheDocument();
    expect(rootEl).toBeVisible();
  });
  test('Disabled state', () => {
    render(<RenderTextInput isDisabled={true} />);
    const inputEl = getInput();
    expect(inputEl).toBeDisabled();
    const borderColor = getBorderColor();
    expect(borderColor).toBeColor(FIGMA_VARS_TOKENS_COLOR_STROKE_TERTIARY);
  });
  test.each([false, true])('Focused state when error is %p', async (isError) => {
    render(<RenderTextInput isError={isError} />);
    const input = getInput();
    await userEvent.click(input);
    const borderColor = getBorderColor();
    if (isError) {
      expect(borderColor).toEqual(FIGMA_VARS_TOKENS_COLOR_STROKE_ERROR);
    } else {
      expect(borderColor).toEqual(FIGMA_VARS_TOKENS_COLOR_STROKE_ACTION);
    }
  });
  test.each([false, true])('Error state when disabled is %p', (isDisabled) => {
    render(<RenderTextInput isError={true} isDisabled={isDisabled} />);
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
    render(<RenderTextInput />);
    const inputEl = getInput();
    await userEvent.click(inputEl);
    await userEvent.keyboard('abc');
    expect(inputEl).toHaveValue('abc');
    await userEvent.keyboard('{Backspace}{Backspace}{Backspace}');
    expect(inputEl).toHaveValue('');
  });
  test('Clearing', async () => {
    render(<RenderTextInput allowClear={true} />);
    const inputEl = getInput();
    await userEvent.click(inputEl);
    await userEvent.keyboard('abc');
    expect(inputEl).toHaveValue('abc');
    const clearBtn = getClearButton();
    await userEvent.click(clearBtn);
    expect(inputEl).toHaveValue('');
  });
});

/*
  Helpers
 */
function RenderTextInput(props: Props) {
  const [value, setValue] = useState<string>();
  return <TextInput {...props} value={value} onChange={setValue} />;
}

function getInput() {
  return screen.getByRole('textbox');
}

function getClearButton() {
  return screen.getByRole('button', { name: 'Clear' });
}

function getBorderColor(): string {
  const rootEl = screen.getByClassName(TextInputStyles.inputWrapper);
  const style = window.getComputedStyle(rootEl);
  return style.getPropertyValue('border-color').toUpperCase();
}
