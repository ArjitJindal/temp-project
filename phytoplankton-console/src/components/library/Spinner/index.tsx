import { Spin } from 'antd';
import React from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import { SpinSize } from 'antd/lib/spin';

const SIZES = {
  SMALL: undefined,
  DEFAULT: 30,
  LARGE: 42,
};

interface Props {
  size?: 'SMALL' | 'DEFAULT' | 'LARGE';
  children?: React.ReactNode;
}

export default function Spinner(props: Props) {
  const { size = 'DEFAULT', children } = props;
  return (
    <Spin
      size={size.toLowerCase() as SpinSize}
      indicator={<LoadingOutlined spin style={{ fontSize: SIZES[size] }} />}
    >
      {children}
    </Spin>
  );
}
