export function isThai(text: string): boolean {
  // Check if text contains Thai characters
  return /[\u0E00-\u0E7F]/.test(text)
}
