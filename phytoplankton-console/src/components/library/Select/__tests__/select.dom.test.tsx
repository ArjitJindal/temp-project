import { test, expect } from '@jest/globals';

import React from 'react';
import { render, screen, userEvent, within } from 'testing-library-wrapper';
import Select, { Props } from '..';
import s from '../style.module.less';
import { notEmpty } from '@/utils/array';
import { Comparable } from '@/utils/comparable';

describe('SINGLE mode', () => {
  test('Simple use case', async () => {
    render(
      <RenderSelect
        options={[
          { label: 'First option', value: 'option1' },
          { label: 'Second option', value: 'option2' },
        ]}
        placeholder={'Placeholder example'}
      />,
    );

    expectValues([]);
    await clickSelector();
    expectDropdownOpen(true);
    await clickOptionByText('First option');
    expectDropdownOpen(false);
    expectValues(['First option']);
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
    await clickOutside();
    expectDropdownOpen(false);
    expectValues(['First option', 'Third option']);

    await clickSelector();
    expectDropdownOpen(true);
    await clickOptionByText('Third option');
    await clickOptionByText('Second option');
    await clickOutside();
    expectDropdownOpen(false);
    expectValues(['First option', 'Second option']);
  });
  test('Clear values', async () => {
    render(
      <RenderSelect
        mode="MULTIPLE"
        options={[
          { label: 'First option', value: 'option1' },
          { label: 'Second option', value: 'option2' },
          { label: 'Third option', value: 'option3' },
        ]}
        placeholder={'Placeholder example'}
        allowClear
      />,
    );

    await clickSelector();
    expectDropdownOpen(true);
    await clickOptionByText('First option');
    await clickOptionByText('Second option');
    await clickOptionByText('Third option');
    await clickOutside();
    expectDropdownOpen(false);
    expectValues(['First option', 'Second option', 'Third option']);
    await clickClear();
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
        allowClear
      />,
    );
    await clickSelector();
    expectDropdownOpen(true);

    // By option values
    await userEvent.keyboard('option1;option2; unknown option; option3;');
    expectValues(['First option', 'Second option', 'Third option']);
    await clickOutside();
    expectDropdownOpen(false);
    await clickClear();
    expectValues([]);

    // By option labels
    await clickSelector();
    expectDropdownOpen(true);
    await userEvent.keyboard('First option;Second option; unknown option; Third option;');
    expectValues(['First option', 'Second option', 'Third option']);
    await clickOutside();
    expectDropdownOpen(false);
    await clickClear();
    expectValues([]);

    // By alternative labels
    await clickSelector();
    expectDropdownOpen(true);
    await userEvent.keyboard('111;bbb; unknown option; ccc;');
    expectValues(['First option', 'Second option', 'Third option']);
    await clickOutside();
    expectDropdownOpen(false);
    await clickClear();
    expectValues([]);
  });
});

