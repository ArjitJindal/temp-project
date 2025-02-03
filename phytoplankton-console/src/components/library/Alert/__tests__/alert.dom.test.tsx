import { describe, expect, test } from '@jest/globals';
import { render, screen } from 'testing-library-wrapper';
import Alert, { AlertType } from '..';
import {
  FIGMA_VARS_TOKENS_COLOR_STROKE_ACTION,
  FIGMA_VARS_TOKENS_COLOR_STROKE_ERROR,
  FIGMA_VARS_TOKENS_COLOR_STROKE_SUCCESS,
  FIGMA_VARS_TOKENS_COLOR_STROKE_WARNING,
} from '@/components/ui/figma-vars';

const ALERT_TYPES: AlertType[] = ['ERROR', 'WARNING', 'INFO', 'SUCCESS'];

const ALERT_BORDER_COLORS: {
  [key in AlertType]: string;
} = {
  ERROR: FIGMA_VARS_TOKENS_COLOR_STROKE_ERROR,
  WARNING: FIGMA_VARS_TOKENS_COLOR_STROKE_WARNING,
  INFO: FIGMA_VARS_TOKENS_COLOR_STROKE_ACTION,
  SUCCESS: FIGMA_VARS_TOKENS_COLOR_STROKE_SUCCESS,
};

describe('Alert Component', () => {
  test.each(ALERT_TYPES)(`renders correctly for type %t`, (type) => {
    render(<Alert type={type}>Test Message</Alert>);
    const alert = screen.getByTestId(`alert-${type}`);
    const classNames = Array.from(alert.classList);
    const hasTypeClass = classNames.some((c) => c.includes(`type-${type}`));
    expect(hasTypeClass).toBe(true);

    const svgElement = alert.querySelector(`svg[data-cy=icon-${type}]`);
    expect(svgElement).toBeInTheDocument();
  });

  test.each(ALERT_TYPES)(`renders style correctly`, (type) => {
    render(<Alert type={type}>Test Message</Alert>);
    const alert = screen.getByTestId(`alert-${type}`);

    const style = window.getComputedStyle(alert);
    const color = style.getPropertyValue('border-color');

    expect(color).toBeColor(ALERT_BORDER_COLORS[type]);
  });

  test('displays children content', () => {
    const message = 'This is an alert message';
    render(<Alert type="ERROR">{message}</Alert>);
    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
