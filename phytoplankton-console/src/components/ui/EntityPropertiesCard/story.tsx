import React from 'react';
import EntityPropertiesCard from './index';
import { UseCase } from '@/pages/storybook/components';
import EntityInfoGrid from '@/components/ui/EntityInfoGrid';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Basic'}>
        <EntityPropertiesCard title={'Card title'}>test</EntityPropertiesCard>
      </UseCase>
      <UseCase title={'Grid'}>
        <EntityInfoGrid.Root columns={3}>
          <EntityInfoGrid.Cell>{'Row 1, column 1'}</EntityInfoGrid.Cell>
          <EntityInfoGrid.Cell>{'Row 1, column 2'}</EntityInfoGrid.Cell>
          <EntityInfoGrid.Cell>{'Row 1, column 3'}</EntityInfoGrid.Cell>
          <EntityInfoGrid.Cell rowSpan={2}>{'Row 2, column 1'}</EntityInfoGrid.Cell>
          <EntityInfoGrid.Cell>{'Row 2, column 2-1'}</EntityInfoGrid.Cell>
          <EntityInfoGrid.Cell rowSpan={2}>{'Row 2, column 3'}</EntityInfoGrid.Cell>
          <EntityInfoGrid.Cell>{'Row 2, column 2-2'}</EntityInfoGrid.Cell>
          <EntityInfoGrid.Cell columnSpan={3}>{'Row 3, column 1'}</EntityInfoGrid.Cell>
        </EntityInfoGrid.Root>
      </UseCase>
    </>
  );
}
