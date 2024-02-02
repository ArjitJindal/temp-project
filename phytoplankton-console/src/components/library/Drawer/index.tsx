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
  title: string;
  description?: string;
  footer?: React.ReactNode;
  drawerMaxWidth?: string;
  noPadding?: boolean;
  isClickAwayEnabled?: boolean;
  rightAlignButtonsFooter?: boolean;
}

export default function Drawer(props: Props) {
  const {
    isVisible,
    title,
    description,
    onChangeVisibility,
    children,
    footer,
    noPadding = false,
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
      className={cn(s.root, isVisible && s.isVisible, noPadding && s.noPadding)}
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
            <div className={s.title} data-cy={`drawer-title-${kebabCase(title)}`}>
              {title}
            </div>
            {description && <div className={s.description}>{description}</div>}
          </div>
          <div className={s.headerSection}>
            <CrossIcon className={s.icon} onClick={handleClose} data-cy={`drawer-close-button`} />
          </div>
        </div>

        {isVisible && <div className={s.children}>{children}</div>}
        {footer && (
          <div className={cn(s.footer, props.rightAlignButtonsFooter && s.rightAlignButtonsFooter)}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    window.document.body,
  );
}
