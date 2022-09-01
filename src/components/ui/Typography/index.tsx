import cn from 'clsx';
import s from './index.module.less';

type SharedProps = {
  bold?: boolean;
  className?: string;
};

export function H1(
  props: SharedProps & {
    variant: 'displayXl' | 'displayLg' | 'displayReg';
    children?: React.ReactNode;
  },
) {
  return (
    <h1 className={cn(s.h1, s[`variant-${props.variant}`], props.className)}>{props.children}</h1>
  );
}
export function H2(props: SharedProps & { children?: React.ReactNode }) {
  return <h2 className={cn(s.h2, props.bold && s.bold, props.className)}>{props.children}</h2>;
}
export function H3(props: SharedProps & { children?: React.ReactNode }) {
  return <h3 className={cn(s.h3, props.bold && s.bold, props.className)}>{props.children}</h3>;
}
export function H4(props: SharedProps & { children?: React.ReactNode }) {
  return <h4 className={cn(s.h4, props.bold && s.bold, props.className)}>{props.children}</h4>;
}
export function H5(props: SharedProps & { children?: React.ReactNode }) {
  return <h5 className={cn(s.h5, props.bold && s.bold, props.className)}>{props.children}</h5>;
}
export function H6(props: SharedProps & { children?: React.ReactNode }) {
  return <h6 className={cn(s.h6, props.bold && s.bold, props.className)}>{props.children}</h6>;
}
export function P(props: SharedProps & { variant?: 'big' | 'sml'; children?: React.ReactNode }) {
  return (
    <p className={cn(s.p, props.bold && s.bold, s[`variant-${props.variant}`], props.className)}>
      {props.children}
    </p>
  );
}
export function Small(props: SharedProps & { children?: React.ReactNode }) {
  return (
    <small className={cn(s.small, props.bold && s.bold, props.className)}>{props.children}</small>
  );
}
