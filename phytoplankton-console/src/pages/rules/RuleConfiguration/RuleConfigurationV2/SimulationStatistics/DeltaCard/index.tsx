import React from 'react';
import { Col, Row } from 'antd';
import cn from 'clsx';
import { isFinite } from 'lodash';
import s from './index.module.less';
import { H1 } from '@/components/ui/Typography';
import ArrowUpIcon from '@/components/ui/icons/Remix/system/arrow-up-line.react.svg';
import ArrowDownIcon from '@/components/ui/icons/Remix/system/arrow-down-line.react.svg';
import Tag from '@/components/library/Tag';

interface Props {
  icon: React.ReactNode;
  title: string;
  beforeValue?: number;
  afterValue?: number;
}

export function DeltaCard(props: Props) {
  const { title, icon, beforeValue, afterValue } = props;
  const hasMissingValue = beforeValue == null || afterValue == null;
  const delta = hasMissingValue ? undefined : afterValue - beforeValue;
  const deltaRatio = hasMissingValue ? undefined : (afterValue - beforeValue) / beforeValue;
  return (
    <div className={cn(s.root)}>
      <div className={s.title}>
        <div className={s.icon}>{icon}</div>
        {title}
      </div>
      {delta && deltaRatio ? (
        <Row justify="center" align="middle" gutter={20}>
          <Col>
            <H1 variant="displayLg">{Math.abs(delta).toLocaleString()}</H1>
          </Col>
          <Col>
            {isFinite(deltaRatio) && (
              <Tag
                color={delta > 0 ? 'red' : 'green'}
                icon={delta > 0 ? <ArrowUpIcon /> : <ArrowDownIcon />}
              >{`${Math.abs(deltaRatio * 100).toFixed(2)} %`}</Tag>
            )}
          </Col>
        </Row>
      ) : (
        '-'
      )}
    </div>
  );
}
