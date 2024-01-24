import React, { useState } from 'react';
import cn from 'clsx';
import s from './index.module.less';
import { useElementSize } from '@/utils/browser';

interface Props {
  maxHeight?: number;
  enableHorizontalScroll?: boolean;
  enableScroll?: boolean;
  children: (width: number) => React.ReactNode;
}

export default function ScrollContainer(props: Props) {
  const { enableHorizontalScroll = true, maxHeight, enableScroll } = props;
  const [ref, setRef] = useState<HTMLDivElement | null>(null);

  const rect = useElementSize(ref);
  return (
    <div
      ref={setRef}
      className={cn(s.root, enableHorizontalScroll && s.scroll, !enableScroll && s.disableScroll)}
    >
      <div
        style={{
          maxWidth: rect && enableHorizontalScroll ? rect.width : undefined,
          maxHeight: maxHeight,
        }}
      >
        {rect != null && props.children(rect.width ?? 0)}
      </div>
    </div>
  );
}
