import { BrowserRouter } from 'react-router-dom';
import React from 'react';

interface Props {
  children: React.ReactNode;
}

export default function RouterProvider(props: Props) {
  return <BrowserRouter>{props.children}</BrowserRouter>;
}
