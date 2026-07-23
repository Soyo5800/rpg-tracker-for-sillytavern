# Changelog - RPG Tracker for SillyTavern

All notable changes and updates to the RPG Tracker extension are documented in this file.

---

## v1.2.4 Update

### [ Dedicated Tracker API Model ]
* **Separate Model Selection**: Added an option in the Function tab to select a separate API model specifically for status updates and character generation. Applies to manual status updates in Separated / Isolated modes and background character generation.
* **Seamless API Integration**: Automatically detects and lists available models based on your current SillyTavern API and Chat Completion source.
* **No Extra Key Setup**: Uses your existing SillyTavern connection and API keys directly without requiring separate credentials.

### [ Panel Restructuring & Function Tab ]
* **Three-Tab Layout**: Reorganized the main sidebar panel into three main tabs: **Status**, **World**, and **Function**.
* **Function Tab**: Centralized background utilities, generation tools, and model settings for quick access.
* **Context Limit Setting**: Added an option to set the number of recent chat messages sent to the AI during manual status updates (default: 4).
* **Relocated Features**: Moved the Character Generator (Generate NPC / Player) and Active Add-ons (World Events, Dynamic Weather, CYOA Mode) into the Function tab.

### [ Relations UI Refinements ]
* **Collapsible Targets**: Relation targets in the sidebar Status section can now be collapsed or expanded individually.
* **Inject Filter**: Relation targets disabled for prompt injection in the Editor are now hidden from the sidebar to keep the display clean.
* **Badge Styling**: Updated the "Synced" status indicator in the sidebar to match the badge design used in the Editor.

---

## v1.2.3 Update

### [ Sync Cards & Profile Images ]
* **Card & Persona Synchronization**: Added synchronization for character cards and user personas. Click the gear icon next to the character name in the tracker panel to open the Editor and access the **Sync** button at the top.
* **Persona Sync**: Synchronizes the persona name and updates avatar images automatically when changed within SillyTavern.
* **Character Card Sync**: Stores extension presets directly inside character card PNG metadata. Save edited presets directly to the card without manual JSON import/export by clicking the **Edit Card Preset** button upon syncing.

### [ Image Cropping & Management ]
* **Avatar Cropping**: Clicking the avatar image of a synced character card allows you to crop the image display area. *(Note: Cropping high-resolution images down to thumbnail sizes may reduce sharpness; changing the base image on the character card directly is recommended for maximum quality).*
* **Unsynced Characters**: Custom image uploads remain supported for unsynced characters.

---

## v1.2.2 Update

* Fixed minor bugs and typos.

---

## v1.2.1 Update

### [ Inventory & Asset Management ]
* **Container Locking**: Added individual container locking controls to prevent AI modifications on specific storage areas.
* **New Item Types**: Introduced dedicated item types for **Currency** (wealth) and **Assets** (properties, land, real estate) to keep them separate from standard general items.

### [ Synchronization & Fixes ]
* **Relations Sync**: Fixed an issue where edits in the Relations Editor occasionally reverted; consolidated relation editing into the Editor modal for stable two-way synchronization between characters.
* **Injection Handling**: Fixed manual updates sending disabled (uninjected) statuses or duplicating live status context.
* **Prompt Optimization**: Adjusted background update prompts to prevent the AI from skipping inventory or quest changes during chat turns.

### [ Delta Log Renderer ]
* **Enhanced Log Display**: Updated the Delta Log renderer to display full text descriptions for Quests and World Events.

---

## v1.2.0 Update

* Repository: [rpg-tracker-for-sillytavern](https://github.com/Soyo5800/rpg-tracker-for-sillytavern)

### [ Choice of 3 Update Modes ]
The tracking and prompting logic is divided into three distinct modes in Settings to give users full control over token consumption:
* **Merged**: Standard auto-updating behavior on every turn.
* **Separated (Recommended)**: Injects live status as read-only reference context; updates are triggered manually via the sidebar **Update** button.
* **Isolated**: Disables all automatic prompt injection; updates are handled entirely on-demand via the **Update** button.

### [ Message Tracker (Snapshots) ]
* **Message Snapshots**: Attach snapshots of the RPG state (characters, world, or custom notes) directly to individual chat messages.
* **Access**: Click the ID card icon in the message action button group on any chat block.

### [ Usability & Performance ]
* Resolved typing input stuttering and text interruptions across UI text fields.
* Added a delete (`×`) button inside the preset dropdown for quick preset removal.
* UI states (active tabs, expanded/collapsed blocks) now persist across page refreshes and panel toggles.

---

## v1.1.0 Update

### [ Drag & Drop Inventory System ]
* Added mobile touch polyfill support for dragging and dropping items between storage containers and equipment slots.

### [ Custom Themes & Panel Positioning ]
* Added **Custom Theme Mode** in Settings to adjust panel background, text, accent, and border colors.
* Added a toggle setting to dock the sidebar panel on either the **Left** or **Right** side of the screen.

### [ Turn Back (Revert) Feature ]
* Added a **Turn Back** button on the main panel header to restore the tracker data to the original state of the current turn.

### [ Typing & Parser Improvements ]
* Optimized rendering logic to minimize typing lag in long chat sessions.
* Improved internal JSON parser to detect, repair, and recover from broken or truncated LLM outputs.
