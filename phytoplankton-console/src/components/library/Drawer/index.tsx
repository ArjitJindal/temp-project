import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import cn from 'clsx';
import { kebabCase } from 'lodash';
import s from './index.module.less';
import CrossIcon from './cross.react.svg';

interface Props {
  isVisible: boolean;
  onChangeVisibility: (isShown: boolean) => void;
  children: React.ReactNode;
  title: string | React.ReactNode;
  description?: string;
  footer?: React.ReactNode;
  footerRight?: React.ReactNode;
  drawerMaxWidth?: string;
  noPadding?: boolean;
  isClickAwayEnabled?: boolean;
  portaled?: boolean;
  position?: 'LEFT' | 'RIGHT';
}

export default function Drawer(props: Props) {
  const {
    isVisible,
    title,
    description,
    onChangeVisibility,
    children,
    footer,
    footerRight,
    position = 'RIGHT',
    noPadding = false,
    isClickAwayEnabled = false,
    portaled = true,
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

  const result = (
    <div
      className={cn(
        s.root,
        isVisible && s.isVisible,
        noPadding && s.noPadding,
        s[`position-${position}`],
      )}
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
            <div
              className={s.title}
              data-cy={`drawer-title-${typeof title === 'string' ? kebabCase(title) : ''}`}
            >
              {title}
            </div>
            {description && <div className={s.description}>{description}</div>}
          </div>
          <div className={s.headerSection}>
            <CrossIcon className={s.icon} onClick={handleClose} data-cy={`drawer-close-button`} />
          </div>
        </div>

        {isVisible && <div className={s.children}>{children}</div>}
        {(footer != null || footerRight != null) && (
          <div className={cn(s.footer)} data-cy="drawer-footer">
            {footer && <div className={cn(s.footerSection, s.left)}>{footer}</div>}
            {footerRight && <div className={cn(s.footerSection, s.right)}>{footerRight}</div>}
          </div>
        )}
      </div>
    </div>
  );
  return (
    <>
      {portaled
        ? ReactDOM.createPortal(
            <div className={cn(s.portaledMenuContainer, isVisible && s.isVisible)}>{result}</div>,
            window.document.body,
          )
        : result}
    </>
  );
}
