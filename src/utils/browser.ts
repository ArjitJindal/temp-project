export async function copyTextToClipboard(text: string) {
  if (!navigator.clipboard) {
    // todo: i18n
    throw new Error(`Sorry, you browser doesn't support this operation`);
  }
  await navigator.clipboard.writeText(text);
}

export function download(filename: string, text: string) {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}
