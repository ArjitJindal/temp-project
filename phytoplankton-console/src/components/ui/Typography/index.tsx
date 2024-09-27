import cn from 'clsx';
import React, { HTMLAttributes, CSSProperties } from 'react';
import s from './index.module.less';

type SharedProps = {
  bold?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function H1(
  props: SharedProps &
    HTMLAttributes<HTMLHeadingElement> & {
      variant?: 'displayXl' | 'displayLg' | 'displayReg';
      children?: React.ReactNode;
    },
) {
  const { className, variant = 'displayReg', ...rest } = props;
  return (
    <h1 {...rest} className={cn(s.h1, s[`variant-${variant}`], className)}>
      {props.children}
    </h1>
  );
}
export function H2(
  props: SharedProps & HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode },
) {
  const { className, bold, ...rest } = props;
  return (
    <h2 {...rest} className={cn(s.h2, bold && s.bold, className)}>
      {props.children}
    </h2>
  );
}
export function H3(
  props: SharedProps & HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode },
) {
  const { className, bold, ...rest } = props;
  return (
    <h3 {...rest} className={cn(s.h3, bold && s.bold, className)} style={props.style}>
      {props.children}
    </h3>
  );
}
export function H4(
  props: SharedProps & HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode },
) {
  const { className, bold, ...rest } = props;
  return (
    <h4 {...rest} className={cn(s.h4, bold && s.bold, className)} style={props.style}>
      {props.children}
    </h4>
  );
}
export function H5(
  props: SharedProps & HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode },
) {
  const { className, bold, ...rest } = props;
  return (
    <h5 {...rest} className={cn(s.h5, bold && s.bold, className)} style={props.style}>
      {props.children}
    </h5>
  );
}
export function H6(
  props: SharedProps & HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode },
) {
  const { className, bold, ...rest } = props;
  return (
    <h6 {...rest} className={cn(s.h6, bold && s.bold, className)} style={props.style}>
      {props.children}
    </h6>
  );
}
export function P(
  props: SharedProps &
    HTMLAttributes<HTMLParagraphElement> & {
      variant?: 'xs' | 's' | 'm' | 'l' | 'xl' | '2xl';
      fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold ';
      children?: React.ReactNode;
      grey?: boolean;
    },
) {
  const { className, bold, variant, fontWeight, grey, ...rest } = props;
  return (
    <p
      {...rest}
      className={cn(
        s.p,
        bold && s.bold,
        s[`variant-${variant}`],
        s[`font-${fontWeight}`],
        className,
        grey && s.grey,
      )}
    >
      {props.children}
    </p>
  );
}
export function Small(
  props: SharedProps & HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode },
) {
  const { className, bold, ...rest } = props;
  return (
    <small {...rest} className={cn(s.small, bold && s.bold, className)}>
      {props.children}
    </small>
  );
}
