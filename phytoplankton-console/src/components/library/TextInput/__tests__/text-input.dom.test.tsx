import { describe, expect, test } from '@jest/globals';

import React, { useState } from 'react';
import { render, screen } from 'testing-library-wrapper';
import TextInput, { Props } from '..';
import TextInputStyles from '../style.module.less';
import {
  getBorderColor,
  typeIntoInput,
  clearInput,
  expectInputValue,
  expectInputDisabled,
  expectBorderColor,
  clickInput,
} from './text-input.jest-helpers';
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
    expectInputDisabled(true);
    expectBorderColor(FIGMA_VARS_TOKENS_COLOR_STROKE_TERTIARY);
  });
  test.each([false, true])('Focused state when error is %p', async (isError) => {
    render(<RenderTextInput isError={isError} />);
    await clickInput();
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
    await typeIntoInput('abc');
    expectInputValue('abc');
    await typeIntoInput('{Backspace}{Backspace}{Backspace}');
    expectInputValue('');
  });
  test('Clearing', async () => {
    render(<RenderTextInput allowClear={true} />);
    await typeIntoInput('abc');
    expectInputValue('abc');
    await clearInput();
    expectInputValue('');
  });
});

/*
  Helpers
 */
function RenderTextInput(props: Props) {
  const [value, setValue] = useState<string>();
  return <TextInput {...props} value={value} onChange={setValue} />;
}
