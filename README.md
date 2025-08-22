---

# Image Archiver

A lightweight Chrome Extension that lets you **right-click images to save them into a local archive**, view them in a popup, and download everything as a ZIP (macOS-compatible).

## Main Hub
<img width="720" height="280" alt="image" src="https://github.com/user-attachments/assets/768e80f4-755b-43b9-b37c-1a0f2957b4b0" />

## Right Click Menu Button
<img width="1154" height="797" alt="image" src="https://github.com/user-attachments/assets/a80418ae-4c15-45de-9d73-d7990eb4a39b" />

## After Archiving Images
<img width="720" height="1026" alt="image" src="https://github.com/user-attachments/assets/bfb394fc-349d-4ede-8613-85c93939de3e" />

---

## ✨ Features

* Right-click any image and **“Add to archive”** from the context menu.
* View all archived images directly in the extension popup.
* **Open, delete, or clear** archived items.
* **Download all images as a ZIP**, with strict PNG/JPG handling and Finder-friendly archives.
* Stores everything **locally in Chrome storage** – nothing leaves your device.

---

## 🛠 Installation (Developer Mode)

Since this is not published on the Chrome Web Store (yet), you’ll need to install it manually:

1. Clone or download this repository:

   ```bash
   git clone https://github.com/jishwuh/imagearchiverextension.git
   cd imagearchiveextension
   ```
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in top-right).
4. Click **“Load unpacked”** and select the project folder.
5. The extension should now appear in your toolbar.

---

## 🚀 Usage

1. Right-click any image on a webpage → **Add to archive**.
2. Open the extension popup to see your saved images.

   * **Open**: View image in a new tab.
   * **Delete**: Remove an image.
   * **Clear Archive**: Remove all images at once.
3. Click **Download ZIP** to export all images.

   * PNG/JPG are preserved.
   * Other formats are converted to PNG for compatibility.

---

## 🧑‍💻 Development

The project is built with plain **JavaScript, HTML, and CSS** using Chrome Manifest V3.

* `background.js` → Handles context menu and storage logic.
* `popup.html` / `popup.css` / `popup.js` → UI for viewing and managing images.
* `manifest.json` → Extension configuration.

### Modifications

* Modify the source files as needed.
* Refresh the extension in `chrome://extensions/` after each change.

---

## 📦 Tech Notes

* Uses **`chrome.contextMenus`**, **`chrome.storage.local`**, and **`chrome.downloads`** APIs.
* ZIP builder is custom-coded to ensure Finder compatibility on macOS.
* Images are normalized to `.png` or `.jpg` for consistent archiving.

---

## 📜 License

MIT License. Feel free to fork, modify, and share.

---
