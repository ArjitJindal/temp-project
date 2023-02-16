import React from 'react';
import SearchQuickFilterStories from './subtypes/SearchQuickFilter/story';
import DefaultQuickFilter from './subtypes/DefaultQuickFilter';
import { UseCase } from '@/pages/storybook/components';
import Icon from '@/components/ui/icons/Remix/business/stack-line.react.svg';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Simple case'}>
        <DefaultQuickFilter title={'Case ID'}>
          <div>Short content</div>
        </DefaultQuickFilter>
        <DefaultQuickFilter title={'Case ID: C-24, C-25, C-26, C-27, C-28, C-29'}>
          <p>
            Long content, long content, long content, long content, long content, long content, long
            content, long content, long content, long content, long content, long content, long
            content, long content, long content, long content, long content, long content, long
            content, long content
          </p>
          <p>
            Long content, long content, long content, long content, long content, long content, long
            content, long content, long content, long content, long content, long content, long
            content, long content, long content, long content, long content, long content, long
            content, long content
          </p>
          <p>
            Long content, long content, long content, long content, long content, long content, long
            content, long content, long content, long content, long content, long content, long
            content, long content, long content, long content, long content, long content, long
            content, long content
          </p>
          <p>
            Long content, long content, long content, long content, long content, long content, long
            content, long content, long content, long content, long content, long content, long
            content, long content, long content, long content, long content, long content, long
            content, long content
          </p>
          <p>
            Long content, long content, long content, long content, long content, long content, long
            content, long content, long content, long content, long content, long content, long
            content, long content, long content, long content, long content, long content, long
            content, long content
          </p>
          <p>
            Long content, long content, long content, long content, long content, long content, long
            content, long content, long content, long content, long content, long content, long
            content, long content, long content, long content, long content, long content, long
            content, long content
          </p>
          <p>
            Long content, long content, long content, long content, long content, long content, long
            content, long content, long content, long content, long content, long content, long
            content, long content, long content, long content, long content, long content, long
            content, long content
          </p>
        </DefaultQuickFilter>
      </UseCase>
      <UseCase title={'With icon'}>
        <DefaultQuickFilter icon={<Icon />} title={'Case ID'}>
          <div>Short content</div>
        </DefaultQuickFilter>
        <DefaultQuickFilter icon={<Icon />} title={'Case ID: C-24, C-25, C-26, C-27, C-28, C-29'}>
          <div>Short content</div>
        </DefaultQuickFilter>
      </UseCase>
      <UseCase title={'Closable'}>
        <DefaultQuickFilter icon={<Icon />} title={'Case ID'} onClear={() => {}} />
        <DefaultQuickFilter
          icon={<Icon />}
          title={'Case ID: C-24, C-25, C-26, C-27, C-28, C-29'}
          onClear={() => {}}
        />
      </UseCase>
      <SearchQuickFilterStories />
    </>
  );
}
