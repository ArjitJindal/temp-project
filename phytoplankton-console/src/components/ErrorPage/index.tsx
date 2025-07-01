import React from 'react';
import s from './index.module.less';
import Alert from '@/components/library/Alert';

export default function ErrorPage(props: { title: string; children: React.ReactNode }) {
  return (
    <div className={s.layout}>
      <div className={s.content}>
        <div className={s.alertContainer}>
          <Alert type="ERROR">
            <div className={s.alertContent}>
              <div className={s.alertTitle}>{props.title}</div>
              <div className={s.alertDescription}>{props.children}</div>
            </div>
          </Alert>
        </div>
      </div>
    </div>
  );
}
