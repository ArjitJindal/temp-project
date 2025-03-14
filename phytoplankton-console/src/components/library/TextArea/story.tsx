import { useState } from 'react';
import TextArea from '.';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';

export default function (): JSX.Element {
  const [value, setValue] = useState<string | undefined>(
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempo incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptat',
  );

  return (
    <>
      <UseCase title={'Basic text area'}>
        <TextArea value={value} onChange={setValue} placeholder={'Placeholder example'} />
      </UseCase>
      <UseCase title={'Text area with count'}>
        <TextArea
          value={value}
          onChange={setValue}
          placeholder={'Placeholder example'}
          showCount
          maxLength={500}
        />
      </UseCase>
      <UseCase title={'Disabled'}>
        <TextArea
          isDisabled={true}
          value={value}
          onChange={setValue}
          placeholder={'Placeholder example'}
          showCount
          maxLength={500}
        />
      </UseCase>
      <UseCase title={'Description'}>
        <TextArea
          value={value}
          onChange={setValue}
          placeholder={'Placeholder example'}
          description={'Sample description'}
          showCount
          maxLength={500}
        />
      </UseCase>
      <UseCase title={'Error'}>
        <PropertyMatrix x={[false, true]} xLabel={'disabled'}>
          {(isDisabled) => (
            <TextArea
              isDisabled={isDisabled}
              isError={true}
              value={value}
              onChange={setValue}
              showCount
              maxLength={500}
              placeholder={'Placeholder example'}
            />
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'Success'}>
        <PropertyMatrix x={[false, true]} xLabel={'disabled'}>
          {(isDisabled) => (
            <TextArea
              isDisabled={isDisabled}
              isSuccess={true}
              value={value}
              onChange={setValue}
              showCount
              maxLength={500}
              placeholder={'Placeholder example'}
            />
          )}
        </PropertyMatrix>
      </UseCase>
    </>
  );
}
