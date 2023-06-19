import React from 'react';
import SearchQuickFilterStories from './subtypes/SearchQuickFilter/story';
import QuickFilter from '.';
import { UseCase } from '@/pages/storybook/components';
import Icon from '@/components/ui/icons/Remix/business/stack-line.react.svg';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Simple case'}>
        <QuickFilter title={'Case ID'}>
          <div>Short content</div>
        </QuickFilter>
        <QuickFilter title={'Case ID: C-24, C-25, C-26, C-27, C-28, C-29'}>
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
        </QuickFilter>
      </UseCase>
      <UseCase title={'With icon'}>
        <QuickFilter icon={<Icon />} title={'Case ID'}>
          <div>Short content</div>
        </QuickFilter>
        <QuickFilter icon={<Icon />} title={'Case ID: C-24, C-25, C-26, C-27, C-28, C-29'}>
          <div>Short content</div>
        </QuickFilter>
      </UseCase>
      <UseCase title={'Closable'}>
        <QuickFilter icon={<Icon />} title={'Case ID'} onClear={() => {}} />
        <QuickFilter
          icon={<Icon />}
          title={'Case ID: C-24, C-25, C-26, C-27, C-28, C-29'}
          onClear={() => {}}
        />
      </UseCase>
      <SearchQuickFilterStories />
    </>
  );
}
