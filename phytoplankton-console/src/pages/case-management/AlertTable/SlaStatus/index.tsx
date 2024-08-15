import cn from 'clsx';
import React from 'react';
import { Popover } from 'antd';
import s from './styles.module.less';
import SlaPolicyDetails, { statusClass } from './SlaPolicyDetails';
import { SLAPolicyDetails } from '@/apis/models/SLAPolicyDetails';

interface Props {
  slaPolicyDetails?: Array<SLAPolicyDetails>;
}

function SlaStatus(props: Props) {
  const { slaPolicyDetails } = props;

  return (
    <div className={s.root}>
      {slaPolicyDetails?.map((slaPolicyDetail, index) => {
        return (
          <Popover
            title={`Policy ID: ${slaPolicyDetail.slaPolicyId}`}
            content={<SlaPolicyDetails slaPolicyDetail={slaPolicyDetail} />}
            trigger="click"
          >
            <div
              key={index}
              className={cn(s.statusDisplay, s[statusClass[slaPolicyDetail.policyStatus]])}
            />
          </Popover>
        );
      })}
    </div>
  );
}

export default SlaStatus;
