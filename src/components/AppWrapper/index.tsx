import React, { useState } from 'react';
import cn from 'clsx';
import Providers, { LocalOnlyProviders } from './Providers';
import Menu from './Menu';
import Header from './Header';
import s from './styles.module.less';
import ErrorBoundary from '@/components/ErrorBoundary';
import StorybookPage from '@/pages/storybook';
import { useDemoMode } from '@/components/AppWrapper/Providers/DemoModeProvider';
import { getOr } from '@/utils/asyncResource';

interface Props {
  children?: React.ReactNode;
}

function Content(props: Props) {
  const [isCollapsed, setCollapsed] = useState(false);
  const [isDemoModeRes] = useDemoMode();

  return (
    <div className={`${s.root} ${isCollapsed && s.isCollapsed}`}>
      <Header className={cn(s.header, getOr(isDemoModeRes, true) && s.isDemoMode)} />
      <aside className={s.aside}>
        <Menu isCollapsed={isCollapsed} onChangeCollapsed={setCollapsed} />
      </aside>
      <main className={s.main}>
        <ErrorBoundary>{props.children}</ErrorBoundary>
      </main>
    </div>
  );
}

export default function AppWrapper(props: Props) {
  if (window.location.pathname.startsWith('/storybook')) {
    return (
      <LocalOnlyProviders>
        <StorybookPage />
      </LocalOnlyProviders>
    );
  }

  return (
    <Providers>
      <ErrorBoundary>
        <Content {...props} />
      </ErrorBoundary>
    </Providers>
  );
}
