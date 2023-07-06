import * as TestingLibrary from '@testing-library/react';
import { StorybookMockProviders } from '../src/components/AppWrapper/Providers';

function ProvidersWrapper({ children }: { children: React.ReactNode }) {
  return <StorybookMockProviders>{children}</StorybookMockProviders>;
}

TestingLibrary.configure({
  testIdAttribute: 'data-cy',
});

export * from '@testing-library/react';

export function render(
  ui: React.ReactElement,
  options?: Omit<TestingLibrary.RenderOptions, 'wrapper'>,
) {
  return TestingLibrary.render(ui, { wrapper: ProvidersWrapper, ...options });
}

export { default as userEvent } from '@testing-library/user-event';
