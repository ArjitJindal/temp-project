import { describe, expect, test } from '@jest/globals';
import { render } from 'testing-library-wrapper';
import React from 'react';
import NestedSelects, { Props } from '..';
import {
  findSelect,
  expectSelectNumber,
  selectOption,
  clickClear,
  expectValues,
} from './nested-selects.jest-helpers';

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
