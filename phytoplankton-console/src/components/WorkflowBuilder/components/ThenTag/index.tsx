import LogicTag from '../LogicTag';
import COLORS from '@/components/ui/colors';
import GitMergeLineIcon from '@/components/ui/icons/Remix/development/git-merge-line.react.svg';

export default function ThenTag(props: { size?: 'SMALL' | 'MEDIUM' }) {
  const { size } = props;
  return (
    <LogicTag size={size} color={COLORS.green.tint} icon={<GitMergeLineIcon />}>
      Then
    </LogicTag>
  );
}
