import ReactDOM from 'react-dom';
import React from 'react';

interface Props {
  target?: HTMLElement;
  children: React.ReactNode;
}

export default function Portal(props: Props) {
  const { target = document.body, children } = props;
  return <>{ReactDOM.createPortal(children, target)}</>;
}
