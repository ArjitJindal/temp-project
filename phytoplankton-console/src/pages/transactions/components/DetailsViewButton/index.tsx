import React, { useState } from 'react';
import cn from 'clsx';
import s from './style.module.less';
import Tooltip from '@/components/library/Tooltip';
import FileListIcon from '@/components/ui/icons/Remix/document/file-list-3-line.react.svg';

interface Props {
  onConfirm: (state: boolean) => void;
}

export default function DetailsViewButton(props: Props) {
  const { onConfirm } = props;
  const [isActive, setIsActive] = useState<boolean>(false);

  const handleClick = function (this: unknown) {
    setIsActive(!isActive);
    onConfirm(!isActive);
  };

  return (
    <div style={{ marginLeft: '5px', marginRight: '5px' }}>
      <Tooltip
        title={`${isActive ? 'Hide' : 'Show'} payment details for all rows`}
        placement="bottom"
      >
        <button
          onClick={handleClick}
          title={'Detailed View'}
          className={cn(s.root, isActive ? s[`color-BLUE-TINT`] : s[`color-WHITE`])}
        >
          <div className={s.icon} role="presentation">
            <FileListIcon />
          </div>
          <span className={s.content}>Detailed view </span>
        </button>
      </Tooltip>
    </div>
  );
}
