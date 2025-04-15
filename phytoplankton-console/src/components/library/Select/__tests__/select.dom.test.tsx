import { test, expect } from '@jest/globals';

import React from 'react';
import { render, screen, userEvent, within } from 'testing-library-wrapper';
import Select, { Props } from '..';
import { notEmpty } from '@/utils/array';
import { Comparable } from '@/utils/comparable';

describe('SINGLE mode', () => {
  test('Simple use case', async () => {
    render(
      <Select
        options={[
          { label: 'First option', value: 'option1' },
          { label: 'Second option', value: 'option2' },
        ]}
        placeholder={'Placeholder example'}
      />,
    );

    await clickSelector();
    expectDropdownOpen(true);
    await clickOptionByText('First option');
    expectDropdownOpen(false);
    expectValues(['First option']);

    await clickSelector();
    expectDropdownOpen(true);
    await clickOptionByText('Second option');
    expectDropdownOpen(false);
    expectValues(['Second option']);
  });
});

function RenderSelect<Value extends Comparable>(props: Props<Value>) {
  const [value, setValue] = React.useState<any>();
  return <Select {...props} value={value} onChange={setValue} />;
}

describe('MULTIPLE mode', () => {
  test('Simple use case', async () => {
    render(
      <RenderSelect
        mode="MULTIPLE"
        options={[
          { label: 'First option', value: 'option1' },
          { label: 'Second option', value: 'option2' },
          { label: 'Third option', value: 'option3' },
        ]}
        placeholder={'Placeholder example'}
      />,
    );

    await clickSelector();
    expectDropdownOpen(true);
    await clickOptionByText('First option');
    await clickOptionByText('Third option');
    await clickSelector();
    expectDropdownOpen(false);
    expectValues(['First option', 'Third option']);

    await clickSelector();
    expectDropdownOpen(true);
    await clickOptionByText('Third option');
    await clickOptionByText('Second option');
    await clickSelector();
    expectDropdownOpen(false);
    expectValues(['First option', 'Second option']);
  });
  test('Remove values', async () => {
    render(
      <RenderSelect
        mode="MULTIPLE"
        options={[
          { label: 'First option', value: 'option1' },
          { label: 'Second option', value: 'option2' },
          { label: 'Third option', value: 'option3' },
        ]}
        placeholder={'Placeholder example'}
      />,
    );

    await clickSelector();
    expectDropdownOpen(true);
    await clickOptionByText('First option');
    await clickOptionByText('Second option');
    await clickOptionByText('Third option');
    await clickSelector();
    expectDropdownOpen(false);
    expectValues(['First option', 'Second option', 'Third option']);
    await clickValueRemove('Third option');
    await clickValueRemove('Second option');
    await clickValueRemove('First option');
    expectValues([]);
  });
  test('Auto split by comma', async () => {
    render(
      <RenderSelect
        mode="MULTIPLE"
        options={[
          { label: 'First option', value: 'option1', alternativeLabels: ['aaa', '111'] },
          { label: 'Second option', value: 'option2', alternativeLabels: ['bbb'] },
          { label: 'Third option', value: 'option3', alternativeLabels: ['ccc'] },
        ]}
        placeholder={'Placeholder example'}
      />,
    );
    await clickSelector();
    expectDropdownOpen(true);

    // By option values
    await userEvent.keyboard('option1;option2; unknown option; option3;');
    expectValues(['First option', 'Second option', 'Third option']);
    await clickClear();
    expectValues([]);

    // By option labels
    await userEvent.keyboard('First option;Second option; unknown option; Third option;');
    expectValues(['First option', 'Second option', 'Third option']);
    await clickClear();
    expectValues([]);

    // By alternative labels
    await userEvent.keyboard('111;bbb; unknown option; ccc;');
    expectValues(['First option', 'Second option', 'Third option']);
    await clickClear();
    expectValues([]);
  });
});

