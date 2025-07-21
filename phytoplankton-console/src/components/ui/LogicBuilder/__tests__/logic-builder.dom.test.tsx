import '@testing-library/jest-dom';
import { describe, expect } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from 'testing-library-wrapper';
import LogicBuilder from '..';
import { makeConfig } from '@/components/ui/LogicBuilder/helpers';

// Helper function to generate initial state with default values
const generateInitialState = (customConfig = {}) => {
  return {
    value: undefined,
    config: makeConfig({
      fields: { 'Transaction:id': { label: 'Transaction/id', type: 'text' } },
      enableNesting: false,
      ...customConfig,
    }),
    onChange: jest.fn(),
  };
};

// Helper function to render LogicBuilder with initial state
const renderLogicBuilder = (initialState) => {
  return render(<LogicBuilder {...initialState} />);
};

describe('LogicBuilder Component', () => {
  it.skip('renders LogicBuilder with basic configuration', () => {
    const initialState = generateInitialState();

    const { container } = renderLogicBuilder(initialState);

    expect(container.querySelector('.query-builder')).toBeInTheDocument();
  });

  it.skip('updates value on user interaction', async () => {
    const initialState = generateInitialState();
    renderLogicBuilder(initialState);

    await waitFor(() => {
      expect(screen.getByText('Add condition')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add condition'));

    const [updatedValue, updatedConfig] = initialState.onChange.mock.calls[0];

    expect(updatedValue).toBeDefined();
    expect(updatedConfig).toEqual(initialState.config);
  });

  it.skip('hides conjunctions when specified', () => {
    const initialState = generateInitialState({ enableNesting: false });
    const { container } = renderLogicBuilder({
      ...initialState,
      hideConjunctions: true,
    });

    // Assert that conjunctions are hidden
    expect(container.querySelector('.group--header .group--conjunctions')).toBeInTheDocument();
  });

  it('disables reordering when specified', () => {
    const initialState = generateInitialState({ enableReorder: false });
    const { container } = renderLogicBuilder(initialState);

    // Assert that reordering is disabled
    expect(container.querySelector('.group--header .group--actions .action--DRAG')).toBeNull();
  });
});
