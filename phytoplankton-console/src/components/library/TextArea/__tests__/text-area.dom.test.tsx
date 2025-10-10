import { describe, expect, test } from '@jest/globals';

import React, { useState } from 'react';
import { render } from 'testing-library-wrapper';
import TextArea, { Props } from '..';
import {
  getBorderColor,
  typeIntoTextArea,
  expectTextAreaValue,
  expectTextAreaDisabled,
  expectBorderColor,
  clickTextArea,
} from './text-area.jest-helpers';
import {
  FIGMA_VARS_TOKENS_COLOR_STROKE_ACTION,
  FIGMA_VARS_TOKENS_COLOR_STROKE_ERROR,
  FIGMA_VARS_TOKENS_COLOR_STROKE_TERTIARY,
} from '@/components/ui/colors';

describe('Different states', () => {
  test('Disabled state', () => {
    render(<RenderTextArea isDisabled={true} />);
    expectTextAreaDisabled(true);
    expectBorderColor(FIGMA_VARS_TOKENS_COLOR_STROKE_TERTIARY);
  });
  test.each([false, true])('Focused state when error is %p', async (isError) => {
    render(<RenderTextArea isError={isError} />);
    await clickTextArea();
    const borderColor = getBorderColor();
    if (isError) {
      expect(borderColor).toEqual(FIGMA_VARS_TOKENS_COLOR_STROKE_ERROR);
    } else {
      expect(borderColor).toEqual(FIGMA_VARS_TOKENS_COLOR_STROKE_ACTION);
    }
  });
  test.each([false, true])('Error state when disabled is %p', (isDisabled) => {
    render(<RenderTextArea isError={true} isDisabled={isDisabled} />);
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
    render(<RenderTextArea />);
    await typeIntoTextArea('abc');
    expectTextAreaValue('abc');
    await typeIntoTextArea('{Backspace}{Backspace}{Backspace}');
    expectTextAreaValue('');
  });
  test('Length limit', async () => {
    render(<RenderTextArea maxLength={5} />);
    await typeIntoTextArea('12345xyz');
    expectTextAreaValue('12345');
    await typeIntoTextArea('{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}');
    expectTextAreaValue('');
  });
});

/*
  Helpers
 */
function RenderTextArea(props: Props) {
  const [value, setValue] = useState<string>();
  return <TextArea {...props} value={value} onChange={setValue} />;
}
