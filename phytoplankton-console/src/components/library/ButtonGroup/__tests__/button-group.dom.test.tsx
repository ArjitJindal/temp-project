import { test, describe } from '@jest/globals';
import { render } from 'testing-library-wrapper';
import ButtonGroup from '..';
import {
  expectButtonCount,
  expectButtonTexts,
  expectButtonGroupGap,
  expectNoGapStyle,
} from './button-group.jest-helpers';

describe('ButtonGroup Component', () => {
  test('renders children correctly', () => {
    render(
      <ButtonGroup>
        <button>Button 1</button>
        <button>Button 2</button>
      </ButtonGroup>,
    );
    expectButtonCount(2);
    expectButtonTexts(['Button 1', 'Button 2']);
  });

  test('applies gap style when provided', () => {
    const testGap = 10;
    render(
      <ButtonGroup gap={testGap}>
        <button>Button 1</button>
        <button>Button 2</button>
      </ButtonGroup>,
    );
    expectButtonGroupGap(testGap);
  });

  test('renders without gap when not provided', () => {
    render(
      <ButtonGroup>
        <button>Button 1</button>
        <button>Button 2</button>
      </ButtonGroup>,
    );
    expectNoGapStyle();
  });
});
