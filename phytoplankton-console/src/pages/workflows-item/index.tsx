import { useParams } from 'react-router';
import s from './index.module.less';
import WorkflowBuilder from '@/components/WorkflowBuilder';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import Button from '@/components/library/Button';
import { notEmpty } from '@/utils/array';
import { makeUrl } from '@/utils/routing';

export default function WorkflowsItemPage() {
  const { id } = useParams<'id'>() as {
    id: string;
  };

  return (
    <div className={s.root}>
      <div className={s.header}>
        <div className={s.headerLeft}>
          <Breadcrumbs
            items={[
              { title: 'Workflows', to: '/workflows' },
              { title: 'My workflow', to: '/workflows/list' },
              { title: `Workflow ${id}`, to: makeUrl('/workflows/list/:id', { id }) },
            ].filter(notEmpty)}
          />
        </div>
        <div className={s.headerRight}>
          <Button type="SECONDARY">Cancel</Button>
          <Button type="PRIMARY">Publish</Button>
        </div>
      </div>
      <div className={s.content}>
        <WorkflowBuilder />
      </div>
    </div>
  );
}
