import LogicTag from '../LogicTag';
import COLORS from '@/components/ui/colors';
import GitMergeLineIcon from '@/components/ui/icons/Remix/development/git-merge-line.react.svg';

export default function IfTag(props: { size?: 'SMALL' | 'MEDIUM' }) {
  const { size } = props;
  return (
    <LogicTag size={size} color={COLORS.purple.tint} icon={<GitMergeLineIcon />}>
      If
    </LogicTag>
  );
}
