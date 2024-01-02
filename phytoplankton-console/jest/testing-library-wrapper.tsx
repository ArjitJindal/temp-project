import * as TestingLibrary from '@testing-library/react';
import { StorybookMockProviders } from '@/components/AppWrapper/Providers';
import { Matcher, MatcherOptions } from '@testing-library/dom/types/matches';

function ProvidersWrapper({ children }: { children: React.ReactNode }) {
  return <StorybookMockProviders>{children}</StorybookMockProviders>;
}

TestingLibrary.configure({
  testIdAttribute: 'data-cy',
});

const queryAllByClassName = (
  container: HTMLElement,
  id: Matcher,
  options?: MatcherOptions,
): HTMLElement[] => {
  if (options != null) {
    throw new Error(`queryAllByClassName: options are not supported`);
  }
  if (typeof id !== 'string') {
    throw new Error(`queryAllByClassName: this query only support strings as a matcher`);
  }
  return Array.from(container.querySelectorAll(`.${id}`));
};
const getMultipleError = (c, value) => `Found multiple elements with the class of: ${value}`;
const getMissingError = (c, value) => `Unable to find an element with the class of: ${value}`;

const [queryByClassName, getAllByClassName, getByClassName, findAllByClassName, findByClassName] =
  TestingLibrary.buildQueries(queryAllByClassName, getMultipleError, getMissingError);

const customQueries = {
  queryByClassName,
  queryAllByClassName,
  getByClassName,
  getAllByClassName,
  findAllByClassName,
  findByClassName,
};

const allQueries = {
  ...TestingLibrary.queries,
  ...customQueries,
};
const customWithin = (element: HTMLElement) => TestingLibrary.within(element, allQueries);
const customScreen = {
  ...TestingLibrary.within(document.body, allQueries),
  debug: TestingLibrary.screen.debug,
};

export * from '@testing-library/react';

export { customWithin as within, customScreen as screen };

export function render(
  ui: React.ReactElement,
  options?: Omit<TestingLibrary.RenderOptions, 'wrapper'>,
) {
  return TestingLibrary.render(ui, { wrapper: ProvidersWrapper, ...options });
}

export { default as userEvent } from '@testing-library/user-event';
