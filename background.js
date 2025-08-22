const STORAGE_KEY = 'archiveItems';
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'addToArchive', title: 'Add to archive', contexts: ['image'] });
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'addToArchive') return;
  const url = info.srcUrl;
  if (!url) return;
  const { [STORAGE_KEY]: existing = [] } = await chrome.storage.local.get(STORAGE_KEY);
  if (!existing.find(x => x.url === url)) {
    existing.push({ url, addedAt: Date.now() });
    await chrome.storage.local.set({ [STORAGE_KEY]: existing });
  }
});
