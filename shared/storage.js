/**
 * Shared storage helpers for the extension.
 * All modules should use these instead of calling chrome.storage directly.
 */

const DEFAULTS = {
  chartinkRedirectEnabled: true,
  tvPanelEnabled: true,
  consolidated: true,
  themeOverride: null,
  clickOutsideMinimize: true
};

export async function get(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      if (result[key] === undefined) {
        resolve(DEFAULTS[key]);
      } else {
        resolve(result[key]);
      }
    });
  });
}

export async function set(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

export async function getMany(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      const out = {};
      for (const key of keys) {
        out[key] = result[key] === undefined ? DEFAULTS[key] : result[key];
      }
      resolve(out);
    });
  });
}