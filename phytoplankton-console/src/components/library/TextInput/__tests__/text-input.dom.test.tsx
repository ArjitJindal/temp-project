import { test, describe, expect } from '@jest/globals';

import React, { useState } from 'react';
import { render, screen, userEvent } from 'testing-library-wrapper';
import TextInput, { Props } from '..';
import TextInputStyles from '../style.module.less';
import {
  COLORS_V2_ALERT_CRITICAL,
  COLORS_V2_PRIMARY_FLAGRIGHTBLUE,
  COLORS_V2_STATE_DISABLED,
} from '@/components/ui/colors';

describe('Different states', () => {
  test.each<Props['size']>(['DEFAULT', 'LARGE'])('Input is rendered in %p size', async (size) => {
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
    expect(borderColor).toBeColor(COLORS_V2_STATE_DISABLED);
  });
  test.each([false, true])('Focused state when error is %p', async (isError) => {
    render(<RenderTextInput isError={isError} />);
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
    render(<RenderTextInput isError={true} isDisabled={isDisabled} />);
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
  const rootEl = screen.getByClassName(TextInputStyles.root);
  const style = window.getComputedStyle(rootEl);
  return style.getPropertyValue('border-color');
}
