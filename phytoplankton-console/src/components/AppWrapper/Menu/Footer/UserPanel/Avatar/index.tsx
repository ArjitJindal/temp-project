import React from 'react';
import { Avatar as AntAvatar } from 'antd';
import styles from './index.module.less';
import { useAuth0User } from '@/utils/user-utils';
import Spinner from '@/components/library/Spinner';

export default function Avatar() {
  const user = useAuth0User();

  const loading = (
    <span className={`${styles.action} ${styles.account}`}>
      <Spinner size="SMALL" />
    </span>
  );

  if (!user || !user.name) {
    return loading;
  }

  return <AntAvatar size="default" className={styles.root} src={user.picture} alt="avatar" />;
}
