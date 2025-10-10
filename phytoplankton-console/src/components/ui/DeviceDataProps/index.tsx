import React from 'react';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import CountryDisplay from '../CountryDisplay';
import s from './index.module.less';
import { CountryCode, DeviceData } from '@/apis';
import * as Form from '@/components/ui/Form';

interface Props {
  deviceData: DeviceData | undefined;
}

export default function DeviceDataProps(props: Props) {
  const { deviceData } = props;

  const entries = deviceData
    ? Object.entries(deviceData).filter(([_, value]) => {
        if (value == null) {
          return false;
        }
        return true;
      })
    : [];

  return (
    <div className={s.root}>
      {entries.length === 0 && '-'}
      {deviceData
        ? entries.map(([key, value]) => (
            <Form.Layout.Label
              key={key}
              orientation="vertical"
              title={humanizeAuto(key)}
              className={s.property}
            >
              {renderValue(key, value)}
            </Form.Layout.Label>
          ))
        : '-'}
    </div>
  );
}

function renderValue(key: string, value: unknown): React.ReactNode {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (key === 'ipCountry') {
    return <CountryDisplay isoCode={value as CountryCode} />;
  }
  return stringifyValue(value);
}

function stringifyValue(value: unknown): string {
  if (isSimpleValue(value)) {
    return `${value}`;
  }
  if (Array.isArray(value)) {
    return value.map(stringifyValue).join(', ');
  }
  return JSON.stringify(value);
}

function isSimpleValue(value: unknown): value is string | number | boolean {
  const valueType = typeof value;
  return valueType === 'string' || valueType === 'number' || valueType === 'boolean';
}
