import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import cn from 'clsx';
import { kebabCase } from 'lodash';
import s from './index.module.less';
import CrossIcon from './cross.react.svg';
import ConfirmModal from '@/components/utils/Confirm/ConfirmModal';

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
  portaled?: boolean;
  position?: 'LEFT' | 'RIGHT';
  hasChanges?: boolean;
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
    portaled = true,
    hasChanges = false,
  } = props;

  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleClose = () => {
    if (hasChanges) {
      setShowConfirmation(true);
    } else {
      onChangeVisibility(false);
    }
  };

  const handleConfirm = () => {
    setShowConfirmation(false);
    onChangeVisibility(false);
  };

  const handleCancel = () => {
    setShowConfirmation(false);
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

  const handleClickAway = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!showConfirmation && !ref.current?.contains(e.target as Node)) {
      handleClose();
    }
  };

  const result = (
    <div
      className={cn(
        s.root,
        isVisible && s.isVisible,
        noPadding && s.noPadding,
        s[`position-${position}`],
      )}
      onClick={handleClickAway}
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
      <ConfirmModal
        isVisible={showConfirmation}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        text="Are you sure you want to close the drawer? You will lose all unsaved changes."
      />
    </div>
  );
  return (
    <div className={s.wrapper}>
      {portaled
        ? ReactDOM.createPortal(
            <div className={cn(s.portaledMenuContainer, isVisible && s.isVisible)}>{result}</div>,
            window.document.body,
          )
        : result}
    </div>
  );
}
