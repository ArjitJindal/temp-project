import { useState } from 'react';
import s from './styles.module.less';
import { useElementSize } from '@/utils/browser';

interface Props {
  isCollapsed: boolean;
  children: React.ReactNode;
}

export default function ExpandContainer(props: Props) {
  const { isCollapsed = false, children } = props;
  const [ref, setRef] = useState<HTMLElement | null>(null);
  const elementSize = useElementSize(ref);

  return (
    <div className={s.root} style={{ height: isCollapsed ? 0 : elementSize?.height }}>
      <div className={s.content} ref={setRef}>
        {children}
      </div>
    </div>
  );
}
