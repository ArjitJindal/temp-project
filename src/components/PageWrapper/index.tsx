import React from 'react';
import { Typography } from 'antd';
import { Link } from 'react-router-dom';
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
  loading?: boolean;
  children?: React.ReactNode;
}

export default function PageWrapper(props: Props) {
  const { title, description, backButton } = props;

  // todo: migration: check if something is broken
  return (
    <div className={s.root} id="page-wrapper-root">
      {(title || description || backButton) && (
        <header className={s.head}>
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
        </header>
      )}
      <div className={s.body}>
        <ErrorBoundary>{props.children}</ErrorBoundary>
      </div>
      <Footer />
    </div>
  );
}
