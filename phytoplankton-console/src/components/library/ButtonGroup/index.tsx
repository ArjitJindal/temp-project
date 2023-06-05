import React from 'react';
import s from './index.module.less';
const ButtonGroup = ({ children, gap }: { children: React.ReactNode; gap?: number }) => (
  <div className={s.buttonGroup} style={{ gap }}>
    {children}
  </div>
);

export default ButtonGroup;
