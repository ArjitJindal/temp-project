import { Button as AntButton } from 'antd';
import React from 'react';
import { ButtonProps } from 'antd/lib/button/button';
import { useAnalytics } from '@/utils/segment/context';

interface ExtraProps {
  analyticsName?: string;
}

export default function Button(props: ButtonProps & ExtraProps) {
  const analytics = useAnalytics();
  const handleClick = function (this: unknown, ...args: any) {
    if (props.onClick) {
      props.onClick.apply(this, args);
    }
    if (props.analyticsName) {
      analytics.event({
        title: 'Button Clicked',
        name: props.analyticsName,
      });
    }
  };
  return <AntButton {...props} onClick={handleClick} />;
}
