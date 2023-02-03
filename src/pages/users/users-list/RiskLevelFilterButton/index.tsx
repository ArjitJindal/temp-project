import React, { useState } from 'react';
import { Popover } from 'antd';
import s from './style.module.less';
import PopupContent from './PopupContent';
import AlarmWarningFillIcon from '@/components/ui/icons/Remix/system/alarm-warning-fill.react.svg';
import ActionButton from '@/components/ui/Table/ActionButton';
import { RiskLevel } from '@/apis';
import { useTableScrollVisible } from '@/utils/hooks';

interface Props {
  riskLevels: RiskLevel[];
  onConfirm: (risk: RiskLevel[]) => void;
}

export function RiskLevelButton(props: Props) {
  const { riskLevels, onConfirm } = props;
  const [visible, setVisible] = useState(false);

  useTableScrollVisible(setVisible);

  const buttonText = riskLevels.length > 0 ? riskLevels.join(', ') : 'CRA';
  return (
    <Popover
      overlayClassName={s.popover}
      overlayInnerStyle={{ padding: 0 }}
      content={<PopupContent value={riskLevels} onConfirm={onConfirm} />}
      trigger="click"
      placement="bottomLeft"
      visible={visible}
      onVisibleChange={setVisible}
    >
      <ActionButton
        color="LEAF_GREEN"
        icon={<AlarmWarningFillIcon />}
        analyticsName="risk-filter"
        isActive={riskLevels.length !== 0}
        onClear={() => {
          onConfirm([]);
        }}
        title={buttonText}
        toolTip={'Risk Level Filter'}
      >
        {buttonText}
      </ActionButton>
    </Popover>
  );
}
