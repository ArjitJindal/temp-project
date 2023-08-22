import React from 'react';
import WidgetGrid from './index';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title="Basic case">
        <WidgetGrid
          groups={[
            {
              groupTitle: 'Consumer users',
              items: [
                {
                  id: 'user-krs-breakdown',
                  title: 'User breakdown by KRS',
                  children: <div>User breakdown by KRS widget content</div>,
                  width: 'FULL',
                },
                {
                  id: 'user-cra-breakdown',
                  title: 'Distribution by CRA',
                  children: <div>Distribution by CRA widget content</div>,
                },
                {
                  id: 'top-10',
                  title: 'Top 10 users by rule hits',
                  children: <div>Top 10 users by rule hits widget content</div>,
                },
                {
                  id: 'user-status-distribution',
                  title: 'Distribution by User status',
                  children: <div>Distribution by User status widget content</div>,
                },
                {
                  id: 'user-kyc-distribution',
                  title: 'Distribution by user KYC status',
                  children: <div>Distribution by user KYC status widget content</div>,
                },
              ],
            },
            {
              groupTitle: 'Business users',
              items: [
                {
                  id: 'user-krs-breakdown',
                  title: 'User breakdown by KRS',
                  children: <div>User breakdown by KRS widget content</div>,
                  width: 'FULL',
                },
                {
                  id: 'user-cra-breakdown',
                  title: 'Distribution by CRA',
                  children: <div>Distribution by CRA widget content</div>,
                },
                {
                  id: 'top-10',
                  title: 'Top 10 users by rule hits',
                  children: <div>Top 10 users by rule hits widget content</div>,
                },
                {
                  id: 'user-status-distribution',
                  title: 'Distribution by User status',
                  children: <div>Distribution by User status widget content</div>,
                },
                {
                  id: 'user-kyc-distribution',
                  title: 'Distribution by user KYC status',
                  children: <div>Distribution by user KYC status widget content</div>,
                },
              ],
            },
          ]}
        />
      </UseCase>
    </>
  );
}
