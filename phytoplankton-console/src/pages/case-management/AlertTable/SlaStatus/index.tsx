import React, { forwardRef, useImperativeHandle, useState } from 'react';
import s from './styles.module.less';
import SlaPopover from './SlaPopover';
import { SLAPolicyStatusDetails } from './SlaPolicyDetails';
import { SLAPolicyDetails } from '@/apis/models/SLAPolicyDetails';

export interface PopoverRef {
  setPopOverVisible: (visible: boolean) => void;
}
interface Props {
  slaPolicyDetails?: Array<SLAPolicyDetails>;
}

function SlaStatus(props: Props, ref?: React.Ref<PopoverRef>) {
  const { slaPolicyDetails } = props;
  const [popOverVisible, setPopOverVisible] = useState(false);
  useImperativeHandle(ref, () => ({
    setPopOverVisible,
  }));
  return (
    <div className={s.root}>
      {slaPolicyDetails?.map((slaPolicyDetail, index) => {
        if (slaPolicyDetail.policyStatus) {
          return (
            <SlaPopover
              setPopOverVisible={setPopOverVisible}
              slaPolicyDetail={slaPolicyDetail as SLAPolicyStatusDetails}
              index={index}
              popOverVisible={popOverVisible}
            />
          );
        }
      })}
    </div>
  );
}

export default forwardRef<PopoverRef, Props>(SlaStatus);
