export function resolveCurrentUploadState({
  processing = false,
  phase = 'idle',
  hasLatestResult = false,
} = {}) {
  if (processing) return 'uploading';
  if (phase === 'success' && hasLatestResult) return 'success';
  if (phase === 'error' && !hasLatestResult) return 'error';
  return 'idle';
}
