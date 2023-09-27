export function ensureHttps(url: string): string {
  // Check if the URL already starts with "http://" or "https://"
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // If it doesn't start with either, add "https://"
    url = 'https://' + url
  } else if (url.startsWith('http://')) {
    // If it starts with "http://", replace it with "https://"
    url = 'https://' + url.slice(7) // Slice removes "http://"
  }

  return url
}
