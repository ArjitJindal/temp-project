import { useState } from 'react';
import cn from 'clsx';
import { useDemoMode } from '../../../Providers/DemoModeProvider';
import { getOr } from '../../../../../utils/asyncResource';
import s from './index.module.less';
import PlayCircleLineIcon from '@/components/ui/icons/Remix/media/play-circle-line.react.svg';
import Popover from '@/components/ui/Popover';

interface Props {
  isCollapsed: boolean;
}

export default function DemoModeSwitch(props: Props) {
  const { isCollapsed } = props;

  const [isPopoverVisible, setPopoverVisible] = useState(false);

  return (
    <Popover
      content={<Button />}
      placement="right"
      visible={isPopoverVisible}
      onVisibleChange={(visible) => {
        if (isCollapsed) {
          setPopoverVisible(visible);
        }
      }}
    >
      <div className={cn(s.root, isCollapsed && s.isCollapsed)}>
        <Button isCollapsed={isCollapsed} />
      </div>
    </Popover>
  );
}

const OPTIONS = [
  { value: false, title: 'OFF' },
  { value: true, title: 'ON' },
];

function Button(props: { isCollapsed?: boolean }) {
  const { isCollapsed } = props;
  const [isDemoModeRes, setDemoMode] = useDemoMode();
  const isDemoMode = getOr(isDemoModeRes, false);
  return (
    <div className={cn(s.button, isCollapsed && s.isCollapsed)}>
      <PlayCircleLineIcon className={s.demoModeIcon} />
      {!isCollapsed && (
        <>
          <span>Demo mode</span>
          <button
            className={s.switch}
            onClick={() => {
              setDemoMode(!isDemoMode);
            }}
          >
            {OPTIONS.map((option) => (
              <div
                key={option.title}
                className={cn(s.item, option.value === isDemoMode && s.isActive)}
              >
                {option.title}
              </div>
            ))}
          </button>
        </>
      )}
    </div>
  );
}
