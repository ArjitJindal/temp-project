import React from 'react';
import cn from 'clsx';
import { Col, Row, Typography } from 'antd';
import { Link } from 'react-router-dom';
import ErrorBoundary from '../ErrorBoundary';
import s from './styles.module.less';
import ArrowLeftSLine from '@/components/ui/icons/Remix/system/arrow-left-s-line.react.svg';
import { usePageTimeLoadTracker, usePageViewTimeTracker } from '@/utils/tracker';

export const PAGE_WRAPPER_PADDING = 16;

export interface PageWrapperProps {
  title?: string;
  description?: string;
  backButton?: {
    title: string;
    url: string;
  };
  actionButton?: React.ReactNode;
  loading?: boolean;
  children?: React.ReactNode;
}

export default function PageWrapper(props: PageWrapperProps) {
  const { title, description, backButton, actionButton } = props;
  usePageViewTimeTracker();
  usePageTimeLoadTracker();

  return (
    <div className={s.root} id="page-wrapper-root">
      {(title || description || backButton || actionButton) && (
        <header className={s.head} style={{ padding: PAGE_WRAPPER_PADDING, paddingBottom: 0 }}>
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
              {actionButton && (
                <div style={{ textAlign: 'end', display: 'flex', justifyContent: 'end' }}>
                  {actionButton}
                </div>
              )}
            </Col>
          </Row>
        </header>
      )}
      <div className={cn(s.body, 'print-container')} style={{ padding: PAGE_WRAPPER_PADDING }}>
        <ErrorBoundary>{props.children}</ErrorBoundary>
      </div>
    </div>
  );
}

export function PageWrapperContentContainer(props: { children: React.ReactNode }) {
  return <div className={s.contentContainer}>{props.children}</div>;
}
