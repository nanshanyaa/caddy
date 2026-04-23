import assert from 'node:assert/strict';

import { resolveCurrentUploadState } from '../frontend/src/stores/upload-state.js';

describe('resolveCurrentUploadState', () => {
  it('returns idle after reset even when there are previous results', () => {
    const state = resolveCurrentUploadState({
      processing: false,
      phase: 'idle',
      hasLatestResult: true,
    });

    assert.equal(state, 'idle');
  });

  it('returns success only when phase is success', () => {
    const state = resolveCurrentUploadState({
      processing: false,
      phase: 'success',
      hasLatestResult: true,
    });

    assert.equal(state, 'success');
  });

  it('keeps upload surface in uploading state while processing', () => {
    const state = resolveCurrentUploadState({
      processing: true,
      phase: 'idle',
      hasLatestResult: true,
    });

    assert.equal(state, 'uploading');
  });
});
