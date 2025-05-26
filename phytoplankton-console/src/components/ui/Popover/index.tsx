import { Popover as PopoverAntd, PopoverProps } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props extends PopoverProps {
  color?: string;
  content: React.ReactNode;
  title?: string;
  trigger?: 'click' | 'hover' | 'focus';
  children: React.ReactNode;
  wrapText?: boolean;
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
}

export const Popover = (props: Props): JSX.Element => {
  const {
    color,
    content,
    title,
    trigger = 'hover',
    children,
    visible,
    onVisibleChange,
    ...rest
  } = props;
  const [isVisible, setIsVisible] = useState(visible);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleVisibilityChange = useCallback(
    (visible: boolean) => {
      setIsVisible(visible);
      onVisibleChange?.(visible);
    },
    [onVisibleChange],
  );

  useEffect(() => {
    if (!isVisible || !triggerRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry.isIntersecting && isVisible) {
          handleVisibilityChange(false);
        }
      },
      {
        threshold: 0.1,
        root: null,
      },
    );

    observer.observe(triggerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [isVisible, handleVisibilityChange]);

  return (
    <PopoverAntd
      content={content}
      title={title}
      color={color}
      trigger={trigger}
      visible={isVisible}
      onVisibleChange={handleVisibilityChange}
      getPopupContainer={(triggerNode) => triggerNode.parentElement || document.body}
      {...rest}
    >
      <div ref={triggerRef}>{children}</div>
    </PopoverAntd>
  );
};

export default Popover;
