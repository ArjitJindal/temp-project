import React, { useMemo, useRef, useState } from 'react';
import {
  useFloating,
  Placement as FloatingUiPlacement,
  useClick,
  useInteractions,
  useDismiss,
  arrow,
  offset,
  FloatingArrow,
  useHover,
  autoUpdate,
  flip,
  FloatingPortal,
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
  autoUpdateEnabled?: boolean; // This adds performance overhead, so use only when tooltip content is dynamic
  portaled?: boolean; // By default, tooltip is rendered in the same DOM at the parent element
}

const ARROW_HEIGHT = 7;
const GAP = 2;

function TooltipRoot(props: Props) {
  const {
    title,
    children,
    placement = 'top',
    trigger = 'hover',
    overlay,
    arrowColor,
    autoUpdateEnabled = false,
    portaled = false,
  } = props;

  const [isVisible, setIsVisible] = useState(false);

  const floatingUiPlacement = useFloatingUiPlacement(placement);

  const arrowRef = useRef(null);

  const { refs, floatingStyles, context } = useFloating({
    placement: floatingUiPlacement,
    open: isVisible,
    onOpenChange: setIsVisible,
    whileElementsMounted: autoUpdateEnabled || portaled ? autoUpdate : undefined,
    middleware: [
      arrow({
        element: arrowRef,
        padding: 6,
      }),
      offset(ARROW_HEIGHT + GAP),
      flip(),
    ],
  });

  const click = useClick(context, {
    enabled: trigger === 'click',
  });
  const hover = useHover(context, {
    enabled: trigger === 'hover',
    delay: 300,
  });
  const dismiss = useDismiss(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, hover]);

  const tooltipId = useId(`tooltip-`);

  const tooltipNode = (
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
  );

  return (
    <>
      {typeof children === 'function' ? (
        children({ ref: refs.setReference, ...getReferenceProps(), 'aria-describedby': tooltipId })
      ) : (
        <div ref={refs.setReference} {...getReferenceProps()} aria-describedby={tooltipId}>
          {children}
        </div>
      )}
      {portaled ? <FloatingPortal>{tooltipNode}</FloatingPortal> : tooltipNode}
    </>
  );
}

export default function Tooltip(props: Props) {
  if (props.title == null && props.overlay == null) {
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
        return 'top-start';
      case 'top':
        return 'top';
      case 'topRight':
        return 'top-end';
      case 'bottomLeft':
        return 'bottom-start';
      case 'bottom':
        return 'bottom';
      case 'bottomRight':
        return 'bottom-end';
    }
    return neverReturn(placement, 'top');
  }, [placement]);
}
