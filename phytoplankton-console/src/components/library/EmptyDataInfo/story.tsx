import { EmptyEntitiesInfo } from './index';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Basic'}>
        <EmptyEntitiesInfo title="Oops, no data" description="No data, no data, no data..." />
      </UseCase>
      <UseCase title={'With action'}>
        <EmptyEntitiesInfo
          title="Oops, no data"
          description="No data, no data, no data..."
          action="Create"
        />
      </UseCase>
    </>
  );
}
