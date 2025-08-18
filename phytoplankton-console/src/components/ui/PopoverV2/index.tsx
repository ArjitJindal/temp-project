import React, { ReactNode, useEffect, useMemo } from 'react';
import {
  arrow,
  autoUpdate,
  flip,
  FloatingPortal,
  hide,
  offset,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useId,
  useInteractions,
  useMergeRefs,
  useRole,
  Padding,
} from '@floating-ui/react';
import cn from 'classnames';
import s from './index.module.less';
import { usePortalContainer } from '@/components/ui/PortalContainerProvider';

const MAX_WIDTH = 800;

export type Placement = 'top-start' | 'top' | 'top-end' | 'bottom-start' | 'bottom' | 'bottom-end';

export type Trigger = 'click' | 'hover' | 'focus';

interface ChildrenProps {
  ref?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  ['data-state']?: 'open' | 'closed';
  ['aria-describedby']?: string;
}

export interface PopoverProps {
  content: ReactNode;
  title?: ReactNode;
  children: ReactNode | ((props: ChildrenProps) => React.ReactNode);
  trigger?: Trigger;
  placement?: Placement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disablePointerEvents?: boolean;
  hideArrow?: boolean;
  hideBoxShadow?: boolean;
  hideBackground?: boolean;
  disableInnerPadding?: boolean;
  mouseLeaveDelay?: number;
  className?: string;
  portal?: boolean;
  triggerEscapedDetectPaddings?: Padding; // when checking if the trigger is escaped, add this padding to the check
}

export default function Popover({
  content,
  title,
  children,
  trigger = 'hover',
  placement = 'bottom',
  open: controlledOpen,
  onOpenChange,
  disablePointerEvents = false,
  hideArrow = false,
  hideBoxShadow = false,
  hideBackground = false,
  disableInnerPadding = false,
  mouseLeaveDelay = 0.1,
  className,
  portal = false,
  triggerEscapedDetectPaddings,
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);

  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const arrowRef = React.useRef<HTMLDivElement>(null);

  const popoverId = useId();
  const headingId = useId();
  const descriptionId = useId();

  const {
    refs,
    floatingStyles,
    context,
    middlewareData,
    placement: computedPlacement,
  } = useFloating({
    strategy: 'absolute',
    placement,
    open,
    onOpenChange: setOpen,
    whileElementsMounted: (referenceEl, floatingEl, update) => {
      const cleanup = autoUpdate(referenceEl, floatingEl, update, {
        animationFrame: true,
      });
      return cleanup;
    },
    middleware: [
      hide({
        padding: triggerEscapedDetectPaddings,
      }),
      offset(12),
      flip({
        mainAxis: true,
      }),
      shift({ padding: 5 }),
      size({
        apply({ availableWidth, elements }) {
          Object.assign(elements.floating.style, {
            maxWidth: `${Math.min(availableWidth, MAX_WIDTH)}px`,
          });
        },
        padding: 5,
      }),
      arrow({
        element: arrowRef,
      }),
    ],
  });

  const click = useClick(context, {
    enabled: trigger === 'click',
  });

  const hover = useHover(context, {
    enabled: trigger === 'hover',
    delay: { open: 0, close: mouseLeaveDelay * 1000 },
  });

  const focus = useFocus(context, {
    enabled: trigger === 'focus',
  });

  const dismiss = useDismiss(context);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    hover,
    focus,
    dismiss,
    role,
  ]);

  const triggerRef = useMergeRefs([refs.setReference]);

  const triggerElement = useMemo(() => {
    if (!children) {
      return null;
    }

    if (typeof children === 'function') {
      return children({
        ref: refs.setReference,
        ...getReferenceProps(),
        'aria-describedby': popoverId,
        'data-state': open ? 'open' : 'closed',
      });
    }

    return (
      <div
        ref={triggerRef}
        {...getReferenceProps()}
        data-state={open ? 'open' : 'closed'}
        aria-describedby={popoverId}
      >
        {children}
      </div>
    );
  }, [children, triggerRef, getReferenceProps, open, popoverId, refs.setReference]);

  const staticSide = {
    top: 'bottom',
    right: 'left',
    bottom: 'top',
    left: 'right',
  }[computedPlacement.split('-')[0]];

  useEffect(() => {
    if (middlewareData.hide?.referenceHidden) {
      setOpen(false);
    }
  }, [middlewareData.hide?.referenceHidden, setOpen]);

  return (
    <>
      {triggerElement}
      {open && (
        <WrapInPortal open={open} usePortal={portal}>
          <div
            id={popoverId}
            ref={refs.setFloating}
            style={{
              ...floatingStyles,
              visibility: middlewareData.hide?.referenceHidden ? 'hidden' : 'visible',
            }}
            aria-labelledby={title ? headingId : undefined}
            aria-describedby={content ? descriptionId : undefined}
            {...getFloatingProps()}
            className={cn(
              s.root,
              {
                [s.disablePointerEvents]: disablePointerEvents,
                [s.hideArrow]: hideArrow,
                [s.hideBoxShadow]: hideBoxShadow,
                [s.hideBackground]: hideBackground,
                [s.disableInnerPadding]: disableInnerPadding,
              },
              className,
            )}
          >
            {!hideArrow && (
              <div
                ref={arrowRef}
                className={s.arrow}
                data-placement={computedPlacement}
                style={{
                  left: middlewareData.arrow?.x != null ? `${middlewareData.arrow.x}px` : '',
                  top: middlewareData.arrow?.y != null ? `${middlewareData.arrow.y}px` : '',
                  [staticSide ?? '']: '-8px',
                }}
              />
            )}
            {title && (
              <div className={s.title} id={headingId}>
                {title}
              </div>
            )}
            {content && (
              <div className={s.content} id={descriptionId}>
                {content}
              </div>
            )}
          </div>
        </WrapInPortal>
      )}
    </>
  );
}

function WrapInPortal(props: { open: boolean; children: ReactNode; usePortal?: boolean }) {
  const portalContainer = usePortalContainer();

  const root = portalContainer.getElement();

  return props.usePortal ? (
    <FloatingPortal root={root}>{props.children}</FloatingPortal>
  ) : (
    <>{props.children}</>
  );
}
