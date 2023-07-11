import React from 'react';
import { Avatar as AntAvatar, Spin } from 'antd';
import styles from './index.module.less';
import { useAuth0User } from '@/utils/user-utils';

export default function Avatar() {
  const user = useAuth0User();

  const loading = (
    <span className={`${styles.action} ${styles.account}`}>
      <Spin
        size="small"
        style={{
          marginLeft: 8,
          marginRight: 8,
        }}
      />
    </span>
  );

  if (!user || !user.name) {
    return loading;
  }

  return <AntAvatar size="default" className={styles.root} src={user.picture} alt="avatar" />;
}
