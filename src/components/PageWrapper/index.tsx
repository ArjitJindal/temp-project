import React, { useEffect } from 'react';
import { Typography } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import {
  browserName,
  deviceType,
  browserVersion,
  osName,
  mobileModel,
  mobileVendor,
} from 'react-device-detect';
import ErrorBoundary from '../ErrorBoundary';
import s from './styles.module.less';
import { useAnalytics } from '@/utils/segment/context';
import { useAuth0User } from '@/utils/user-utils';
import ArrowLeftSLine from '@/components/ui/icons/Remix/arrow-left-s-line.react.svg';

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
  const user = useAuth0User();
  const analytics = useAnalytics();
  const location = useLocation();

  const tenantId = user.tenantId;

  // todo: migration: check if something is broken
  useEffect(() => {
    analytics.page(`Viewed ${location.pathname}`, {
      url: location.pathname,
      userEmail: user.verifiedEmail,
      tenant: user.tenantName,
      browserName,
      deviceType,
      browserVersion,
      osName,
      mobileModel,
      mobileVendor,
    });
  }, [analytics, tenantId, location.pathname, user.verifiedEmail, user.tenantName]);
  return (
    <div className={s.root}>
      {(title || description || backButton) && (
        <header className={s.head}>
          {title && (
            <Typography.Title level={2} className={s.title}>
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
    </div>
  );
}
