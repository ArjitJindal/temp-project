import { test, describe, expect } from '@jest/globals';
import { render, screen } from 'testing-library-wrapper';
import ButtonGroup from '..';

describe('ButtonGroup Component', () => {
  test('renders children correctly', () => {
    render(
      <ButtonGroup>
        <button>Button 1</button>
        <button>Button 2</button>
      </ButtonGroup>,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveTextContent('Button 1');
    expect(buttons[1]).toHaveTextContent('Button 2');
  });

  test('applies gap style when provided', () => {
    const testGap = 10;
    render(
      <ButtonGroup gap={testGap}>
        <button>Button 1</button>
        <button>Button 2</button>
      </ButtonGroup>,
    );
    const buttonGroupDiv = screen.getByText('Button 1').parentElement;
    expect(buttonGroupDiv).toHaveStyle(`gap: ${testGap}px`);
  });

  test('renders without gap when not provided', () => {
    render(
      <ButtonGroup>
        <button>Button 1</button>
        <button>Button 2</button>
      </ButtonGroup>,
    );
    const buttonGroupDiv = screen.getByTestId('button-group');

    // Check if the style attribute is either not set or empty
    const styleAttribute = buttonGroupDiv.getAttribute('style');
    expect(styleAttribute).toBeFalsy();
  });
});
