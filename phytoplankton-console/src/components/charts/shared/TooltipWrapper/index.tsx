import { useTooltip, useTooltipInPortal } from '@visx/tooltip';
import React, { useMemo } from 'react';
import { TooltipInPortalProps } from '@visx/tooltip/lib/hooks/useTooltipInPortal';
import { UseTooltipParams } from '@visx/tooltip/lib/hooks/useTooltip';

interface TooltipState<TooltipData> {
  tooltipOpen: boolean;
  tooltipData: TooltipData | null;
  tooltipTop: number;
  tooltipLeft: number;
  TooltipInPortal: React.FC<TooltipInPortalProps>;
  containerRef: (element: HTMLElement | SVGElement | null) => void;
}

interface UseTooltipResult<TooltipData> {
  state: TooltipState<TooltipData>;
  hideTooltip: UseTooltipParams<TooltipData>['hideTooltip'];
  showTooltip: UseTooltipParams<TooltipData>['showTooltip'];
}

export function useTooltipState<TooltipData>(): UseTooltipResult<TooltipData> {
  const {
    tooltipOpen,
    tooltipLeft = 0,
    tooltipTop = 0,
    tooltipData = null,
    hideTooltip,
    showTooltip,
  } = useTooltip<TooltipData>();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    scroll: true,
  });

  return useMemo(
    () => ({
      state: {
        tooltipOpen,
        tooltipLeft,
        tooltipTop,
        tooltipData,
        TooltipInPortal,
        containerRef,
      },
      hideTooltip,
      showTooltip,
    }),
    [
      tooltipOpen,
      tooltipLeft,
      tooltipTop,
      tooltipData,
      TooltipInPortal,
      containerRef,
      hideTooltip,
      showTooltip,
    ],
  );
}

type ChildrenProps = {
  containerRef: (element: HTMLElement | SVGElement | null) => void;
};

export function TooltipWrapper<TooltipData>(props: {
  tooltipState: TooltipState<TooltipData>;
  tooltipComponent: React.FC<{ tooltipData: TooltipData }>;
  children: (props: ChildrenProps) => React.ReactNode;
}) {
  const { tooltipState, tooltipComponent: TooltipComponent, children } = props;
  const { TooltipInPortal, tooltipData, tooltipTop, tooltipLeft, tooltipOpen } = tooltipState;
  const childrenProps = useMemo(() => {
    return { containerRef: tooltipState.containerRef };
  }, [tooltipState.containerRef]);
  return (
    <>
      {children(childrenProps)}
      {tooltipOpen && tooltipData && (
        <TooltipInPortal top={tooltipTop} left={tooltipLeft}>
          <TooltipComponent tooltipData={tooltipData} />
        </TooltipInPortal>
      )}
    </>
  );
}
