import React from 'react';
import Button, { ButtonSize, ButtonType } from './index';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';
import Icon from '@/components/ui/icons/Remix/system/delete-bin-3-line.react.svg';
import CloseIcon from '@/components/ui/icons/Remix/system/close-line.react.svg';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title="Types and sizes">
        <PropertyMatrix<ButtonSize, ButtonType>
          x={['SMALL', 'MEDIUM', 'LARGE']}
          y={['PRIMARY', 'SECONDARY', 'TETRIARY', 'TEXT', 'DANGER']}
        >
          {(size, type) => (
            <Button type={type} size={size}>
              Button
            </Button>
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title="With icon">
        <PropertyMatrix<ButtonSize, ButtonType>
          x={['SMALL', 'MEDIUM', 'LARGE']}
          y={['PRIMARY', 'SECONDARY', 'TETRIARY', 'TEXT', 'DANGER']}
        >
          {(size, type) => (
            <Button type={type} size={size} icon={<Icon />}>
              Button
            </Button>
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title="With two icons">
        <PropertyMatrix<ButtonSize, ButtonType>
          x={['SMALL', 'MEDIUM', 'LARGE']}
          y={['PRIMARY', 'SECONDARY', 'TETRIARY', 'TEXT', 'DANGER']}
        >
          {(size, type) => (
            <Button type={type} size={size} icon={<Icon />} iconRight={<CloseIcon />}>
              Button
            </Button>
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title="Icon only">
        <PropertyMatrix<ButtonSize, ButtonType>
          x={['SMALL', 'MEDIUM', 'LARGE']}
          y={['PRIMARY', 'SECONDARY', 'TETRIARY', 'TEXT', 'DANGER']}
        >
          {(size, type) => <Button type={type} size={size} icon={<Icon />} />}
        </PropertyMatrix>
      </UseCase>
      <UseCase title="Disabled">
        <PropertyMatrix<ButtonType, boolean>
          x={['PRIMARY', 'SECONDARY', 'TETRIARY', 'TEXT', 'DANGER']}
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
