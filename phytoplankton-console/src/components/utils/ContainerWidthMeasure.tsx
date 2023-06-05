import React, { useLayoutEffect, useRef, useState } from 'react';

export default function ContainerWidthMeasure(props: { children: (width: number) => JSX.Element }) {
  const [width, setWidth] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el != null) {
      setWidth(el.clientWidth);
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setWidth(entry.contentRect.width);
        }
      });
      resizeObserver.observe(el);
      return () => resizeObserver.unobserve(el);
    }
  }, []);
  return (
    <div ref={ref} style={{ width: '100%' }}>
      {width == null ? null : props.children(width)}
    </div>
  );
}
