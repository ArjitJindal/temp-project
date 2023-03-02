import React from 'react';
import s from './index.module.less';
const ButtonGroup = ({ children }: { children: React.ReactNode }) => (
  <div className={s.buttonGroup}>{children}</div>
);

export default ButtonGroup;
