import '@testing-library/jest-dom';
import { describe } from '@jest/globals';
import { render } from 'testing-library-wrapper';
import LogicBuilder from '..';
import {
  generateInitialState,
  expectQueryBuilderExists,
  expectOnChangeCalledWithUpdatedValues,
  expectConjunctionsVisibility,
  expectReorderingEnabled,
  clickAddCondition,
  findAddConditionButton,
} from './logic-builder.jest-helpers';

describe('LogicBuilder Component', () => {
  it.skip('renders LogicBuilder with basic configuration', () => {
    const initialState = generateInitialState();
    const { container } = render(<LogicBuilder {...initialState} />);
    expectQueryBuilderExists(container);
  });

  it.skip('updates value on user interaction', async () => {
    const initialState = generateInitialState();
    render(<LogicBuilder {...initialState} />);

    await findAddConditionButton();
    await clickAddCondition();

    expectOnChangeCalledWithUpdatedValues(initialState.onChange);
  });

  it.skip('hides conjunctions when specified', () => {
    const initialState = generateInitialState({ enableNesting: false });
    const { container } = render(<LogicBuilder {...initialState} hideConjunctions={true} />);

    // Assert that conjunctions are hidden
    expectConjunctionsVisibility(container, false);
  });

  it('disables reordering when specified', () => {
    const initialState = generateInitialState({ enableReorder: false });
    const { container } = render(<LogicBuilder {...initialState} />);

    // Assert that reordering is disabled
    expectReorderingEnabled(container, false);
  });
});
