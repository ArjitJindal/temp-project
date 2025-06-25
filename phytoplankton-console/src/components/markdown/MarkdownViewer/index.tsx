import '@toast-ui/editor/dist/toastui-editor.css';
import { Viewer } from '@toast-ui/react-editor';
import React from 'react';
import '../shared-styles.less';
import s from './index.module.less';

interface Props {
  value: string;
}

export default class MarkdownViewer extends React.Component<Props> {
  editorRef = React.createRef<Viewer>();

  render() {
    return (
      <Viewer
        initialValue={this.props.value}
        ref={this.editorRef}
        usageStatistics={false}
        customHTMLSanitizer={customHTMLSanitizer}
      />
    );
  }
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
