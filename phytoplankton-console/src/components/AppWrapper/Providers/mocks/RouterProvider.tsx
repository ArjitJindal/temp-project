import { MemoryRouter } from 'react-router-dom';
import React from 'react';

interface Props {
  children: React.ReactNode;
}

export default function RouterProvider(props: Props) {
  return <MemoryRouter>{props.children}</MemoryRouter>;
}
