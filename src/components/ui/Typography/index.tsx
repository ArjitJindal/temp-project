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
      variant: 'displayXl' | 'displayLg' | 'displayReg';
      children?: React.ReactNode;
    },
) {
  return (
    <h1 {...props} className={cn(s.h1, s[`variant-${props.variant}`], props.className)}>
      {props.children}
    </h1>
  );
}
export function H2(
  props: SharedProps & HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode },
) {
  return (
    <h2 {...props} className={cn(s.h2, props.bold && s.bold, props.className)} style={props.style}>
      {props.children}
    </h2>
  );
}
export function H3(
  props: SharedProps & HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode },
) {
  return (
    <h3 {...props} className={cn(s.h3, props.bold && s.bold, props.className)} style={props.style}>
      {props.children}
    </h3>
  );
}
export function H4(
  props: SharedProps & HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode },
) {
  return (
    <h4 {...props} className={cn(s.h4, props.bold && s.bold, props.className)} style={props.style}>
      {props.children}
    </h4>
  );
}
export function H5(
  props: SharedProps & HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode },
) {
  return (
    <h5 {...props} className={cn(s.h5, props.bold && s.bold, props.className)} style={props.style}>
      {props.children}
    </h5>
  );
}
export function H6(
  props: SharedProps & HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode },
) {
  return (
    <h6 {...props} className={cn(s.h6, props.bold && s.bold, props.className)} style={props.style}>
      {props.children}
    </h6>
  );
}
export function P(
  props: SharedProps &
    HTMLAttributes<HTMLParagraphElement> & {
      variant?: 'big' | 'sml';
      children?: React.ReactNode;
    },
) {
  return (
    <p
      {...props}
      className={cn(s.p, props.bold && s.bold, s[`variant-${props.variant}`], props.className)}
      style={props.style}
    >
      {props.children}
    </p>
  );
}
export function Small(
  props: SharedProps & HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode },
) {
  return (
    <small
      {...props}
      className={cn(s.small, props.bold && s.bold, props.className)}
      style={props.style}
    >
      {props.children}
    </small>
  );
}
