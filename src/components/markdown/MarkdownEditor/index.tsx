import '@toast-ui/editor/dist/toastui-editor.css';
import '../shared-styles.less';
import { Editor } from '@toast-ui/react-editor';
import React from 'react';
import { ToolbarItemOptions } from '@toast-ui/editor/types/ui';
import s from './styles.module.less';

interface Props {
  initialValue: string;
  onAttachFiles?: () => void;
  onChange: (value: string) => void;
}

export default class MarkdownEditor extends React.Component<Props> {
  editorRef = React.createRef<Editor>();

  private toolbarItems: (string | ToolbarItemOptions)[][] = [];

  reset() {
    this.editorRef.current?.getInstance()?.reset();
  }

  constructor(props: Props) {
    super(props);
    this.toolbarItems = [
      // [
      //   ...[1, 2, 3, 0].map((level) => ({
      //     name: `h${level}`,
      //     el: createToolButton(
      //       `<span class=${s.header}>${level !== 0 ? `H${level}` : `P`}</span>`,
      //       () => {
      //         this.editorRef.current?.getInstance()?.exec('heading', { level });
      //       },
      //     ),
      //     command: `h${level}`,
      //     tooltip: level === 0 ? `Paragraph` : `Header ${level}`,
      //   })),
      // ],
      ['bold', 'italic', 'strike'],
      ['ul', 'ol'],
      ['code', 'codeblock'],
      this.props.onAttachFiles != null
        ? [
            {
              name: 'attach_file',
              el: createToolButton(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="${s.attach}">
                        <g>
                          <path fill="currentColor" d="M14 13.5V8a4 4 0 1 0-8 0v5.5a6.5 6.5 0 1 0 13 0V4h2v9.5a8.5 8.5 0 1 1-17 0V8a6 6 0 1 1 12 0v5.5a3.5 3.5 0 0 1-7 0V8h2v5.5a1.5 1.5 0 0 0 3 0z"/>
                        </g>
                       </svg>`,
                this.props.onAttachFiles,
              ),
              command: `attach`,
              tooltip: 'Attach file',
            },
          ]
        : [],
      // 'heading', 'hr', 'quote', 'task', 'indent', 'outdent', 'table', 'image', 'link'
    ];
  }

  componentDidMount() {
    if (this.editorRef.current) {
      this.editorRef.current?.getRootElement().classList.add(s.root);
    }
  }

  render() {
    return (
      <Editor
        height={'200px'}
        hideModeSwitch={true}
        previewStyle="vertical"
        initialEditType="wysiwyg"
        initialValue={this.props.initialValue}
        ref={this.editorRef}
        toolbarItems={this.toolbarItems}
        onChange={() => {
          const editor = this.editorRef.current?.getInstance();
          if (editor) {
            this.props.onChange(editor.getMarkdown());
          }
        }}
        usageStatistics={false}
        placeholder="Write a narrative explaning the case closure reason and findings If any"
      />
    );
  }
}

function createToolButton(content: string, cb: () => void) {
  const button = document.createElement('button');
  button.className = `toastui-editor-toolbar-icons ${s.toolButton}`;
  button.style.backgroundImage = 'none';
  button.style.margin = '0';
  button.innerHTML = content;
  button.addEventListener('click', cb);
  return button;
}
