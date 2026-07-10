# RPG Tracker for SillyTavern

**Notice & Disclaimer:**
I am not a professional developer, so most of this extension was created with heavy assistance from AI. Because of this, there are likely many areas that need fixing, optimization, or major improvements. It is still in an experimental stage, and any feedback, suggestions, or bug reports are incredibly welcome!

---

This is a React-based extension for SillyTavern designed to simplify how you manage RPG elements (such as character statistics, inventories, world states, and dynamic prompts). 

The core value of this extension is **eliminating the need to manually modify complex JSON data or system prompts.** Instead, it provides a clean, fully interactive React-based UI to handle all setup, tracking, and editing seamlessly.

---

## 🔍 Core Features

### 1. Entity & Parameter Management
* **Characters:** Manage multiple characters including Player and NPCs.
  * **Status:** Track parameters using different data types (Consumable, Stacking, Integer, Text).
  * **Profile:** Store text-based descriptive information (e.g., appearance, background).
  * **Inventory:** Manage equipment slots and storage containers with Drag-and-Drop support.
  * **Quests:** Track main and side quests with completion toggles.
  * **Relations:** Record descriptions and numerical affection/hostility metrics between characters.
* **World State:** Track the current Date, Time, Location, Weather, and ongoing World Events.

### 2. LLM Integration & Prompt Control
* **JSON Parsing:** Instructs the LLM to output parameter changes in JSON format hidden within HTML comments. The extension parses this block and applies the changes to the UI.
* **Prompt Editor:** Allows customization of system prompts, field definitions, and schema formats sent to the LLM. 
* **Update Modes:** Choose between updating data automatically during standard chat generation (Merged mode) or via standalone API calls (Separated/Isolated modes).

### 3. Timeline Sync & Message Tracking
* **State Rollback:** Tracker data is bound to SillyTavern's message history structure (`swipe_info`). Swiping for alternative responses, deleting messages, or navigating chat history automatically reverts the tracker UI to that specific turn's state.
* **Message Tracker (Snapshots):** Attach specific character states, world states, or custom text notes to individual chat messages. Rendered as a collapsible block at the bottom of the message text.
* **Delta Logs:** Displays a collapsible summary log showing exactly which parameters were changed by the LLM in a specific turn.

### 4. Data Portability
* **Preset System:** Save your current character list, schemas, and configurations as presets to the browser's local cache.
* **Import/Export:** Export complete tracker setups as JSON files and import them into other chats or environments.

---

## 🛠️ How to Use

1. **Download and Enable the Extension:** Launch SillyTavern, go to the Extensions menu, click 'Install Extension', enter `https://github.com/Soyo5800/rpg-tracker-for-sillytavern` and install. Toggle the **RPG Tracker** checkbox in SillyTavern's extension settings.
2. **Connect to Your Chat:** 
   * Click the floating tracker button to open the sidebar panel. (Default position is top-left. You can right-click the button, select **Enable Drag**, and adjust its position.)
   * Enter your chatroom; the tracker will automatically connect. You can check the connection status via the green/red indicator dot next to the RPG Tracker header.
   * Choose your preferred update mode in Settings:
     * **Merged Mode:** Automatically injects the status schema and updates parameters in real-time during standard chat generation.
     * **Separated Mode (Recommended):** Injects your current tracker data into the prompt as read-only context so the LLM can reference it, but disables automatic updates. You must manually trigger parameter updates by clicking the **Update** button (Play icon) at the top of the sidebar.
     * **Isolated Mode:** Completely disables prompt injection during normal turns. Tracker updates are handled strictly on-demand by clicking the **Update** button (Play icon).
<img src="https://github.com/Soyo5800/rpg-traker-for-sillytavern/blob/af0c34e7a0817e7086740ed2a7e55f6787a305ff/trackerguide1.png" width="100%" alt="trackerguide1">

