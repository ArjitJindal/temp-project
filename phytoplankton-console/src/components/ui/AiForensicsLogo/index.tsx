import cn from 'clsx';
import LogoShortUrl from './ai-forensics-logo-short.png';
import LogoFullUrl from './ai-forensics-logo-full.png';
import LogoOverviewUrl from './aif-overview-logo.png';
import s from './index.module.less';

interface Props {
  size?: 'DEFAULT' | 'SMALL';
  variant?: 'SHORT' | 'FULL' | 'OVERVIEW';
}

export default function AiForensicsLogo(props: Props) {
  const { size = 'DEFAULT', variant = 'SHORT' } = props;
  return (
    <img
      className={cn(s.root, s[`size-${size}`], s[`variant-${variant}`])}
      src={variant === 'SHORT' ? LogoShortUrl : variant === 'FULL' ? LogoFullUrl : LogoOverviewUrl}
      role={'presentation'}
      alt={'Ai Forensics Icon'}
    />
  );
}
