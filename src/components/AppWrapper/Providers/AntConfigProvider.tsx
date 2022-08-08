import { ConfigProvider } from 'antd';
import * as ProProvider from '@ant-design/pro-provider';
import React from 'react';
import enUS from 'antd/es/locale/en_US';

export const defaultValidateMessages = {
  default: "Validation error on field '${name}'",
  required: 'This field is required',
  enum: 'This field must be one of [${enum}]',
  whitespace: 'This field cannot be empty',
  date: {
    format: 'This field is invalid for format date',
    parse: 'This field could not be parsed as date',
    invalid: 'This field is invalid date',
  },
  types: {
    string: 'This field is not a valid ${type}',
    method: 'This field is not a valid ${type}',
    array: 'This field is not a valid ${type}',
    object: 'This field is not a valid ${type}',
    number: 'This field is not a valid ${type}',
    date: 'This field is not a valid ${type}',
    boolean: 'This field is not a valid ${type}',
    integer: 'This field is not a valid ${type}',
    float: 'This field is not a valid ${type}',
    regexp: 'This field is not a valid ${type}',
    email: 'This field is not a valid ${type}',
    url: 'This field is not a valid ${type}',
    hex: 'This field is not a valid ${type}',
  },
  string: {
    len: 'This field must be exactly ${len} characters',
    min: 'This field must be at least ${min} characters',
    max: 'This field cannot be longer than ${max} characters',
    range: 'This field must be between ${min} and ${max} characters',
  },
  number: {
    len: 'This field must equal ${len}',
    min: 'This field cannot be less than ${min}',
    max: 'This field cannot be greater than ${max}',
    range: 'This field must be between ${min} and ${max}',
  },
  array: {
    len: 'This field must be exactly ${len} in length',
    min: 'This field cannot be less than ${min} in length',
    max: 'This field cannot be greater than ${max} in length',
    range: 'This field must be between ${min} and ${max} in length',
  },
  pattern: {
    mismatch: 'This field does not match pattern ${pattern}',
  },
};

interface Props {
  children: React.ReactNode;
}

export default function AntConfigProvider(props: Props) {
  return (
    <ConfigProvider locale={enUS} form={{ validateMessages: defaultValidateMessages }}>
      <ProProvider.ConfigProvider
        value={{
          intl: ProProvider.enUSIntl,
          valueTypeMap: {},
        }}
      >
        <ProProvider.ConfigProviderWrap>{props.children}</ProProvider.ConfigProviderWrap>
      </ProProvider.ConfigProvider>
    </ConfigProvider>
  );
}
