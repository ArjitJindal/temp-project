import React, { useState } from 'react';
import Providers from './Providers';
import Menu from './Menu';
import Header from './Header';
import Footer from './Footer';
import s from './styles.module.less';
import ErrorBoundary from '@/components/ErrorBoundary';

interface Props {
  children?: React.ReactNode;
}

export const THEME = 'light';

export default function AppWrapper(props: Props) {
  const [isCollapsed, setCollapsed] = useState(false);
  // todo: migration: move background to variable
  return (
    <Providers>
      <ErrorBoundary>
        <div className={`${s.root} ${isCollapsed && s.isCollapsed}`}>
          <Header className={s.header} />
          <aside className={s.aside}>
            <Menu isCollapsed={isCollapsed} onChangeCollapsed={setCollapsed} />
          </aside>
          <main className={s.main}>
            <ErrorBoundary>{props.children}</ErrorBoundary>
            <Footer />
          </main>
        </div>
      </ErrorBoundary>
    </Providers>
  );
}
