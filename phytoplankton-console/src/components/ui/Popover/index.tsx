import { Popover as AntPopover, PopoverProps } from 'antd';
import cn from 'classnames';
import s from './index.module.less';

interface Props
  extends Pick<
    PopoverProps,
    | 'title'
    | 'content'
    | 'autoAdjustOverflow'
    | 'arrowPointAtCenter'
    | 'mouseLeaveDelay'
    | 'trigger'
    | 'placement'
    | 'children'
    | 'getPopupContainer'
    | 'visible'
    | 'onVisibleChange'
  > {
  disablePointerEvents?: boolean;
  hideArrow?: boolean;
  hideBoxShadow?: boolean;
  hideBackground?: boolean;
  disableInnerPadding?: boolean;
}

export default function Popover(props: Props) {
  return (
    <AntPopover
      {...props}
      overlayClassName={cn(s.root, {
        [s.disablePointerEvents]: props.disablePointerEvents,
        [s.hideArrow]: props.hideArrow,
        [s.hideBoxShadow]: props.hideBoxShadow,
        [s.hideBackground]: props.hideBackground,
        [s.disableInnerPadding]: props.disableInnerPadding,
      })}
    />
  );
}
