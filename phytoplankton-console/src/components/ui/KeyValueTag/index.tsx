import { Tag as AntTag } from 'antd';
import { Tag } from '@/apis';

interface Props {
  tag: Tag;
}

export default function KeyValueTag(props: Props) {
  const { tag } = props;
  return (
    <AntTag color={'cyan'}>
      <span>
        {tag.key}: <span style={{ fontWeight: 700 }}>{tag.value}</span>
      </span>
    </AntTag>
  );
}
