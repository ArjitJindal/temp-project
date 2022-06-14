import { Alert, Layout } from 'antd';
import React from 'react';

export default function ErrorPage(props: { title: string; children: React.ReactNode }) {
  return (
    <Layout>
      <Layout.Content>
        <Alert
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          message={props.title}
          description={props.children}
          type="error"
        />
      </Layout.Content>
    </Layout>
  );
}
