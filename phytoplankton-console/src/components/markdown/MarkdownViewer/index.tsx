import React from 'react';
import '../shared-styles.less';
import s from './index.module.less';
import { makeAsyncComponent } from '@/utils/imports';

interface Props {
  value: string;
}

interface ViewerProps {
  initialValue: string;
  usageStatistics: boolean;
  customHTMLSanitizer: (htmlString: string) => string;
}

const Viewer = makeAsyncComponent(async () => {
  const [mod] = await Promise.all([
    import('@toast-ui/react-editor'),
    import('@toast-ui/editor/dist/toastui-editor.css'),
  ]);
  const ToastViewer = mod.Viewer;

  return {
    default: React.forwardRef<any, ViewerProps>((props, ref) => (
      <ToastViewer {...props} ref={ref} />
    )),
  };
});

export default function MarkdownViewer({ value }: Props) {
  return (
    <Viewer
      initialValue={value}
      usageStatistics={false}
      customHTMLSanitizer={customHTMLSanitizer}
    />
  );
}

function customHTMLSanitizer(htmlString: string): string {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlString;
  const anchorTags = tempDiv.querySelectorAll('a');
  anchorTags.forEach((tag) => {
    const mention = tag.href.split('/').at(-1);
    if (mention?.startsWith('auth0') && tag.innerHTML.startsWith('@')) {
      tag.classList.add(s.anchorTagStyle);
      tag.href = '#';
    }
  });
  return tempDiv.innerHTML;
}
