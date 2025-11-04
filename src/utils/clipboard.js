export const copyToClipboard = async (text) => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text)
  }

  // Fallback for older browsers
  const temp = document.createElement('textarea')
  temp.value = text
  document.body.appendChild(temp)
  temp.select()
  try {
    document.execCommand('copy')
  } finally {
    document.body.removeChild(temp)
  }
}
