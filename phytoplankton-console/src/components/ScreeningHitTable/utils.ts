export function sanitizeFuzziness(fuzziness: number | undefined, range: 'hundred' | 'one') {
  if (range === 'hundred' && fuzziness != null) {
    if (fuzziness <= 1) {
      return fuzziness * 100;
    }
    return fuzziness;
  }
  if (range === 'one' && fuzziness != null) {
    if (fuzziness >= 1) {
      return fuzziness / 100;
    }
    return fuzziness;
  }
  return fuzziness;
}
