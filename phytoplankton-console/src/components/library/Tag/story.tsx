import React from 'react';
import Tag from './index';
import { UseCase } from '@/pages/storybook/components';
import PencilLineIcon from '@/components/ui/icons/Remix/design/pencil-line.react.svg';
import DeleteBinLineIcon from '@/components/ui/icons/Remix/system/delete-bin-line.react.svg';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Tag with actions'}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {[
            'First tag',
            'Another tag with long content inside, which should be trimmed after some limit of width',
            'Second tag',
            'Third tag',
            'Another long tag here, should be cut somewhere',
            'Fourth tag',
            'Fifth tag',
            'Sixth tag',
            'The Last Tag',
          ].map((text) => (
            <Tag
              key={text}
              kind="TAG_WITH_ACTIONS"
              actions={[
                {
                  key: 'edit',
                  icon: <PencilLineIcon />,
                  action: () => {
                    console.info(`Edit ${text}`);
                  },
                },
                {
                  key: 'delete',
                  icon: <DeleteBinLineIcon />,
                  action: () => {
                    console.info(`Delete ${text}`);
                  },
                },
              ]}
            >
              {text}
            </Tag>
          ))}
        </div>
      </UseCase>
    </>
  );
}
