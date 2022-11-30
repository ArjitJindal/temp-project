import React, { useState } from 'react';
import { Popover } from 'antd';
import s from './style.module.less';
import PopupContent from './PopupContent';
import BriefcaseIcon from '@/components/ui/icons/Remix/business/briefcase-3-fill.react.svg';
import ActionButton from '@/components/ui/Table/ActionButton';

interface Props {
  businessIndustry: string[];
  onConfirm: (state: string[]) => void;
}

export default function BusinessIndustryButton(props: Props) {
  const { businessIndustry, onConfirm } = props;
  const [visible, setVisible] = useState(false);

  const buttonText =
    businessIndustry.length > 0 ? businessIndustry.join(', ') : 'Business Industry';
  return (
    <Popover
      overlayClassName={s.popover}
      overlayInnerStyle={{ padding: 0 }}
      content={<PopupContent value={businessIndustry} key={`${visible}`} onConfirm={onConfirm} />}
      trigger="click"
      placement="bottomLeft"
      visible={visible}
      onVisibleChange={setVisible}
    >
      <ActionButton
        color="ORANGE"
        icon={<BriefcaseIcon />}
        analyticsName="business-industry-filter"
        isActive={businessIndustry.length !== 0}
        onClear={() => {
          onConfirm([]);
        }}
        title={buttonText}
      >
        {buttonText}
      </ActionButton>
    </Popover>
  );
}
