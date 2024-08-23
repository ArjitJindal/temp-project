import React from 'react';
import { Col, Row, Typography } from 'antd';
import cn from 'clsx';
import { Link } from 'react-router-dom';
import ErrorBoundary from '../utils/ErrorBoundary';
import s from './styles.module.less';
import ArrowLeftSLine from '@/components/ui/icons/Remix/system/arrow-left-s-line.react.svg';

export const PAGE_WRAPPER_PADDING = 16;

export interface PageWrapperProps {
  title?: string;
  description?: string;
  header?: React.ReactNode;
  disableHeaderPadding?: boolean;
  backButton?: {
    title: string;
    url: string;
  };
  actionButton?: React.ReactNode;
  loading?: boolean;
  children?: React.ReactNode;
}

export default function PageWrapper(props: PageWrapperProps) {
  return (
    <div className={s.root} id="page-wrapper-root">
      <Header {...props} />
      <div
        className={cn(s.body, 'print-container')}
        style={{ padding: PAGE_WRAPPER_PADDING, paddingTop: 8 }}
      >
        <ErrorBoundary>{props.children}</ErrorBoundary>
      </div>
    </div>
  );
}

function Header(props: PageWrapperProps) {
  const { header, title, description, backButton, actionButton, disableHeaderPadding } = props;
  if (header != null) {
    return <div className={cn(!disableHeaderPadding && s.customHeader)}>{header}</div>;
  }
  return (
    <>
      {(title || description || backButton || actionButton) && (
        <header
          className={s.head}
          style={{ padding: PAGE_WRAPPER_PADDING, paddingBottom: 8 }}
          data-sentry-allow={true}
        >
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
              <div style={{ textAlign: 'end', display: 'flex', justifyContent: 'end' }}>
                {actionButton}
              </div>
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
