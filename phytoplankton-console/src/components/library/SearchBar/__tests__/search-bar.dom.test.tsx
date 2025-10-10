import { test } from '@jest/globals';

import { render } from 'testing-library-wrapper';
import SearchBar, { SearchBarProps } from '..';
import {
  clickSearchBar,
  clickOutsideSearchBar,
  expectDropdownOpen,
} from './search-bar.jest-helpers';
import { success } from '@/utils/asyncResource';

interface FilterParams {}

describe('Open/closing dropdown', () => {
  test('Dropdown should open on click and close on click outside', async () => {
    const { container } = render(
      <RenderSearchBar
        items={success([])}
        isAIEnabled
        onClear={() => {}}
        setIsAIEnabled={() => {}}
      />,
    );
    expectDropdownOpen(false);
    await clickSearchBar();
    expectDropdownOpen(true);
    await clickOutsideSearchBar(container);
    expectDropdownOpen(false);
  });
});

/*
  Helpers
 */
function RenderSearchBar(props: SearchBarProps<FilterParams>) {
  return <SearchBar {...props} />;
}