3. **Setup and Customize:**

   ### 🗂️ Character Management
   * **`+ Add Character` Button:** Adds a new character sheet. 
     * *Note: Character names must be unique. Duplicate names will trigger a warning and block saving to prevent conflicts in the relationship sync engine.*
   * **`Character List` Button:** Opens the preset and order manager. You can reorder characters here, or save/load/delete configurations from your browser's local cache or preset files.
   * **`Gear Icon` (Next to character names):** Opens the Character Schema Editor. Use this to add, delete, or configure custom stat gauges, integer attributes, profiles, or relationships.

   ### ⚙️ Core Switch Toggles
   * **`Inject` Switch:** Controls whether this specific character's data is injected into the AI context. Turn off characters not currently present in the scene to save tokens.
   * **`Player` Switch:** Enables the **Inventory** and **Quests** tabs for this character. We recommend enabling this only for the active player character to avoid excessive token consumption.
   * **`Lock Icon` (🔒):** Located next to individual fields. When locked, the AI cannot modify or overwrite that field's value. Lock your configurations if you want to keep them static.
   <img src="https://github.com/Soyo5800/rpg-traker-for-sillytavern/blob/af0c34e7a0817e7086740ed2a7e55f6787a305ff/trackerguide2.png" width="100%" alt="trackerguide2">

   ### 📊 Character Dashboard Tabs
   * **Status View (Default):** Displays customizable gauges (like HP or Fatigue), integers (like Level or core stats), and concise text boxes (like current temporary conditions).
   * **Profile View (Person Icon):** Intended for permanent descriptive features (e.g., Race, Height, Eye Color, Personality). We recommend putting your character card specifications here and locking them.
   * **Relations View (Heart Icon):** Tracks descriptions and numeric metrics representing relationship states. If a relationship target name matches another active character's name, their affection and impression values will automatically sync symmetrically.
   * **Inventory View (Bag Icon - Player Only):** Tracks active equipment slots and storage containers. 
     * *Editing:* Unlike other fields, Inventory must be edited through the interactive editor. Click **Open Editor** in the top-right of the tab or access it via the Gear Icon.
     * *Usage:* Fully interactive via drag-and-drop. You can create items inside storage containers and drag them onto equipment slots to equip them, or drag to reorder. (If you experience any drag-and-drop bugs on your platform, please submit feedback.)
   * **Quests View (Book Icon - Player Only):** Track your Main Quest and multiple Side Quests. Includes completion checkmarks and manual locks.
   <img src="https://github.com/Soyo5800/rpg-traker-for-sillytavern/blob/af0c34e7a0817e7086740ed2a7e55f6787a305ff/trackerguide3.png" width="100%" alt="trackerguide3">

4. **Chat Normally:** Enjoy your roleplay! The extension will run in the background. If you encounter any bugs, please leave your feedback.

---

### 📁 Message Tracker (Snapshots)
If you want to attach a tracker to a specific message during your chat (designed to append and display states like world time, location, or milestone events at the bottom of specific messages to easily keep track of your journey's progress), use this feature:

* **Message Tracker Button (ID Card Icon):** Located inside the button group (top-right) of each chat message block. Click it to open the Snapshot configuration window for that specific turn.
* **State Selection:**
  * Choose precisely which states to snapshot from that exact moment in the story.
  * Check **World State** (Date, Time, Weather, Location, Events) or specific **Character Parameters** (Status, Profile, Inventory, Quests).
  * **`Deselect All` Button:** Instantly clears all checked fields to let you start fresh.
* **`Custom Note (Optional)` Field:** Enter custom text notes to record milestone events (e.g., *"Received the rusty key from the merchant"*).
* **`Preview & JSON Editor` Toggle:** 
  * Click **`Edit JSON`** to directly inspect or manually customize the raw JSON payload.
  * Click **`Lock Data`** to validate and save your edits before attaching.
* **`Attach Tracker` Button:** Saves the configuration and appends a hidden tag to the message text. This will display as a collapsible, clean metadata block labeled **Message Tracker** at the bottom of the chat message.
<img src="https://github.com/Soyo5800/rpg-traker-for-sillytavern/blob/af0c34e7a0817e7086740ed2a7e55f6787a305ff/trackerguide4.png" width="100%" alt="trackerguide4">

---

## ⚠️ Model Testing & Compatibility Warning

Please note that this extension has only been tested on a very limited number of models (specifically verified using **gemma4-31b**). Because of this, parsing stability and JSON-following capabilities can vary significantly depending on the LLM you use.

Furthermore, **compatibility with other SillyTavern extensions has not been checked or verified.** 

If you use this extension and encounter any issues, or if you have suggestions for refactoring the code, **please leave your feedback! It would be incredibly helpful and deeply appreciated.**
