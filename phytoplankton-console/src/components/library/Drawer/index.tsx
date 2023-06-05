import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import cn from 'clsx';
import s from './index.module.less';
import CrossIcon from './cross.react.svg';

interface Props {
  isVisible: boolean;
  onChangeVisibility: (isShown: boolean) => void;
  children: React.ReactNode;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  drawerMaxWidth?: string;
  isClickAwayEnabled?: boolean;
}

export default function Drawer(props: Props) {
  const {
    isVisible,
    title,
    description,
    onChangeVisibility,
    children,
    footer,
    isClickAwayEnabled = false,
  } = props;

  const handleClose = () => {
    onChangeVisibility(false);
  };

  useEffect(() => {
    if (isVisible) {
      document.body.classList.add(s.lockScroll);
      return () => {
        document.body.classList.remove(s.lockScroll);
      };
    }
  }, [isVisible]);

  const ref = React.useRef<HTMLDivElement>(null);

  return ReactDOM.createPortal(
    <div
      className={cn(s.root, isVisible && s.isVisible)}
      onClick={() => {
        if (isClickAwayEnabled) {
          handleClose();
        }
      }}
    >
      <div
        className={s.content}
        onClick={(e) => {
          e.stopPropagation();
        }}
        ref={ref}
        style={props.drawerMaxWidth ? { maxWidth: props.drawerMaxWidth } : {}}
      >
        <div className={s.header}>
          <div className={s.headerSection}>
            <div className={s.title}>{title}</div>
            {description && <div className={s.description}>{description}</div>}
          </div>
          <div className={s.headerSection}>
            <CrossIcon className={s.icon} onClick={handleClose} />
          </div>
        </div>
        <div className={s.children}>{children}</div>
        {footer && <div className={s.footer}>{footer}</div>}
      </div>
    </div>,
    window.document.body,
  );
}
