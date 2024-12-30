import React from 'react';
import s from './styles.module.less';
import SlaPopover from './SlaPopover';
import { SLAPolicyStatusDetails } from './SlaPolicyDetails';
import { SLAPolicyDetails } from '@/apis/models/SLAPolicyDetails';

interface Props {
  slaPolicyDetails?: Array<SLAPolicyDetails>;
}

function SlaStatus(props: Props) {
  const { slaPolicyDetails } = props;
  return (
    <div className={s.root}>
      {slaPolicyDetails?.map((slaPolicyDetail, index) => {
        if (slaPolicyDetail.policyStatus) {
          return (
            <SlaPopover
              slaPolicyDetail={slaPolicyDetail as SLAPolicyStatusDetails}
              index={index}
              key={slaPolicyDetail.slaPolicyId}
            />
          );
        }
      })}
    </div>
  );
}

export default SlaStatus;
