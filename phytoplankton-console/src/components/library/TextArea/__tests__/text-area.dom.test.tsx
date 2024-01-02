import { test, describe, expect } from '@jest/globals';

import React, { useState } from 'react';
import { render, screen, userEvent } from 'testing-library-wrapper';
import TextArea, { Props } from '..';
import TextAreaStyles from '../styles.module.less';
import {
  COLORS_V2_ALERT_CRITICAL,
  COLORS_V2_PRIMARY_FLAGRIGHTBLUE,
  COLORS_V2_STATE_DISABLED,
} from '@/components/ui/colors';

describe('Different states', () => {
  test('Disabled state', () => {
    render(<RenderTextArea isDisabled={true} />);
    const inputEl = getInput();
    expect(inputEl).toBeDisabled();
    const borderColor = getBorderColor();
    expect(borderColor).toBeColor(COLORS_V2_STATE_DISABLED);
  });
  test.each([false, true])('Focused state when error is %p', async (isError) => {
    render(<RenderTextArea isError={isError} />);
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
    render(<RenderTextArea isError={true} isDisabled={isDisabled} />);
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
    render(<RenderTextArea />);
    const inputEl = getInput();
    await userEvent.click(inputEl);
    await userEvent.keyboard('abc');
    expect(inputEl).toHaveValue('abc');
    await userEvent.keyboard('{Backspace}{Backspace}{Backspace}');
    expect(inputEl).toHaveValue('');
  });
  test('Length limit', async () => {
    render(<RenderTextArea maxLength={5} />);
    const inputEl = getInput();
    await userEvent.click(inputEl);
    await userEvent.keyboard('12345xyz');
    expect(inputEl).toHaveValue('12345');
    await userEvent.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}');
    expect(inputEl).toHaveValue('');
  });
});

/*
  Helpers
 */
function RenderTextArea(props: Props) {
  const [value, setValue] = useState<string>();
  return <TextArea {...props} value={value} onChange={setValue} />;
}

function getInput() {
  return screen.getByRole('textbox');
}

function getBorderColor(): string {
  const rootEl = screen.getByClassName(TextAreaStyles.root);
  const style = window.getComputedStyle(rootEl);
  return style.getPropertyValue('border-color');
}
