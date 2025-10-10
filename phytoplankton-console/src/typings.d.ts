declare module 'slash2';
declare module '*.css';
declare module '*.less';
declare module '*.scss';
declare module '*.sass';
declare module '*.react.svg' {
  import React from 'react';
  const _default: (
    props: React.SVGAttributes<React.ReactSVGElement> & {
      ref?: React.MutableRefObject<unknown>;
    },
  ) => JSX.Element;
  export default _default;
}
declare module '*.svg' {
  const _default: string;
  export default _default;
}
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.bmp';
declare module '*.tiff';
declare module '*.ttf';
declare module '@rjsf/antd';
declare module 'esbuild:source-file-meta' {
  declare const relativeResolveDir: string;
  declare const dirId: string;
  declare const fileId: string;
}

// preview.pro.ant.design only do not use in your production ;
// preview.pro.ant.design Dedicated environment variable, please do not use it in your project.
declare let ANT_DESIGN_PRO_ONLY_DO_NOT_USE_IN_YOUR_PRODUCTION: 'site' | undefined;

declare const REACT_APP_ENV: 'test' | 'dev' | 'pre' | false;
