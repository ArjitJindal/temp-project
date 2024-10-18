import React from 'react';
import ImageUrl from './sample_image.png';
import Avatar from './index';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title="Sizes">
        <PropertyMatrix
          yLabel="picture"
          xLabel="size"
          y={[true, false]}
          x={['small', 'large'] as ('small' | 'large')[]}
        >
          {(size, hasPicture) => (
            <Avatar
              size={size}
              user={{
                id: '123',
                email: 'sample@sample.com',
                name: 'John Dow',
                blocked: false,
                emailVerified: true,
                role: 'admin',
                picture: hasPicture ? ImageUrl : null,
              }}
            />
          )}
        </PropertyMatrix>
      </UseCase>
    </>
  );
}
