import React, { useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useScroll } from 'ahooks';
import s from './index.module.less';
import ContainerRectMeasure from '@/components/utils/ContainerRectMeasure';

interface Props {
  top?: number;
  children: (isSticky: boolean) => React.ReactNode;
}

export default function Sticky(props: Props) {
  const { top = 0, children } = props;
  const target = useMemo<HTMLElement>((): HTMLElement => {
    const result = document.getElementById('body-prepend-target');
    if (result == null) {
      throw new Error(`#body-prepend-target not found, unable to make a React.Portal`);
    }
    return result;
  }, []);

  const scrollPosition = useScroll();

  return (
    <ContainerRectMeasure>
      {(rect) => {
        const isSticky = scrollPosition.top > rect.top - top;
        return (
          <React.Fragment key="sticky-portal">
            {ReactDOM.createPortal(
              <div
                data-cy="sticky"
                className={s.root}
                style={{
                  position: isSticky ? 'fixed' : 'absolute',
                  top: isSticky ? top : rect.top,
                  left: rect.left,
                  width: rect.width,
                  height: rect.height,
                }}
              >
                {children(isSticky)}
              </div>,
              target,
            )}
            {children(false)}
          </React.Fragment>
        );
      }}
    </ContainerRectMeasure>
  );
}
