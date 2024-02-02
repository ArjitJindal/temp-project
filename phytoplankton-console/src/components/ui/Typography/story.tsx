import React from 'react';
import * as Typography from './index';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'All text styles in regular/bold variants'}>
        <PropertyMatrix x={[false, true]} xLabel="bold">
          {(bold) => (
            <div>
              <Typography.H1 bold={bold}>H1</Typography.H1>
              <Typography.H3 bold={bold}>H3</Typography.H3>
              <Typography.H4 bold={bold}>H4</Typography.H4>
              <Typography.H5 bold={bold}>H5</Typography.H5>
              <Typography.H6 bold={bold}>H6</Typography.H6>
              <Typography.P bold={bold}>P</Typography.P>
              <Typography.Small bold={bold}>Small</Typography.Small>
            </div>
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'P variants with different size & fontWeights'}>
        <PropertyMatrix<React.ComponentProps<typeof Typography.P>['variant']>
          x={['xs', 's', 'm', 'l', 'xl', '2xl']}
          y={['normal', 'medium', 'semibold', 'bold']}
        >
          {(variant, fontWeight) => (
            <Typography.P variant={variant} fontWeight={fontWeight as any}>
              P
            </Typography.P>
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'H1 variants'}>
        <PropertyMatrix<React.ComponentProps<typeof Typography.H1>['variant']>
          x={['displayXl', 'displayLg', 'displayReg']}
        >
          {(variant) => <Typography.H1 variant={variant}>H1</Typography.H1>}
        </PropertyMatrix>
      </UseCase>
    </>
  );
}
