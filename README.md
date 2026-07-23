# RPG Tracker for SillyTavern

**Notice & Disclaimer:**
This extension was created with heavy assistance from AI. It is in an experimental stage, so feedback, bug reports, and suggestions are welcome!
You can check the changelog [here](https://github.com/Soyo5800/rpg-tracker-for-sillytavern/blob/e6b01fde6643a568cb533230759584c9d25b1e58/Changelog.md)

---

A React-based sidebar extension for SillyTavern designed to track RPG parameters (character statistics, profiles, inventories, quests, relationship metrics, and world states) without manually editing JSON files or complex system prompts.

---

## 🔍 Core Features

* **Character Management:** Track Status gauges, Integers, Text conditions, Profiles, Relations, Equipment/Inventory (Drag & Drop), and Quests.
* **World State:** Track Date, Time, Weather, Location, and dynamic World Events.
* **Timeline & Snapshot Tracking:** Automatic state rollback on message swipes or deletes. Attach customizable status snapshots (`Message Tracker`) or view turn-by-turn change logs (`Delta Log`).

---

## 🛠️ How to Use

### 1. Installation & Setup
1. Open SillyTavern Extensions menu -> **Install Extension** -> enter `https://github.com/Soyo5800/rpg-tracker-for-sillytavern`.
2. Enable **RPG Tracker** in Extension Settings.
3. Click the floating tracker button (top-left by default) to open the sidebar. *(Right-click button -> **Enable Drag** to reposition).*
4. Select your **Update Mode** in Settings (Gear Icon):
   * **Merged:** Automatically updates status during normal conversation turns.
   * **Separated (Recommended):** Injects read-only status for context. Updates are triggered manually.
   * **Isolated:** No prompt injection during normal turns. Manual updates only.
<img src="https://github.com/Soyo5800/rpg-traker-for-sillytavern/raw/af0c34e7a0817e7086740ed2a7e55f6787a305ff/trackerguide1.png" width="100%" alt="trackerguide1">

---

### 2. Sidebar Header Controls

* **`Update` Button (Play Icon):** Manually requests the LLM to analyze recent chat context and update parameters (available in Separated/Isolated modes).
* **`Turn Back` Button (Reset Arrow Icon):** Reverts manual edits and restores the original AI-generated status for the current turn.
* **`Prompt` Button (Pen Icon):** Opens system prompt, schema templates, and field guidelines editor.
* **`Settings` Button (Gear Icon):** Configure update modes, panel positions, visual themes, and snapshot backup limits.

---

### 3. Sidebar Navigation Tabs

#### 📊 Status Tab
* **`+ Add Character` / `Character List`:** Add new character sheets or reorder/manage preset templates.
* **`Sync Card` (Inside Character Editor):** Bind character sheets to active SillyTavern character cards or player personas. Save/load presets directly to/from card PNG metadata.
* **Dashboard Sub-Tabs:**
  * **Status:** Track Consumable/Stacking gauges, Integer stats, and short condition Text.
  * **Profile (Person Icon):** Store static text features (Race, Appearance, Personality).
  * **Relations (Heart Icon):** Track descriptions and numerical relationship metrics. Automatically cross-syncs values if both characters exist in the tracker.
  * **Inventory (Bag Icon - Player Only):** Manage equipped items and storage containers via Drag & Drop.
  * **Quests (Book Icon - Player Only):** Manage Main/Side quests with completion checkboxes.
* **Avatar Cropping:** Click a character avatar (except read-only personas) to crop profile pictures.
<img src="https://github.com/Soyo5800/rpg-traker-for-sillytavern/raw/af0c34e7a0817e7086740ed2a7e55f6787a305ff/trackerguide2.png" width="100%" alt="trackerguide2">
<img src="https://github.com/Soyo5800/rpg-traker-for-sillytavern/raw/af0c34e7a0817e7086740ed2a7e55f6787a305ff/trackerguide3.png" width="100%" alt="trackerguide3">

#### 🌐 World Tab
* Track **Date**, **Time**, **Weather**, and **Location** with lock toggles.
* Add and manage ongoing **World Events**.

#### ⚡ Function Tab
* **Tracker API Model:** Toggle **Use Separate Model** to run background status updates using a faster or lighter LLM model (e.g., `gemini-3.5-flash-lite`, `gpt-4o-mini`).
* **Context Limit Setting:** Set the maximum number of recent chat messages sent to the AI during manual updates or generation queries to optimize token usage.
* **Character Generator:** Enter a character name (or leave blank to auto-detect) and click **Generate NPC** or **Generate Player** to automatically create a structured sheet from chat history.
* **Active Add-ons:** Toggle specialized prompt instructions for **World Events**, **Dynamic Weather**, or **CYOA Mode** (interactive choices at response ends).

---

### 4. Message-Level Features

#### 📁 Message Tracker (Snapshots)
Click the **Message Tracker** button (ID card icon) located in the button group at the top-right of any chat message:
* Select specific World States or Character Parameters from that exact turn.
* Add optional custom notes to record milestone events.
* Directly edit or preview the raw JSON payload before attaching.
* Appends a clean, collapsible snapshot block at the bottom of the selected message text.
<img src="https://github.com/Soyo5800/rpg-traker-for-sillytavern/raw/af0c34e7a0817e7086740ed2a7e55f6787a305ff/trackerguide4.png" width="100%" alt="trackerguide4">

#### 📝 Tracker Changes (Delta Logs)
* Automatically displays a collapsible summary (`Tracker Changes`) at the bottom of AI messages.
* Shows exactly which parameters, equipment, items, or world states were updated during that specific turn.

---

## ⚠️ Warning & Compatibility

* Tested primarily on Gemini models (ranging from 2.5 to 3.5). JSON parsing stability and instruction following may vary across different LLMs.
* If you encounter bugs or have suggestions, feel free to submit feedback or open an issue!
