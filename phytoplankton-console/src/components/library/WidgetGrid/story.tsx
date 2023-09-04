import React from 'react';
import WidgetGrid from './index';
import { UseCase } from '@/pages/storybook/components';
import Widget from '@/components/library/Widget';

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
                  props: {
                    id: 'user-krs-breakdown',
                    title: 'User breakdown by KRS',
                    children: <div>User breakdown by KRS widget content</div>,
                    width: 'FULL',
                  },
                  component: Widget,
                },
                {
                  props: {
                    id: 'user-cra-breakdown',
                    title: 'Distribution by CRA',
                    children: <div>Distribution by CRA widget content</div>,
                  },
                  component: Widget,
                },
                {
                  props: {
                    id: 'top-10',
                    title: 'Top 10 users by rule hits',
                    children: <div>Top 10 users by rule hits widget content</div>,
                  },
                  component: Widget,
                },
                {
                  props: {
                    id: 'user-status-distribution',
                    title: 'Distribution by User status',
                    children: <div>Distribution by User status widget content</div>,
                  },
                  component: Widget,
                },
                {
                  props: {
                    id: 'user-kyc-distribution',
                    title: 'Distribution by user KYC status',
                    children: <div>Distribution by user KYC status widget content</div>,
                  },
                  component: Widget,
                },
              ],
            },
            {
              groupTitle: 'Business users',
              items: [
                {
                  props: {
                    id: 'user-krs-breakdown',
                    title: 'User breakdown by KRS',
                    children: <div>User breakdown by KRS widget content</div>,
                    width: 'FULL',
                  },
                  component: Widget,
                },
                {
                  props: {
                    id: 'user-cra-breakdown',
                    title: 'Distribution by CRA',
                    children: <div>Distribution by CRA widget content</div>,
                  },
                  component: Widget,
                },
                {
                  props: {
                    id: 'top-10',
                    title: 'Top 10 users by rule hits',
                    children: <div>Top 10 users by rule hits widget content</div>,
                  },
                  component: Widget,
                },
                {
                  props: {
                    id: 'user-status-distribution',
                    title: 'Distribution by User status',
                    children: <div>Distribution by User status widget content</div>,
                  },
                  component: Widget,
                },
                {
                  props: {
                    id: 'user-kyc-distribution',
                    title: 'Distribution by user KYC status',
                    children: <div>Distribution by user KYC status widget content</div>,
                  },
                  component: Widget,
                },
              ],
            },
          ]}
        />
      </UseCase>
    </>
  );
}
