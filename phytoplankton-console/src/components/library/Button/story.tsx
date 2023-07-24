import React from 'react';
import Button, { ButtonSize, ButtonType } from './index';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';
import Icon from '@/components/ui/icons/Remix/system/delete-bin-3-line.react.svg';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title="Types and sizes">
        <PropertyMatrix<ButtonType, ButtonSize>
          x={['PRIMARY', 'SECONDARY', 'TETRIARY', 'TEXT']}
          y={['SMALL', 'MEDIUM', 'LARGE']}
        >
          {(type, size) => (
            <Button type={type} size={size}>
              Button
            </Button>
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title="Danger">
        <PropertyMatrix<ButtonType, ButtonSize>
          x={['PRIMARY', 'SECONDARY', 'TETRIARY', 'TEXT']}
          y={['SMALL', 'MEDIUM', 'LARGE']}
        >
          {(type, size) => (
            <Button type={type} size={size} isDanger={true}>
              Button
            </Button>
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title="With icon">
        <PropertyMatrix<ButtonType, ButtonSize>
          x={['PRIMARY', 'SECONDARY', 'TETRIARY', 'TEXT']}
          y={['SMALL', 'MEDIUM', 'LARGE']}
        >
          {(type, size) => (
            <Button type={type} size={size} icon={<Icon />}>
              Button
            </Button>
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title="Disabled">
        <PropertyMatrix<ButtonType, boolean>
          x={['PRIMARY', 'SECONDARY', 'TETRIARY', 'TEXT']}
          y={[false, true]}
        >
          {(type, isDisabled) => (
            <Button type={type} isDisabled={isDisabled} icon={<Icon />}>
              Button
            </Button>
          )}
        </PropertyMatrix>
      </UseCase>
    </>
  );
}
