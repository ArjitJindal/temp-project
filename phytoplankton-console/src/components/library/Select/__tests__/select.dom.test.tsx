import { test } from '@jest/globals';
import React from 'react';
import { render } from 'testing-library-wrapper';
import Select, { Props } from '..';
import {
  clickSelector,
  clickOptionByText,
  clickClear,
  clickValueRemove,
  expectDropdownOpen,
  expectValues,
  typeInSelect,
  clickOutside,
  expectTags,
} from './select.jest-helpers';
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
    await typeInSelect('option1;option2; unknown option; option3;');
    expectValues(['First option', 'Second option', 'Third option']);
    await clickOutside();
    expectDropdownOpen(false);
    await clickClear();
    expectValues([]);

    // By option labels
    await clickSelector();
    expectDropdownOpen(true);
    await typeInSelect('First option;Second option; unknown option; Third option;');
    expectValues(['First option', 'Second option', 'Third option']);
    await clickOutside();
    expectDropdownOpen(false);
    await clickClear();
    expectValues([]);

    // By alternative labels
    await clickSelector();
    expectDropdownOpen(true);
    await typeInSelect('111;bbb; unknown option; ccc;');
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
    await clickValueRemove('Third option');
    await clickValueRemove('Second option');
    await clickValueRemove('First option');
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
    await typeInSelect('New option');
    await clickOptionByText('Use "New option"');
    await clickOutside();
    expectDropdownOpen(false);
    expectTags(['New option']);
    await clickValueRemove('New option');
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
    await clickSelector();
    expectDropdownOpen(true);

    // By option values
    await typeInSelect('option1;option2; unknown option; option3;');
    expectTags(['unknown option', 'First option', 'Second option', 'Third option']);
    await clickOutside();
    expectDropdownOpen(false);
    await clickClear();
    expectTags([]);

    // By option labels
    await clickSelector();
    expectDropdownOpen(true);
    await typeInSelect('First option;Second option; unknown option; Third option;');
    expectTags(['unknown option', 'First option', 'Second option', 'Third option']);
    await clickOutside();
    expectDropdownOpen(false);
    await clickClear();
    expectTags([]);

    // By alternative labels
    await clickSelector();
    expectDropdownOpen(true);
    await typeInSelect('111;bbb; unknown option; ccc;');
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
    await typeInSelect('New dynamic option');
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
    await typeInSelect('  New dynamic option with spaces  ');
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
    await typeInSelect('First option');
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
