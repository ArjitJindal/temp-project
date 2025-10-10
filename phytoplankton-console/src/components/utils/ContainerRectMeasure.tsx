import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';

interface Rect {
  width: number;
  height: number;
  left: number;
  top: number;
}

interface Props {
  className?: string;
  children: (size: Rect) => JSX.Element;
}

export default function ContainerRectMeasure(props: Props) {
  const { className } = props;
  const [size, setSize] = useState<Rect | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const refreshSize = useCallback(() => {
    const el = ref.current;
    if (el != null) {
      const boundingClientRect = el.getBoundingClientRect();
      setSize({
        width: boundingClientRect.width,
        height: boundingClientRect.height,
        top: getOffsetTop(el),
        left: getOffsetLeft(el),
      });
    }
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el != null) {
      refreshSize();
      const resizeObserver = new ResizeObserver(refreshSize);
      resizeObserver.observe(el);
      return () => resizeObserver.unobserve(el);
    }
  }, [refreshSize]);

  return (
    <div ref={ref} className={className}>
      {size == null ? null : props.children(size)}
    </div>
  );
}

function getOffsetTop(element: HTMLElement | null): number {
  const parent = element?.offsetParent instanceof HTMLElement ? element?.offsetParent : null;
  return element ? element.offsetTop + getOffsetTop(parent) : 0;
}

function getOffsetLeft(element: HTMLElement | null): number {
  const parent = element?.offsetParent instanceof HTMLElement ? element?.offsetParent : null;
  return element ? element.offsetLeft + getOffsetLeft(parent) : 0;
}
