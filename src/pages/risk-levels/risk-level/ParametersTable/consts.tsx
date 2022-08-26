import React from 'react';
import { Input, Select } from 'antd';
import { DataTypes, RiskLevelTable } from '@/pages/risk-levels/risk-level/ParametersTable/types';
import COUNTRIES from '@/utils/countries';

export type InputRenderer = (props: {
  disabled?: boolean;
  values: string[];
  onChange: (values: string[]) => void;
}) => React.ReactNode;

export type ValueRenderer = (props: { value: string | null }) => React.ReactNode;

// todo: i18n
export const PARAMETERS: RiskLevelTable = [
  {
    parameter: 'userDetails.countryOfResidence',
    title: 'Residence country',
    description: 'Risk based on customer residence country',
    type: 'ENUMERATION',
    dataType: 'COUNTRY',
  },
  {
    parameter: 'userDetails.countryOfOrigin',
    title: 'Origin country',
    description: 'Risk based on customer origin country',
    type: 'ENUMERATION',
    dataType: 'COUNTRY',
  },
];

export const INPUT_RENDERERS: { [key in DataTypes]: InputRenderer } = {
  STRING: ({ disabled, values, onChange }) => (
    <Input
      disabled={disabled}
      value={values[0] ?? ''}
      onChange={(e) => onChange([e.target.value])}
    />
  ),
  COUNTRY: ({ disabled, values, onChange }) => {
    return (
      <Select<string[]>
        mode="multiple"
        style={{ width: '100%' }}
        value={values}
        onChange={onChange}
        showSearch={true}
        disabled={disabled}
        filterOption={(input, option) => {
          const optionValue = option?.children?.toString() ?? '';
          return (
            optionValue.toLowerCase().indexOf(input.toLowerCase()) >= 0 ||
            optionValue.toLowerCase().indexOf(input.toLowerCase()) >= 0
          );
        }}
      >
        {Object.entries(COUNTRIES).map(([code, title]) => (
          <Select.Option value={code}>{title}</Select.Option>
        ))}
      </Select>
    );
  },
};

export const VALUE_RENDERERS: { [key in DataTypes]: ValueRenderer } = {
  STRING: ({ value }) => <span>{value}</span>,
  COUNTRY: ({ value }) => {
    if (value == null) {
      return null;
    }
    return <span>{COUNTRIES[value]}</span>;
  },
};
