# RPG Tracker for SillyTavern

**Notice:** This extension was created with heavy assistance from AI. It is in an experimental stage, so feedback, bug reports, and suggestions are welcome!

You can check the changelog [here](https://github.com/Soyo5800/rpg-tracker-for-sillytavern/blob/Guide-Images/Changelog.md).

---

A React-based sidebar extension for SillyTavern designed to track custom parameters without manually editing JSON files or complex system prompts.

---

## 🛠️ How to Use

### Installation & Setup
1. Open SillyTavern Extensions menu -> **Install Extension** -> enter `https://github.com/Soyo5800/rpg-tracker-for-sillytavern`.
2. Enable **RPG Tracker** in Extension Settings.
3. Click the floating tracker button (top-left by default) to open the sidebar. *(Right-click button -> **Enable Drag** to reposition).*
4. Select your **Update Mode** in Settings (Gear Icon):
   * **Merged:** Automatically updates status during normal conversation turns.
   * **Separated (Recommended):** Injects read-only status for context. Updates are triggered manually.
   * **Isolated:** No prompt injection during normal turns. Manual updates only.
<img src="https://github.com/Soyo5800/rpg-traker-for-sillytavern/raw/af0c34e7a0817e7086740ed2a7e55f6787a305ff/trackerguide1.png" width="100%" alt="trackerguide1">

---

## 📋 Tracker Features

* **Floating Tracker Button:** Click to open or collapse the tracker sidebar panel. *Right-click → **Enable Drag** to reposition.*
* **Header `Update` Button:** Prompts the AI to analyze recent chat history and update tracker parameters immediately.

### 📊 Status
Customizable character sheets supporting multiple characters and group chats.

* **Core Toggles:**
  * **`Inject` Switch:** Controls prompt injection for each character. *(Enable only active characters to save tokens).*
  * **Lock Icon (`🔒`):** Keeps parameters visible to the AI while preventing values from being modified.
  * **`Player` Switch:** Unlocks the **Inventory** and **Quest** tabs for the character.
* **Character List & Presets:**
  * **`Character List`:** Add, remove, or reorder character sheets. Names must be unique for entity matching.
  * **Preset Storage:** Save and load preset configurations to the server or browser.
  * **`Field Definitions`:** Write global AI interpretation guidelines for individual fields. Toggle the **`Global`** switch to batch-apply bar colors, types, and value limits across all characters sharing that field.
* **Custom Status Fields:**
  * Supports **Consumable**, **Stacking**, **Integer**, and **Text** fields. *(Can be used as a simple text-only tracker).*
  * *Tip: To duplicate a character's layout, use **Export** on the source character and **Import** on the new one.*
* **Sub-Tabs:**
  * **Profile (Person Icon):** Narrative background descriptions (Race, Appearance, etc.).
  * **Relations (Heart Icon):** Relationship notes and numerical metrics. Automatically cross-syncs perspectives if both targets exist in the tracker.
  * **Inventory (Bag Icon):** Drag-and-drop equipment slots and storage containers (General, Currency, Asset).
  * **Quest (Book Icon):** Main and side quest tracking with completion checkboxes.
* **Visuals & Expressions:**
  * **Asset Path:** Reads images or sprite folders from `data/default-user/characters`.
  * **Visual Stage:** Click the avatar thumbnail to display a full-body standee docked opposite the panel (overlays on mobile/narrow screens).
  * **Expression Tracking:** When using a sprite folder, facial expressions update dynamically alongside status changes.
<img src="https://github.com/Soyo5800/rpg-traker-for-sillytavern/raw/af0c34e7a0817e7086740ed2a7e55f6787a305ff/trackerguide2.png" width="100%" alt="trackerguide2">
<img src="https://github.com/Soyo5800/rpg-traker-for-sillytavern/raw/af0c34e7a0817e7086740ed2a7e55f6787a305ff/trackerguide3.png" width="100%" alt="trackerguide3">

---

### 🌐 World
* **World State:** Tracks **Date**, **Time**, **Weather**, and **Location** (each lockable).
* **World Events:** Track and update ongoing situational occurrences.

---

### ⚡ Function
* **Prompt Settings:** Edit injection layouts, delta schemas, and AI instructions.
* **Tracker Settings:** Configure update modes (*Merged*, *Separated*, *Isolated*), route manual updates to a separate API model, and customize themes or docking positions.
* **Snapshot Retention & History:** Set snapshot limits. Open **Tracker History** to view, edit, or restore previous turn states. Locking a turn protects it from auto-cleanup.
* **Active Add-ons & Generator:** Toggle specialized prompts (**World Events**, **Dynamic Weather**, **CYOA Mode**) or auto-generate complete character sheets directly from chat context.

---

### 💬 Chat Message Features
* **Message Tracker:** Click the ID card icon on any chat message to attach a customizable status card. Attaching a card automatically locks that turn in history.
* **Tracker Changes (Delta Logs):** Renders a collapsible summary below AI messages showing turn-by-turn state changes.
<img src="https://github.com/Soyo5800/rpg-traker-for-sillytavern/raw/af0c34e7a0817e7086740ed2a7e55f6787a305ff/trackerguide4.png" width="100%" alt="trackerguide4">

---

## 🛠️ Building from Source

SillyTavern loads `dist/bundle.js`. If you modify any files in `src/`, rebuild the bundle:

1. `npm install` (first time only)
2. `npm run build`
3. Refresh SillyTavern (`Ctrl + F5`)

---

## ⚠️ Warning & Compatibility

* Tested primarily on Gemini models (3.5 & 3.8). JSON parsing stability and instruction-following may vary across different LLMs.
* If you encounter bugs or have suggestions, feel free to submit feedback or open an issue!
