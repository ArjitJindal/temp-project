import React, { useEffect } from 'react';
import { Typography } from 'antd';
import { useLocation } from 'react-router-dom';
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

interface Props {
  title?: string;
  description?: string;
  // pageContainerProps?: PageContainerProps;
  loading?: boolean;
  children?: React.ReactNode;
}

export default function PageWrapper(props: Props) {
  const user = useAuth0User();
  const analytics = useAnalytics();
  const location = useLocation();

  const userId = user.userId;
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
  const { title, description } = props;
  return (
    <div className={s.root}>
      {(title || description) && (
        <header className={s.head}>
          {title && (
            <Typography.Title level={2} className={s.title}>
              {title}
            </Typography.Title>
          )}
          {description && (
            <Typography.Paragraph className={s.description}>{description}</Typography.Paragraph>
          )}
        </header>
      )}
      <div className={s.body}>
        <ErrorBoundary>{props.children}</ErrorBoundary>
      </div>
    </div>
  );
}
