import cn from 'clsx';
import { Col, Row } from 'antd';
import React from 'react';
import s from './index.module.less';
import ExclamationCircleIcon from './exclamation-circle.react.svg';
import AlertFillIcon from '@/components/ui/icons/Remix/system/alert-fill.react.svg';
import InformationFillIcon from '@/components/ui/icons/Remix/system/information-fill.react.svg';
import CheckboxCircleFillIcon from '@/components/ui/icons/Remix/system/checkbox-circle-fill.react.svg';

interface Props {
  type: 'error' | 'warning' | 'info' | 'success';
  size?: 's' | 'm' | 'l';
  children: React.ReactNode;
}

export default function Alert(props: Props) {
  const { type, children, size } = props;
  return (
    <div
      className={cn(s.root, s[`type-${type}`], s[`size-${size ?? 's'}`])}
      data-cy={`alert-${type}`}
    >
      <Row style={{ flexFlow: 'row', alignItems: 'flex-start' }}>
        <Col style={{ paddingTop: 2 }}>
          {type === 'error' && <AlertFillIcon className={s.icon} data-cy={`icon-${type}`} />}
          {type === 'warning' && (
            <ExclamationCircleIcon className={s.icon} data-cy={`icon-${type}`} />
          )}
          {type === 'info' && <InformationFillIcon className={s.icon} data-cy={`icon-${type}`} />}
          {type === 'success' && (
            <CheckboxCircleFillIcon className={s.icon} data-cy={`icon-${type}`} />
          )}
        </Col>
        <Col style={{ paddingLeft: 8 }}>{children}</Col>
      </Row>
    </div>
  );
}
