import React from 'react';
import cn from 'clsx';
import { Button, Col, Row, Typography } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import ErrorBoundary from '../ErrorBoundary';
import Footer from '../AppWrapper/Footer';
import s from './styles.module.less';
import ArrowLeftSLine from '@/components/ui/icons/Remix/system/arrow-left-s-line.react.svg';

interface Props {
  title?: string;
  description?: string;
  backButton?: {
    title: string;
    url: string;
  };
  actionButton?: {
    title: string;
    url: string;
  };
  loading?: boolean;
  children?: React.ReactNode;
}

export default function PageWrapper(props: Props) {
  const { title, description, backButton, actionButton } = props;
  const navigate = useNavigate();

  // todo: migration: check if something is broken
  return (
    <div className={s.root} id="page-wrapper-root">
      {(title || description || backButton || actionButton) && (
        <header className={s.head}>
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
                <div style={{ textAlign: 'end' }}>
                  <Button
                    className={s.actionButton}
                    onClick={() => navigate(`/rules/request-new`, { replace: true })}
                  >
                    {actionButton.title}
                  </Button>
                </div>
              )}
            </Col>
          </Row>
        </header>
      )}
      <div className={cn(s.body, 'print-container')}>
        <ErrorBoundary>{props.children}</ErrorBoundary>
      </div>
      <Footer />
    </div>
  );
}
