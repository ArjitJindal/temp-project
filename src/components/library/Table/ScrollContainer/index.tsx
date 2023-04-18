import React, { useRef } from 'react';
import s from './index.module.less';
import { useElementRect } from '@/utils/browser';

interface Props {
  maxHeight?: number;
  enableHorizontalScroll?: boolean;
  children: (width: number) => React.ReactNode;
}

export default function ScrollContainer(props: Props) {
  const { enableHorizontalScroll = true, maxHeight } = props;
  const ref = useRef<HTMLDivElement>(null);

  const rect = useElementRect(ref);
  return (
    <div ref={ref} className={s.root}>
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
