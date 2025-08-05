import ReactCountryFlag from 'react-country-flag';
import SelectMenu from './SelectMenu';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import AlarmFillIcon from '@/components/ui/icons/Remix/system/alarm-fill.react.svg';
import Label from '@/components/library/Label';
import Toggle from '@/components/library/Toggle';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';
import SearchIcon from '@/components/ui/icons/Remix/system/search-line.react.svg';

export default function (): JSX.Element {
  return (
    <>
      <UseCase
        title={'Menu: basic case'}
        initialBgColor={'#F5F5F5'}
        initialState={{ showCheckboxes: false, selectedValues: ['v1', 'v4'] }}
      >
        {([state, setState]) => (
          <>
            <Label label="Show checkboxes">
              <Toggle
                value={state.showCheckboxes}
                onChange={(value) => {
                  setState((prevState) => ({ ...prevState, showCheckboxes: value }));
                }}
              />
            </Label>
            <SelectMenu
              showCheckboxes={state.showCheckboxes}
              selectedValues={state.selectedValues}
              onSelectOption={(value) => {
                setState((prevState) => ({
                  ...prevState,
                  selectedValues: prevState.selectedValues.includes(value)
                    ? prevState.selectedValues.filter((v) => v !== value)
                    : [...prevState.selectedValues, value],
                }));
              }}
              options={[
                { value: 'v1', label: 'Option 1', icon: <AlarmFillIcon /> },
                { value: 'v2', label: 'Option 2' },
                { value: 'v3', label: 'Option 3 (disabled)', isDisabled: true },
                { value: 'v4', label: 'Option 4' },
                {
                  value: 'v5',
                  label: 'Option 5',
                  icon: <ReactCountryFlag width={'100%'} countryCode="DE" svg />,
                },
                {
                  value: 'v6',
                  label: 'Option 6',
                  icon: <ReactCountryFlag width={'100%'} countryCode="FR" svg />,
                },
                {
                  value: 'v7',
                  label: 'Option 7',
                  icon: <ReactCountryFlag width={'100%'} countryCode="US" svg />,
                },
                {
                  value: 'v8',
                  label:
                    'Option 8, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very long title',
                  icon: <ReactCountryFlag width={'100%'} countryCode="US" svg />,
                },
              ]}
            />
          </>
        )}
      </UseCase>
      <UseCase
        title={'Menu: groups'}
        initialBgColor={'#F5F5F5'}
        initialState={{ showCheckboxes: false, selectedValues: ['v1', 'v4'] }}
      >
        {([state, setState]) => (
          <>
            <Label label="Show checkboxes">
              <Toggle
                value={state.showCheckboxes}
                onChange={(value) => {
                  setState((prevState) => ({ ...prevState, showCheckboxes: value }));
                }}
              />
            </Label>
            <SelectMenu
              showCheckboxes={state.showCheckboxes}
              selectedValues={state.selectedValues}
              onSelectOption={(value) => {
                setState((prevState) => ({
                  ...prevState,
                  selectedValues: prevState.selectedValues.includes(value)
                    ? prevState.selectedValues.filter((v) => v !== value)
                    : [...prevState.selectedValues, value],
                }));
              }}
              options={[
                {
                  kind: 'GROUP',
                  label: 'Group A',
                  options: [
                    { value: 'v11', label: 'Item A.1' },
                    { value: 'v12', label: 'Item A.2' },
                    { value: 'v13', label: 'Item A.3 (disabled)', isDisabled: true },
                  ],
                },
                {
                  kind: 'GROUP',
                  label: 'Group B',
                  options: [
                    { value: 'v21', label: 'Item B.1' },
                    { value: 'v22', label: 'Item B.2' },
                    { value: 'v23', label: 'Item B.3' },
                  ],
                },
              ]}
            />
          </>
        )}
      </UseCase>
      <UseCase title={'Modes'} initialState={{}}>
        {([state, setState]) => (
          <>
            <PropertyMatrix
              xLabel="size"
              yLabel="mode"
              x={['DEFAULT', 'LARGE'] as const}
              y={['SINGLE', 'MULTIPLE', 'TAGS', 'DYNAMIC'] as const}
            >
              {(size, mode) => (
                <Component
                  allowClear={state.allowClear}
                  placeholder={`${mode} select, ${size} size`}
                  options={[
                    { value: 'option1', label: 'Option #1' },
                    {
                      value: 'option2',
                      label:
                        'Option #2 with a very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very long title',
                    },
                    { value: 'option3', label: 'Option #3' },
                    { value: 'option4', label: 'Option #4' },
                    { value: 'option5', label: 'Option #5' },
                    { value: 'option6', label: 'Option #6' },
                    { value: 'option7', label: 'Option #7' },
                    { value: 'option8', label: 'Option #8' },
                    { value: 'option9', label: 'Option #9' },
                    { value: 'option10', label: 'Option #10, also a very long title' },
                    { value: 'option11', label: 'Option #11' },
                    { value: 'option12', label: 'Option #12' },
                    { value: 'option13', label: 'Option #13' },
                    { value: 'option14', label: 'Option #14' },
                    { value: 'option15', label: 'Option #15' },
                    { value: 'option16', label: 'Option #16' },
                  ]}
                  value={mode === 'SINGLE' || mode === 'DYNAMIC' ? state.value1 : state.value2}
                  onChange={(newValue) => {
                    setState((prevState) => ({
                      ...prevState,
                      [mode === 'SINGLE' || mode === 'DYNAMIC' ? 'value1' : 'value2']: newValue,
                    }));
                  }}
                  mode={mode}
                  size={size}
                />
              )}
            </PropertyMatrix>
          </>
        )}
      </UseCase>
      <UseCase title={'Empty options list'} initialState={{}}>
        {() => (
          <>
            <Component placeholder={'Placeholder example'} options={[]} />
            <Component
              placeholder={'Placeholder example'}
              options={[]}
              notFoundContent={<div>Custom not found content</div>}
            />
          </>
        )}
      </UseCase>
      <UseCase
        title={'Unknown values'}
        initialState={{
          value1: 'unknown',
          value2: ['unknown1', 'unknown2'],
        }}
      >
        {([state, setState]) => (
          <PropertyMatrix yLabel="mode" y={['SINGLE', 'MULTIPLE', 'TAGS', 'DYNAMIC'] as const}>
            {(_, mode) => (
              <Component<string>
                mode={mode}
                placeholder={'Placeholder example'}
                options={[
                  { value: 'option1', label: 'First option' },
                  { value: 'option2', label: 'Second option' },
                ]}
                value={mode === 'SINGLE' || mode === 'DYNAMIC' ? state.value1 : state.value2}
                onChange={(newValue) => {
                  setState((prevState) => ({
                    ...prevState,
                    [mode === 'SINGLE' || mode === 'DYNAMIC' ? 'value1' : 'value2']: newValue,
                  }));
                }}
              />
            )}
          </PropertyMatrix>
        )}
      </UseCase>
      <UseCase
        title={'Disabled'}
        initialState={{ value: 'option1', values: ['option1', 'option2'] }}
      >
        {([state, setState]) => (
          <PropertyMatrix
            xLabel="isEmpty"
            yLabel="mode"
            x={[true, false] as const}
            y={['SINGLE', 'MULTIPLE', 'TAGS', 'DYNAMIC'] as const}
          >
            {(isEmpty, mode) => (
              <Component
                mode={mode}
                isDisabled={true}
                placeholder={'Placeholder example'}
                value={
                  isEmpty
                    ? undefined
                    : mode === 'SINGLE' || mode === 'DYNAMIC'
                    ? state.value
                    : state.values
                }
                options={[
                  { value: 'option1', label: 'First option' },
                  { value: 'option2', label: 'Second option' },
                ]}
                onChange={(newValue) => {
                  setState((prevState) => ({
                    ...prevState,
                    [mode === 'SINGLE' || mode === 'DYNAMIC' ? 'value' : 'values']: newValue,
                  }));
                }}
              />
            )}
          </PropertyMatrix>
        )}
      </UseCase>
      <UseCase title={'Error'} initialState={{}}>
        {([state, setState]) => (
          <PropertyMatrix yLabel="mode" y={['SINGLE', 'MULTIPLE', 'TAGS', 'DYNAMIC'] as const}>
            {(isEmpty, mode) => (
              <Component
                mode={mode}
                isError={true}
                placeholder={'Placeholder example'}
                value={mode === 'SINGLE' || mode === 'DYNAMIC' ? state.value : state.values}
                options={[
                  { value: 'option1', label: 'First option' },
                  { value: 'option2', label: 'Second option' },
                  { value: 'option3', label: 'Third option' },
                  { value: 'option4', label: 'Fourth option' },
                  { value: 'option5', label: 'Fifth option' },
                  { value: 'option6', label: 'Sixth option' },
                  { value: 'option7', label: 'Seventh option' },
                  { value: 'option8', label: 'Eighth option' },
                  { value: 'option9', label: 'Ninth option' },
                ]}
                onChange={(newValue) => {
                  setState((prevState) => ({
                    ...prevState,
                    [mode === 'SINGLE' || mode === 'DYNAMIC' ? 'value' : 'values']: newValue,
                  }));
                }}
              />
            )}
          </PropertyMatrix>
        )}
      </UseCase>
      <UseCase title={'Copyable'}>
        {([state, setState]) => (
          <>
            <Component
              isCopyable={true}
              placeholder={'Single select'}
              options={[
                { value: 'option1', label: 'First option' },
                { value: 'option2', label: 'Second option' },
              ]}
              value={state.value1}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, value1: newValue }));
              }}
            />
            <Component
              isCopyable={true}
              mode="MULTIPLE"
              placeholder={'Multiple select'}
              options={[
                { value: 'option1', label: 'Option #1' },
                { value: 'option2', label: 'Option #2 with a very, very, very long title' },
                { value: 'option3', label: 'Option #3' },
                { value: 'option4', label: 'Option #4' },
                { value: 'option5', label: 'Option #5' },
                { value: 'option6', label: 'Option #6' },
                { value: 'option7', label: 'Option #7' },
                { value: 'option8', label: 'Option #8' },
                { value: 'option9', label: 'Option #9' },
              ]}
              value={state.value2}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, value2: newValue }));
              }}
            />
            <Component
              isCopyable={true}
              mode="TAGS"
              placeholder={'Tags select'}
              options={[
                { value: 'option1', label: 'Option #1' },
                { value: 'option2', label: 'Option #2 with a very, very, very long title' },
                { value: 'option3', label: 'Option #3' },
                { value: 'option4', label: 'Option #4' },
                { value: 'option5', label: 'Option #5' },
                { value: 'option6', label: 'Option #6' },
                { value: 'option7', label: 'Option #7' },
                { value: 'option8', label: 'Option #8' },
                { value: 'option9', label: 'Option #9' },
              ]}
              value={state.value3}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, value3: newValue }));
              }}
            />
          </>
        )}
      </UseCase>
      <UseCase title={'Fixed width'}>
        {([state, setState]) => (
          <PropertyMatrix
            xLabel={'width'}
            x={[200, '100px', '50%']}
            yLabel="mode"
            y={['SINGLE', 'MULTIPLE', 'TAGS', 'DYNAMIC'] as const}
          >
            {(width, mode) => (
              <Component
                width={width}
                mode={mode}
                placeholder={'Placeholder example'}
                value={mode === 'SINGLE' || mode === 'DYNAMIC' ? state.value : state.values}
                options={[
                  { value: 'option1', label: 'First option' },
                  { value: 'option2', label: 'Second option' },
                  {
                    value: 'option3',
                    label:
                      'Third option, very, very, very, very, very, very, very, very, very long text here',
                  },
                ]}
                onChange={(newValue) => {
                  setState((prevState) => ({
                    ...prevState,
                    [mode === 'SINGLE' || mode === 'DYNAMIC' ? 'value' : 'values']: newValue,
                  }));
                }}
              />
            )}
          </PropertyMatrix>
        )}
      </UseCase>
      <UseCase title={'Experiments'} initialState={{}}>
        {([state, setState]) => (
          <>
            <div
              style={{
                display: 'grid',
                gap: 16,
                justifyContent: 'flex-start',
                gridAutoFlow: 'column',
              }}
            >
              <Label label="Allow clear">
                <Toggle
                  value={state.allowClear}
                  onChange={(value) => {
                    setState((prevState) => ({ ...prevState, allowClear: value }));
                  }}
                />
              </Label>
              <Label label="Is error">
                <Toggle
                  value={state.isError}
                  onChange={(value) => {
                    setState((prevState) => ({ ...prevState, isError: value }));
                  }}
                />
              </Label>
              <Label label="Is disabled">
                <Toggle
                  value={state.isDisabled}
                  onChange={(value) => {
                    setState((prevState) => ({ ...prevState, isDisabled: value }));
                  }}
                />
              </Label>
              <Label label="Is loading">
                <Toggle
                  value={state.isLoading}
                  onChange={(value) => {
                    setState((prevState) => ({ ...prevState, isLoading: value }));
                  }}
                />
              </Label>
              <Label label="Is copyable">
                <Toggle
                  value={state.isCopyable}
                  onChange={(value) => {
                    setState((prevState) => ({ ...prevState, isCopyable: value }));
                  }}
                />
              </Label>
              <Label label="Hide borders">
                <Toggle
                  value={state.hideBorders}
                  onChange={(value) => {
                    setState((prevState) => ({ ...prevState, hideBorders: value }));
                  }}
                />
              </Label>
              <Label label="Fixed height">
                <Toggle
                  value={state.fixedHeight}
                  onChange={(value) => {
                    setState((prevState) => ({ ...prevState, fixedHeight: value }));
                  }}
                />
              </Label>
            </div>
            <div
              style={{
                display: 'grid',
                gap: 16,
                justifyContent: 'flex-start',
                gridAutoFlow: 'column',
              }}
            >
              <Label label="Long options">
                <Toggle
                  value={state.longOptions}
                  onChange={(value) => {
                    setState((prevState) => ({ ...prevState, longOptions: value }));
                  }}
                />
              </Label>
              <Label label="Add icon">
                <Toggle
                  value={state.addIcon}
                  onChange={(value) => {
                    setState((prevState) => ({ ...prevState, addIcon: value }));
                  }}
                />
              </Label>
              <Label label="Add custom DOM option">
                <Toggle
                  value={state.customOption}
                  onChange={(value) => {
                    setState((prevState) => ({ ...prevState, customOption: value }));
                  }}
                />
              </Label>
              <Label label="Placeholder icon">
                <Toggle
                  value={state.addPlaceholderIcon}
                  onChange={(value) => {
                    setState((prevState) => ({ ...prevState, addPlaceholderIcon: value }));
                  }}
                />
              </Label>
            </div>
            <PropertyMatrix
              xLabel="size"
              yLabel="mode"
              x={['DEFAULT', 'LARGE'] as const}
              y={['SINGLE', 'MULTIPLE', 'TAGS', 'DYNAMIC'] as const}
            >
              {(size, mode) => (
                <Component
                  allowClear={state.allowClear}
                  isError={state.isError}
                  isDisabled={state.isDisabled}
                  isLoading={state.isLoading}
                  isCopyable={state.isCopyable}
                  fixedHeight={state.fixedHeight}
                  hideBorders={state.hideBorders}
                  placeholder={`${mode} select, ${size} size`}
                  placeholderIcon={state.addPlaceholderIcon ? <SearchIcon /> : undefined}
                  options={[
                    { value: 'option1', label: 'Option #1' },
                    {
                      value: 'option2',
                      label: state.longOptions
                        ? `Option #2 with a very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very, very long title`
                        : 'Option #2',
                    },
                    { value: 'option3', label: 'Option #3' },
                    { value: 'option4', label: 'Option #4' },
                    { value: 'option5', label: 'Option #5' },
                    { value: 'option6', label: 'Option #6' },
                    { value: 'option7', label: 'Option #7' },
                    { value: 'option8', label: 'Option #8' },
                    { value: 'option9', label: 'Option #9' },
                    {
                      value: 'option10',
                      label: state.longOptions
                        ? `Option #10, also a very long title`
                        : 'Option #10',
                    },
                    { value: 'option11', label: 'Option #11' },
                    { value: 'option12', label: 'Option #12' },
                    { value: 'option13', label: 'Option #13' },
                    { value: 'option14', label: 'Option #14' },
                    { value: 'option15', label: 'Option #15' },
                    { value: 'option16', label: 'Option #16' },
                    ...(state.customOption
                      ? [
                          {
                            value: 'option17',
                            label: (
                              <div
                                style={{
                                  border: '1px dashed red',
                                  background: '#ff000024',
                                  display: 'flex',
                                  gap: '4px',
                                  alignItems: 'center',
                                }}
                              >
                                <div
                                  style={{
                                    background: 'red',
                                    borderRadius: '50%',
                                    width: '8px',
                                    height: '8px',
                                  }}
                                />
                                <span>Custom option layout</span>
                              </div>
                            ),
                          },
                        ]
                      : []),
                  ].map((option) => ({
                    ...option,
                    icon: state.addIcon ? <AlarmFillIcon /> : undefined,
                  }))}
                  value={mode === 'SINGLE' || mode === 'DYNAMIC' ? state.value1 : state.value2}
                  onChange={(newValue) => {
                    setState((prevState) => ({
                      ...prevState,
                      [mode === 'SINGLE' || mode === 'DYNAMIC' ? 'value1' : 'value2']: newValue,
                    }));
                  }}
                  mode={mode}
                  size={size}
                />
              )}
            </PropertyMatrix>
            <div
              style={{
                height: '500px',
                border: '1px dashed rgb(213 206 162)',
                background: 'rgb(255 245 0 / 12%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgb(213 206 162)',
                fontSize: '1.5em',
              }}
            >
              Placeholder to test page scrolling when opening a select
            </div>
          </>
        )}
      </UseCase>
    </>
  );
}