describe('TAGS mode', () => {
  test('Simple use case', async () => {
    render(
      <RenderSelect
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
    await clickOutside();
    expectDropdownOpen(false);
    expectTags(['First option', 'Third option']);

    await clickSelector();
    expectDropdownOpen(true);
    await clickOptionByText('Third option');
    await clickOptionByText('Second option');
    await clickOutside();
    expectDropdownOpen(false);
    expectTags(['First option', 'Second option']);
  });

  test('Remove values', async () => {
    render(
      <RenderSelect
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
    await clickOutside();
    expectDropdownOpen(false);
    expectTags(['First option', 'Second option', 'Third option']);
    await clickTagRemove('Third option');
    await clickTagRemove('Second option');
    await clickTagRemove('First option');
    expectTags([]);
  });

  test('Add non-existed value', async () => {
    render(
      <RenderSelect
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
    await clickOptionByText('Use "New option"');
    await clickOutside();
    expectDropdownOpen(false);
    expectTags(['New option']);
    await clickTagRemove('New option');
    expectTags([]);
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
        allowClear
      />,
    );
    // By option values
    await clickSelector();
    expectDropdownOpen(true);
    await userEvent.keyboard('option1;option2; unknown option; option3;');
    expectTags(['unknown option', 'First option', 'Second option', 'Third option']);
    await clickOutside();
    expectDropdownOpen(false);
    await clickClear();
    expectTags([]);

    // By option labels
    await clickSelector();
    expectDropdownOpen(true);
    await userEvent.keyboard('First option;Second option; unknown option; Third option;');
    expectTags(['unknown option', 'First option', 'Second option', 'Third option']);
    await clickOutside();
    expectDropdownOpen(false);
    await clickClear();
    expectTags([]);

    // // By alternative labels
    await clickSelector();
    expectDropdownOpen(true);
    await userEvent.keyboard('111;bbb; unknown option; ccc;');
    expectTags(['unknown option', 'First option', 'Second option', 'Third option']);
    await clickOutside();
    expectDropdownOpen(false);
    await clickClear();
    expectTags([]);
  });
});

describe('DYNAMIC mode', () => {
  test('Simple use case', async () => {
    render(
      <RenderSelect
        mode="DYNAMIC"
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

  test('Add new option', async () => {
    render(
      <RenderSelect
        mode="DYNAMIC"
        options={[
          { label: 'First option', value: 'option1' },
          { label: 'Second option', value: 'option2' },
        ]}
        placeholder={'Placeholder example'}
      />,
    );

    await clickSelector();
    expectDropdownOpen(true);
    await userEvent.keyboard('New dynamic option');
    await clickOptionByText('Use "New dynamic option"');
    expectDropdownOpen(false);
    expectValues(['New dynamic option']);

    // Verify the new option is added to the dropdown
    await clickSelector();
    expectDropdownOpen(true);
    await clickOptionByText('New dynamic option');
    expectDropdownOpen(false);
    expectValues(['New dynamic option']);
  });

  test('Add new option with whitespace', async () => {
    render(
      <RenderSelect
        mode="DYNAMIC"
        options={[
          { label: 'First option', value: 'option1' },
          { label: 'Second option', value: 'option2' },
        ]}
        placeholder={'Placeholder example'}
      />,
    );

    await clickSelector();
    expectDropdownOpen(true);
    await userEvent.keyboard('  New dynamic option with spaces  ');
    await clickOptionByText('Use "New dynamic option with spaces"');
    expectDropdownOpen(false);
    expectValues(['New dynamic option with spaces']);
  });

  test('Add duplicate option', async () => {
    render(
      <RenderSelect
        mode="DYNAMIC"
        options={[
          { label: 'First option', value: 'option1' },
          { label: 'Second option', value: 'option2' },
        ]}
        placeholder={'Placeholder example'}
      />,
    );

    await clickSelector();
    expectDropdownOpen(true);
    await userEvent.keyboard('First option');
    await clickOptionByText('First option');
    expectDropdownOpen(false);
    expectValues(['First option']);

    // Verify we can still select the original option
    await clickSelector();
    expectDropdownOpen(true);
    await clickOptionByText('First option');
    expectDropdownOpen(false);
    expectValues(['First option']);
  });
});

/*
  Helpers
 */
async function clickOptionByText(text: string) {
  const dropdownEl = screen.getByClassName(s.menuWrapper);
  const options = within(dropdownEl).getAllByText(text);
  if (options.length === 0) {
    throw new Error(`Option with text "${text}" not found`);
  }
  // If there are multiple options with the same text, select the first one
  const optionEl = options[0];
  await userEvent.click(optionEl);
}

async function clickClear() {
  const clearButtonEl = screen.getByClassName(s.clearIcon);
  expect(clearButtonEl).toBeInTheDocument();
  expect(clearButtonEl).toBeVisible();
  await userEvent.click(clearButtonEl);
}

async function clickTagRemove(text: string) {
  const tagEls = screen.getAllByClassName(s.tagWrapper);
  const tagEl = tagEls.find((item) => item.textContent === text);
  // const selectorEl = screen.getByClassName(s.tagWrapper);
  // const items = within(selectorEl).queryAllByClassName('ant-select-selection-item');
  // const itemEl = items.find((item) => item.textContent === text);
  if (tagEl == null) {
    throw new Error(`Tag with text "${text}" not found`);
  }
  // // const itemEl = within(selectorEl).getByText(text);
  const removeEl = within(tagEl).getByClassName(s.tagRemoveIcon);
  await userEvent.click(removeEl);
}

async function clickSelector() {
  await userEvent.click(screen.getByClassName(s.root));
}

async function clickOutside() {
  await userEvent.click(document.body);
}

function expectDropdownOpen(shouldBeOpen: boolean = true) {
  const dropdownEl = screen.getByClassName(s.menuWrapper);
  expect(dropdownEl).toBeInTheDocument();
  if (shouldBeOpen) {
    expect(dropdownEl).toHaveClass(s.isOpen);
  } else {
    expect(dropdownEl).not.toHaveClass(s.isOpen);
  }
}

function expectValues(values: string[]) {
  const selectorEl = screen.getByClassName(s.root);
  const items = within(selectorEl).queryAllByClassName(s.selectedOptionLabel);
  const itemsText = items.map((item) => item.textContent).filter(notEmpty);
  expect(itemsText).toEqual(values);
}

function expectTags(values: string[]) {
  const items = screen.queryAllByClassName(s.tagWrapper);
  const itemsText = items.map((item) => item.textContent).filter(notEmpty);
  expect(itemsText).toEqual(values);
}
