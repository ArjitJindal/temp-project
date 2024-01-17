import { test, expect } from '@jest/globals';

import React from 'react';
import { render, screen, userEvent } from 'testing-library-wrapper';
import SearchBar, { SearchBarProps } from '..';
import SearchBarStyles from '../index.module.less';
import SearchBarDropdownStyles from '../SearchBarDropdown/index.module.less';
import { success } from '@/utils/asyncResource';

interface FilterParams {}

describe('Open/closing dropdown', () => {
  test('Dropdown should open on click and close on click outside', async () => {
    const { container } = render(<RenderSearchBar items={success([])} />);
    expectDropdownOpen(false);
    await userEvent.click(screen.getByClassName(SearchBarStyles.root));
    expectDropdownOpen(true);
    await userEvent.click(container);
    expectDropdownOpen(false);
  });
});

/*
  Helpers
 */
function RenderSearchBar(props: SearchBarProps<FilterParams>) {
  return <SearchBar {...props} />;
}

/*
  Assertions
 */
function expectDropdownOpen(shouldBeOpen: boolean = true) {
  const dropdownEl = screen.queryByClassName(SearchBarDropdownStyles.root);
  if (shouldBeOpen) {
    expect(dropdownEl).toBeInTheDocument();
    expect(dropdownEl).toBeVisible();
  } else {
    expect(dropdownEl).not.toBeInTheDocument();
  }
}
