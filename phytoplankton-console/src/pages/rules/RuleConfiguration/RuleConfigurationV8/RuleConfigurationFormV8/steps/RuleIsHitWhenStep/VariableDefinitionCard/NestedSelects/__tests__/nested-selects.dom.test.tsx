import { describe, expect, test } from '@jest/globals';
import { render, screen, userEvent, within } from 'testing-library-wrapper';
import React from 'react';
import NestedSelects, { Props } from '..';
import { notEmpty } from '@/utils/array';
import LabelStyles from '@/components/library/Label/style.module.less';
import SelectStyles from '@/components/library/Select/style.module.less';

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

    expect(handleChange).toHaveBeenNthCalledWith(1, 'o3-2-2');
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
  await userEvent.click(select);
  expectDropdownOpen(select, true);

  const dropdownEl = getDropdownBySelect(select);
  const options = within(dropdownEl).getAllByText(option);
  if (options.length === 0) {
    throw new Error(`Option with text "${option}" not found`);
  }
  // If there are multiple options with the same text, select the first one
  const optionEl = options[0];
  await userEvent.click(optionEl);

  expectDropdownOpen(select, false);
}

async function expectSelectNumber(number) {
  const allLabelContainers = await screen.findAllByClassName(LabelStyles.root);
  return expect(allLabelContainers).toHaveLength(number);
}

async function findSelect(selectLabel: string) {
  const allLabelContainers = await screen.findAllByClassName(LabelStyles.root);
  const matchingLabels = allLabelContainers.filter((x) => {
    const labelEl = within(x).getByClassName(LabelStyles.label);
    const text = labelEl != null ? labelEl.textContent?.trim() : undefined;
    return text === selectLabel || text === `${selectLabel} *`;
  });
  expect(matchingLabels).toHaveLength(1);
  const label = matchingLabels[0];
  const select = within(label).getByClassName(SelectStyles.root);
  return select;
}

async function clickClear(select) {
  const clearButtonEl = within(select).getByClassName(SelectStyles.clearIcon);
  expect(clearButtonEl).toBeInTheDocument();
  expect(clearButtonEl).toBeVisible();
  await userEvent.click(clearButtonEl);
}

function expectValues(select, values: string[]) {
  const items = within(select).queryAllByClassName(SelectStyles.selectedOptionLabel);
  const itemsText = items.map((item) => item.textContent).filter(notEmpty);
  expect(itemsText).toEqual(values);
}

function expectDropdownOpen(select: HTMLElement, shouldBeOpen: boolean = true) {
  const dropdownEl = getDropdownBySelect(select);
  expect(dropdownEl).toBeInTheDocument();
  if (shouldBeOpen) {
    expect(dropdownEl).toHaveClass(SelectStyles.isOpen);
  } else {
    expect(dropdownEl).not.toHaveClass(SelectStyles.isOpen);
  }
}

function getDropdownBySelect(select: HTMLElement) {
  const portalId = select.getAttribute('data-portal-id');
  if (!portalId) {
    throw new Error('Portal ID not found');
  }
  const portalEl = document.getElementById(portalId);
  if (!portalEl) {
    throw new Error('Portal element not found');
  }
  const dropdownEl = within(portalEl).getByClassName(SelectStyles.menuWrapper);
  return dropdownEl;
}
