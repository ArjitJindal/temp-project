import { H4, P } from '@/components/ui/Typography';
import { normalizeCase } from '@/utils/humanize';

interface Props {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function SettingsContainer(props: Props) {
  const { title, description, children } = props;
  return (
    <div>
      <div style={{ paddingBottom: 16 }}>
        <H4>{normalizeCase(title)}</H4>
        <P variant={'sml'} grey={true}>
          {description}
        </P>
      </div>
      <div>{children}</div>
    </div>
  );
}
