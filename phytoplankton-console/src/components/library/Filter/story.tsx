import React from 'react';
import Filter from '.';
import { UseCase } from '@/pages/storybook/components';
import {
  AutoFilterProps,
  AutoFilterDataType,
  ExtraFilterProps,
} from '@/components/library/Filter/types';
import { neverReturn } from '@/utils/lang';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';

function getAutoFilter(dataTypeKind: AutoFilterDataType['kind']): AutoFilterProps {
  let dataType: AutoFilterDataType;
  if (dataTypeKind === 'string') {
    dataType = { kind: 'string' };
  } else if (dataTypeKind === 'number') {
    dataType = { kind: 'number' };
  } else if (dataTypeKind === 'select') {
    dataType = {
      kind: 'select',
      mode: 'SINGLE',
      displayMode: 'select',
      options: [
        { label: 'First option', value: 'v1' },
        { label: 'Second option', value: 'v2' },
        { label: 'Third option', value: 'v3' },
      ],
    };
  } else if (dataTypeKind === 'dateRange') {
    dataType = { kind: 'dateRange' };
  } else if (dataTypeKind === 'dateTimeRange') {
    dataType = { kind: 'dateTimeRange' };
  } else if (dataTypeKind === 'year') {
    dataType = { kind: 'year' };
  } else if (dataTypeKind === 'slider') {
    dataType = { kind: 'slider' };
  } else {
    dataType = neverReturn(dataTypeKind, { kind: 'string' });
  }
  return {
    key: 'sample_' + dataTypeKind,
    title: `Sample ${dataTypeKind} filter`,
    kind: 'AUTO',
    dataType: dataType,
  };
}

export default function (): JSX.Element {
  return (
    <>
      <UseCase title="Auto filter">
        {([state, setState]) => (
          <PropertyMatrix<void, AutoFilterDataType['kind']>
            y={['string', 'number', 'select', 'dateRange', 'dateTimeRange']}
            yLabel={'kind'}
          >
            {(_, kind) => (
              <Filter
                key={kind}
                filter={getAutoFilter(kind)}
                params={state.params ?? {}}
                onChangeParams={(newParams) => {
                  setState({ params: { ...state.params, ...newParams } });
                }}
              />
            )}
          </PropertyMatrix>
        )}
      </UseCase>
      <UseCase title="Auto filter: select modes">
        {([state, setState]) => (
          <PropertyMatrix
            x={['select', 'list']}
            xLabel={'displayMode'}
            y={['SINGLE', 'MULTIPLE', 'TAGS']}
            yLabel={'mode'}
          >
            {(displayMode: 'select' | 'list', mode: 'SINGLE' | 'MULTIPLE' | 'TAGS') => (
              <Filter
                key={`${displayMode}_${mode}`}
                filter={{
                  key: 'sample_select',
                  title: `Sample select filter`,
                  kind: 'AUTO',
                  dataType: {
                    kind: 'select',
                    mode: mode,
                    displayMode: displayMode,
                    options: [
                      { label: 'First option', value: 'v1' },
                      { label: 'Second option', value: 'v2' },
                      { label: 'Third option', value: 'v3' },
                    ],
                  },
                }}
                params={state[mode] ?? {}}
                onChangeParams={(newParams) => {
                  setState({ ...state, [mode]: { ...state[mode], ...newParams } });
                }}
              />
            )}
          </PropertyMatrix>
        )}
      </UseCase>
      <UseCase title={'Extra filter'}>
        {([state, setState]) => {
          const filter: ExtraFilterProps<{ num: number }> = {
            key: 'sample_select',
            title: `Sample select filter`,
            kind: 'EXTRA',
            renderer: ({ params, setParams }) => (
              <button
                onClick={() => {
                  setParams((oldState) => ({
                    ...oldState,
                    num: (params.num ?? 0) + 1,
                  }));
                }}
              >
                Change params ({params.num ?? 0})
              </button>
            ),
          };
          return (
            <Filter
              filter={filter}
              params={state.params ?? {}}
              onChangeParams={(newParams) => {
                setState({ ...state, params: { ...state.params, ...newParams } });
              }}
            />
          );
        }}
      </UseCase>
    </>
  );
}
