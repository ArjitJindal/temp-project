import React, { useState } from 'react';
import { Space, Col, Row, Typography } from 'antd';
import cn from 'clsx';
import { Link } from 'react-router-dom';
import ErrorBoundary from '../ErrorBoundary';
import SuperAdminContainer from '../library/SuperAdminContainer';
import COLORS from '../ui/colors';
import Toggle from '../library/Toggle';
import s from './styles.module.less';
import ArrowLeftSLine from '@/components/ui/icons/Remix/system/arrow-left-s-line.react.svg';
import { isSuperAdmin, useAuth0User } from '@/utils/user-utils';

export const PAGE_WRAPPER_PADDING = 16;

export const PageWrapperContext = React.createContext<{ superAdminMode: boolean } | null>(null);

export interface PageWrapperProps {
  title?: string;
  description?: string;
  header?: React.ReactNode;
  backButton?: {
    title: string;
    url: string;
  };
  actionButton?: React.ReactNode;
  loading?: boolean;
  superAdminMode?: {
    tooltip: string;
  };
  children?: React.ReactNode;
}

export default function PageWrapper(props: PageWrapperProps) {
  const [isSuperAdminMode, setIsSuperAdminMode] = useState(false);

  return (
    <PageWrapperContext.Provider value={{ superAdminMode: isSuperAdminMode }}>
      <div className={s.root} id="page-wrapper-root">
        <Header
          {...props}
          isSuperAdminMode={isSuperAdminMode}
          onSuperAdminModeChange={setIsSuperAdminMode}
        />
        <div
          className={cn(s.body, 'print-container')}
          style={{ padding: PAGE_WRAPPER_PADDING, paddingTop: 8 }}
        >
          <ErrorBoundary>{props.children}</ErrorBoundary>
        </div>
      </div>
    </PageWrapperContext.Provider>
  );
}

function Header(
  props: PageWrapperProps & {
    isSuperAdminMode: boolean;
    onSuperAdminModeChange: (isSuperAdminMode: boolean) => void;
  },
) {
  const user = useAuth0User();
  const { header, title, description, backButton, actionButton, superAdminMode } = props;
  if (header != null) {
    return <>{header}</>;
  }
  return (
    <>
      {(title || description || backButton || actionButton) && (
        <header className={s.head} style={{ padding: PAGE_WRAPPER_PADDING, paddingBottom: 8 }}>
          <Row>
            <Col xs={18}>
              {title && (
                <Typography.Title id={title} level={2} className={s.title}>
                  {title}
                </Typography.Title>
              )}
              {description && (
                <Typography.Paragraph className={s.description}>{description}</Typography.Paragraph>
              )}

              {backButton && (
                <Link className={s.backButton} to={backButton.url}>
                  <ArrowLeftSLine />
                  {backButton.title}
                </Link>
              )}
            </Col>
            <Col xs={6}>
              {(actionButton || superAdminMode) && (
                <div style={{ textAlign: 'end', display: 'flex', justifyContent: 'end' }}>
                  <Space>
                    {superAdminMode && isSuperAdmin(user) && (
                      <SuperAdminContainer tooltip={superAdminMode.tooltip} tooltipPlacement="left">
                        <Toggle
                          height={20}
                          width={40}
                          uncheckedIcon={false}
                          checkedIcon={false}
                          onColor={COLORS.red.base}
                          value={props.isSuperAdminMode}
                          onChange={(v) => props.onSuperAdminModeChange(Boolean(v))}
                        />
                      </SuperAdminContainer>
                    )}
                    {actionButton}
                  </Space>
                </div>
              )}
            </Col>
          </Row>
        </header>
      )}
    </>
  );
}

export function PageWrapperContentContainer(props: { children: React.ReactNode }) {
  return <div className={s.contentContainer}>{props.children}</div>;
}
