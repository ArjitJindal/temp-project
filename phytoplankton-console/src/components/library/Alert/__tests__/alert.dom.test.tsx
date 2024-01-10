import { test, describe, expect } from '@jest/globals';
import { render, screen } from 'testing-library-wrapper';
import Alert from '..';
import COLORS, {
  COLORS_V2_ALERT_ERROR,
  COLORS_V2_ALERT_WARNING,
  COLORS_V2_PRIMARY_TINTS_BLUE_900,
} from '@/components/ui/colors';

type AlertType = 'error' | 'warning' | 'info' | 'success';

const ALERT_TYPES: AlertType[] = ['error', 'warning', 'info', 'success'];

const ALERT_BORDER_COLORS: {
  [key in AlertType]: string;
} = {
  error: COLORS_V2_ALERT_ERROR,
  warning: COLORS_V2_ALERT_WARNING,
  info: COLORS_V2_PRIMARY_TINTS_BLUE_900,
  success: COLORS.leafGreen.base,
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
    render(<Alert type="error">{message}</Alert>);
    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
