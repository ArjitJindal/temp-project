import { describe, expect, test } from '@jest/globals';
import { render, screen, userEvent, within } from 'testing-library-wrapper';
import React from 'react';
import NestedSelects, { Props } from '..';
import { notEmpty } from '@/utils/array';
import LabelStyles from '@/components/library/Label/style.module.less';

const options = [
  { value: 'o1', label: 'Option 1' },
  {
    value: 'o2',
    label: 'Option 2',
    children: [
      { value: 'o2-1', label: 'Option 2-1' },
      { value: 'o2-2', label: 'Option 2-2' },
    ],
  },
  {
    value: 'o3',
    label: 'Option 3',
    children: [
      { value: 'o3-1', label: 'Option 3-1' },
      {
        value: 'o3-2',
        label: 'Option 3-2',
        children: [
          { value: 'o3-2-1', label: 'Option 3-2-1' },
          { value: 'o3-2-2', label: 'Option 3-2-2' },
        ],
      },
    ],
  },
];

describe('NestedSelects Component', () => {
  test('renders elements correctly', async () => {
    render(<RenderComponent label="Root select" options={options} />);
    await expectSelectNumber(1);
    const select = await findSelect('Root select');
    await selectOption(select, 'Option 1');
  });
  test('nested select should appear/dissapear when select option in root select', async () => {
    render(<RenderComponent label="Root select" options={options} />);
    await expectSelectNumber(1);

    const select1 = await findSelect('Root select');
    await selectOption(select1, 'Option 2');
    await expectSelectNumber(2);

    const select2 = await findSelect('Option 2');
    await selectOption(select2, 'Option 2-1');
    await selectOption(select2, 'Option 2-2');

    await clickClear(select1);
    await expectSelectNumber(1);
  });
  test('3 levels', async () => {
    render(<RenderComponent label="Root select" options={options} />);
    await expectSelectNumber(1);

    const select1 = await findSelect('Root select');
    await selectOption(select1, 'Option 3');
    await expectSelectNumber(2);

    const select2 = await findSelect('Option 3');
    await selectOption(select2, 'Option 3-1');
    await expectSelectNumber(2);
    await selectOption(select2, 'Option 3-2');
    await expectSelectNumber(3);

    const select3 = await findSelect('Option 3-2');
    await selectOption(select3, 'Option 3-2-1');
    await selectOption(select3, 'Option 3-2-2');

    await selectOption(select2, 'Option 3-1');
    await expectSelectNumber(2);

    await clickClear(select1);
    await expectSelectNumber(1);
  });
  test('value should only be set at leafs', async () => {
    const handleChange = jest.fn();
    render(<RenderComponent label="Root select" options={options} onChange={handleChange} />);
    const select1 = await findSelect('Root select');

    // Select 'o1' value since it's a leaf option
    await selectOption(select1, 'Option 1');
    expect(handleChange).toBeCalledWith('o1');

    // Select 'undefined' value since "Option 2" is not a leaf option
    await selectOption(select1, 'Option 2');
    expect(handleChange).toBeCalledWith(undefined);

    // Switching between non-leaf options should do nothing to value
    await selectOption(select1, 'Option 3');
    await selectOption(select1, 'Option 2');
    await selectOption(select1, 'Option 3');

    // Switching back to "Option 1" should set value again
    await selectOption(select1, 'Option 1');
    expect(handleChange).toBeCalledWith('o1');

    expect(handleChange).toBeCalledTimes(3);
  });
  test('setting deep value should work fine too', async () => {
    const handleChange = jest.fn();
    render(<RenderComponent label="Root select" options={options} onChange={handleChange} />);

    const select1 = await findSelect('Root select');
    await selectOption(select1, 'Option 3');

    const select2 = await findSelect('Option 3');
    await selectOption(select2, 'Option 3-2');

    const select3 = await findSelect('Option 3-2');
    await selectOption(select3, 'Option 3-2-2');

    expect(handleChange).toBeCalledWith('o3-2-2');
    expect(handleChange).toBeCalledTimes(1);
  });
  test('proper init render with initial value', async () => {
    render(<RenderComponent label="Root select" options={options} initialValue="o3-2-2" />);

    await expectSelectNumber(3);

    const select1 = await findSelect('Root select');
    expectValues(select1, ['Option 3']);

    const select2 = await findSelect('Option 3');
    expectValues(select2, ['Option 3-2']);

    const select3 = await findSelect('Option 3-2');
    expectValues(select3, ['Option 3-2-2']);
  });
});

/*
  Helpers
 */
function RenderComponent(
  props: Props & {
    initialValue?: any;
  },
) {
  const [value, setValue] = React.useState<any>(props.initialValue);
  return (
    <NestedSelects
      {...props}
      value={value}
      onChange={(newValue) => {
        setValue(newValue);
        props.onChange?.(newValue);
      }}
    />
  );
}

async function selectOption(select, option: string) {
  await userEvent.click(within(select).getByClassName('ant-select-selector'));
  expectDropdownOpen(true);
  await clickOptionByText(option);
  expectDropdownOpen(false);
  expectValues(select, [option]);
}

async function expectSelectNumber(number) {
  const allLabelContainers = await screen.findAllByClassName(LabelStyles.root);
  return expect(allLabelContainers).toHaveLength(number);
}

async function findSelect(selectLabel: string) {
  const allLabelContainers = await screen.findAllByClassName(LabelStyles.root);
  const selects = allLabelContainers.filter((x) => {
    const labelEl = within(x).getByClassName(LabelStyles.label);
    const text = labelEl != null ? labelEl.textContent?.trim() : undefined;
    return text === selectLabel || text === `${selectLabel} *`;
  });
  expect(selects).toHaveLength(1);
  return selects[0];
}

async function clickOptionByText(text: string) {
  const dropdownEl = getOpenDropdown();
  const virtualList = within(dropdownEl).getByClassName('rc-virtual-list');
  const optionEl = within(virtualList).getByText(text);
  await userEvent.click(optionEl);
}

async function clickClear(select) {
  const clearButtonEl = within(select).getByClassName('ant-select-clear');
  expect(clearButtonEl).toBeInTheDocument();
  expect(clearButtonEl).toBeVisible();
  await userEvent.click(clearButtonEl);
}

function expectValues(select, values: string[]) {
  const selectorEl = within(select).getByClassName('ant-select-selector');
  const items = within(selectorEl).queryAllByClassName('ant-select-selection-item');
  const itemsText = items.map((item) => item.textContent).filter(notEmpty);
  expect(itemsText).toEqual(values);
}

function getOpenDropdown(): HTMLElement {
  const allDropdowns = screen.queryAllByClassName(`ant-select-dropdown`);
  const result = allDropdowns.find((x) => !x.classList.contains('ant-select-dropdown-hidden'));
  expect(result).not.toBeNull();
  if (result == null) {
    throw new Error(`Open dropdown not found`);
  }
  return result;
}

function expectDropdownOpen(shouldBeOpen: boolean = true) {
  const allDropdowns = screen.queryAllByClassName(`ant-select-dropdown`);
  const openDropdowns = allDropdowns.filter(
    (x) => !x.classList.contains('ant-select-dropdown-hidden'),
  );
  if (shouldBeOpen) {
    expect(openDropdowns).toHaveLength(1);
  } else {
    expect(openDropdowns).toHaveLength(0);
  }
}
