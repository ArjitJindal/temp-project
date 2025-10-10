import Breadcrumbs from '@/components/library/Breadcrumbs';
import { notEmpty } from '@/utils/array';
interface Props {
  section: 'list' | 'library';
}

export default function Header(props: Props) {
  const { section } = props;

  return (
    <Breadcrumbs
      items={[
        { title: 'Workflows', to: '/workflows' },
        section === 'list' && { title: 'My workflow', to: '/workflows/list' },
        section === 'library' && { title: 'Library', to: '/workflows/library' },
      ].filter(notEmpty)}
    />
  );
}