describe('TAGS mode', () => {
  test('Simple use case', async () => {
    render(
      <Select
        mode="TAGS"
        options={[
          { label: 'First option', value: 'option1' },
          { label: 'Second option', value: 'option2' },
          { label: 'Third option', value: 'option3' },
        ]}
        placeholder={'Placeholder example'}
      />,
    );

    await clickSelector();
    expectDropdownOpen(true);
    await clickOptionByText('First option');
    await clickOptionByText('Third option');
    await clickSelector();
    expectDropdownOpen(false);
    expectValues(['First option', 'Third option']);

    await clickSelector();
    expectDropdownOpen(true);
    await clickOptionByText('Third option');
    await clickOptionByText('Second option');
    await clickSelector();
    expectDropdownOpen(false);
    expectValues(['First option', 'Second option']);
  });

  test('Remove values', async () => {
    render(
      <Select
        mode="TAGS"
        options={[
          { label: 'First option', value: 'option1' },
          { label: 'Second option', value: 'option2' },
          { label: 'Third option', value: 'option3' },
        ]}
        placeholder={'Placeholder example'}
      />,
    );

    await clickSelector();
    expectDropdownOpen(true);
    await clickOptionByText('First option');
    await clickOptionByText('Second option');
    await clickOptionByText('Third option');
    await clickSelector();
    expectDropdownOpen(false);
    expectValues(['First option', 'Second option', 'Third option']);
    await clickValueRemove('Third option');
    await clickValueRemove('Second option');
    await clickValueRemove('First option');
    expectValues([]);
  });

  test('Add non-existed value', async () => {
    render(
      <Select
        mode="TAGS"
        options={[
          { label: 'First option', value: 'option1' },
          { label: 'Second option', value: 'option2' },
          { label: 'Third option', value: 'option3' },
        ]}
        placeholder={'Placeholder example'}
      />,
    );

    await clickSelector();
    expectDropdownOpen(true);
    await userEvent.keyboard('New option');
    await clickOptionByText('New option');
    await clickSelector();
    expectDropdownOpen(false);
    expectValues(['New option']);
    await clickValueRemove('New option');
    expectValues([]);
  });

  test('Auto split by comma', async () => {
    render(
      <RenderSelect
        mode="TAGS"
        options={[
          { label: 'First option', value: 'option1', alternativeLabels: ['aaa', '111'] },
          { label: 'Second option', value: 'option2', alternativeLabels: ['bbb'] },
          { label: 'Third option', value: 'option3', alternativeLabels: ['ccc'] },
        ]}
        placeholder={'Placeholder example'}
      />,
    );
    await clickSelector();
    expectDropdownOpen(true);

    // By option values
    await userEvent.keyboard('option1;option2; unknown option; option3;');
    expectValues(['First option', 'Second option', 'unknown option', 'Third option']);
    await clickClear();
    expectValues([]);

    // By option labels
    await userEvent.keyboard('First option;Second option; unknown option; Third option;');
    expectValues(['First option', 'Second option', 'unknown option', 'Third option']);
    await clickClear();
    expectValues([]);

    // By alternative labels
    await userEvent.keyboard('111;bbb; unknown option; ccc;');
    expectValues(['First option', 'Second option', 'unknown option', 'Third option']);
    await clickClear();
    expectValues([]);
  });
});

async function clickOptionByText(text: string) {
  // const dropdownEl = screen.getByClassName('ant-select-dropdown');
  const dropdownEl = screen.getByClassName('ant-select-dropdown');
  const virtualList = within(dropdownEl).getByClassName('rc-virtual-list');
  const optionEl = within(virtualList).getByText(text);
  await userEvent.click(optionEl);
}
async function clickClear() {
  const clearButtonEl = screen.getByClassName('ant-select-clear');
  expect(clearButtonEl).toBeInTheDocument();
  expect(clearButtonEl).toBeVisible();
  await userEvent.click(clearButtonEl);
}
async function clickValueRemove(text: string) {
  const selectorEl = screen.getByClassName('ant-select-selector');
  const items = within(selectorEl).queryAllByClassName('ant-select-selection-item');
  const itemEl = items.find((item) => item.textContent === text);
  expect(itemEl).not.toBeNull();
  expect(itemEl).toBeInTheDocument();
  // const itemEl = within(selectorEl).getByText(text);
  if (itemEl != null) {
    const removeEl = within(itemEl).getByClassName('ant-select-selection-item-remove');
    await userEvent.click(removeEl);
  }
}

async function clickSelector() {
  await userEvent.click(screen.getByClassName('ant-select-selector'));
}

function expectDropdownOpen(shouldBeOpen: boolean = true) {
  const dropdownEl = screen.getByClassName('ant-select-dropdown');
  expect(dropdownEl).toBeInTheDocument();
  if (shouldBeOpen) {
    expect(dropdownEl).not.toHaveClass('ant-select-dropdown-hidden');
  } else {
    expect(dropdownEl).toHaveClass('ant-select-dropdown-hidden');
  }
}

function expectValues(values: string[]) {
  const selectorEl = screen.getByClassName('ant-select-selector');
  const items = within(selectorEl).queryAllByClassName('ant-select-selection-item');
  const itemsText = items.map((item) => item.textContent).filter(notEmpty);
  expect(itemsText).toEqual(values);
}
