import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  useFloating,
  Placement as FloatingUiPlacement,
  useClick,
  useInteractions,
  useDismiss,
  FloatingArrow,
  useHover,
  autoUpdate,
  FloatingPortal,
  arrow,
  offset,
  flip,
  hide,
  size,
} from '@floating-ui/react';
import s from './style.module.less';
import { neverReturn } from '@/utils/lang';
import { useId } from '@/utils/hooks';

export type Placement = 'topLeft' | 'top' | 'topRight' | 'bottomLeft' | 'bottom' | 'bottomRight';
export type Trigger = 'hover' | 'click';

interface ChildrenProps {
  ref?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  ['aria-describedby']?: string;
}

export interface Props {
  trigger?: Trigger;
  title?: React.ReactNode;
  overlay?: React.ReactNode;
  placement?: Placement;
  children?: React.ReactNode | ((props: ChildrenProps) => React.ReactNode);
  arrowColor?: string;
}

const ARROW_HEIGHT = 7;
const GAP = 2;

function TooltipRoot(props: Props) {
  const { title, children, placement = 'topRight', trigger = 'hover', overlay, arrowColor } = props;

  const [isVisibleState, setIsVisibleState] = useState(false);

  const floatingUiPlacement = useFloatingUiPlacement(placement);

  const arrowRef = useRef(null);

  const { refs, floatingStyles, context, middlewareData, update, elements } = useFloating({
    strategy: 'fixed',
    placement: floatingUiPlacement,
    open: isVisibleState,
    onOpenChange: setIsVisibleState,
    middleware: [
      offset(ARROW_HEIGHT + GAP),
      flip({
        fallbackPlacements: [
          getOppositePlacement(floatingUiPlacement),
          'top',
          'top-end',
          'right',
          'bottom-end',
          'bottom',
          'bottom-start',
          'left',
          'top-start',
        ],
      }),
      arrow({
        element: arrowRef,
        padding: 6,
      }),
      size({
        apply({ availableWidth, ...state }) {
          state.elements.floating.style.maxWidth = `${Math.min(
            400,
            Math.max(50, availableWidth - 10),
          )}px`;
        },
      }),
      hide(),
    ],
  });

  const isVisible = isVisibleState && !middlewareData.hide?.referenceHidden;

  useEffect(() => {
    if (isVisibleState && elements.reference && elements.floating) {
      const cleanup = autoUpdate(elements.reference, elements.floating, update);
      return cleanup;
    }
  }, [isVisibleState, elements, update]);

  const click = useClick(context, {
    enabled: trigger === 'click',
  });
  const hover = useHover(context, {
    enabled: trigger === 'hover',
    delay: { open: 300, close: 0 },
  });
  const dismiss = useDismiss(context, {
    ancestorScroll: true,
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, hover]);

  const tooltipId = useId(`tooltip-`);

  return (
    <>
      {typeof children === 'function' ? (
        children({ ref: refs.setReference, ...getReferenceProps(), 'aria-describedby': tooltipId })
      ) : (
        <div
          ref={refs.setReference}
          className={s.iconContainer}
          aria-describedby={tooltipId}
          {...getReferenceProps()}
          style={{ maxWidth: 'fit-content' }}
        >
          {children}
        </div>
      )}
      <FloatingPortal>
        <div
          role="tooltip"
          className={s.tooltip}
          data-show={isVisible}
          ref={refs.setFloating}
          id={tooltipId}
          {...getFloatingProps()}
          style={floatingStyles}
        >
          {overlay ?? <div className={s.overlay}>{title}</div>}
          <FloatingArrow
            ref={arrowRef}
            context={context}
            className={s.arrow}
            style={{ fill: arrowColor }}
          />
        </div>
      </FloatingPortal>
    </>
  );
}

export default function Tooltip(props: Props) {
  if ((props.title == null || props.title === '') && props.overlay == null) {
    return <>{props.children}</>;
  }
  return <TooltipRoot {...props} />;
}

/*
  Helpers
 */
function useFloatingUiPlacement(placement: Placement) {
  return useMemo((): FloatingUiPlacement => {
    switch (placement) {
      case 'topLeft':
        return 'top-end';
      case 'top':
        return 'top';
      case 'topRight':
        return 'top-start';
      case 'bottomLeft':
        return 'bottom-end';
      case 'bottom':
        return 'bottom';
      case 'bottomRight':
        return 'bottom-start';
    }
    return neverReturn(placement, 'top');
  }, [placement]);
}

function getOppositePlacement(placement: FloatingUiPlacement): FloatingUiPlacement {
  switch (placement) {
    case 'top':
      return 'bottom';
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    case 'top-start':
      return 'top-end';
    case 'bottom-start':
      return 'bottom-end';
    case 'top-end':
      return 'top-start';
    case 'bottom-end':
      return 'bottom-start';
    case 'left-start':
      return 'left-end';
    case 'right-start':
      return 'right-end';
    case 'left-end':
      return 'left-start';
    case 'right-end':
      return 'right-start';
  }
  return neverReturn(placement, 'top');
}
