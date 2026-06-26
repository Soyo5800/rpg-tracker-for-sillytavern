# RPG Tracker for SillyTavern

**Notice & Disclaimer:**
I am not a professional developer, so most of this extension was created with heavy assistance from AI. Because of this, there are likely many areas that need fixing, optimization, or major improvements. It is still in an experimental stage, and any feedback, suggestions, or bug reports are incredibly welcome!

---

This is a React-based extension for SillyTavern designed to simplify how you manage RPG elements (such as character statistics, inventories, world states, and dynamic prompts). 

The core value of this extension is **eliminating the need to manually modify complex JSON data or system prompts.** Instead, it provides a clean, fully interactive React-based UI to handle all setup, tracking, and editing seamlessly.

---

## 🔍 Core Features

### 1. No More JSON Hacking (Visual UI Editors)
* **Interactive Status Bars & Forms:** Effortlessly adjust character profiles, stats sliders, equipment slots, inventories, and quests using a polished graphical UI.
* **Easy Schema & Prompt Tuning:** Customize the prompt structures, system instruction templates, and world parameters (Date, Time, Location, Weather) directly from intuitive input fields—no manual JSON formatting or prompt syntax tweaking required.

### 2. Timeline-Aware State Sync
* **Automatic Timeline Synced Saves:** Every edit you make in the UI or any automatic update from the LLM is captured and stored directly inside the SillyTavern chat timeline database.
* **Seamless Swipes & Rollbacks:** If you swipe for a new AI response, delete a message (Undo), or switch chats, the tracker's visual UI state instantly rolls back to match that exact moment in the story.

---

## 🛠️ How to Use

1. **Enable the Extension:** Toggle the **RPG Tracker** checkbox in SillyTavern's extension list.
2. **Connect to Your Chat:** 
   * Enter the chatroom where you want to apply the tracker.
   * Click the tracker toggle button. *(Default position is top-left. You can right-click the button to drag and adjust its position.)*
   * Go to the **Settings** tab in the panel and click **Connect**.
   * Choose your preferred update mode:
     * **Merged Mode:** Automatically handles updates during normal chat generation.
     * **Separated Mode:** Separates the logic. You can manually trigger a standalone API call by clicking the **Update Profile** button at the very top of the sidebar.
3. **Setup and Customize:** 
   * Create your desired characters and adjust stats using the interactive UI fields.
   * Click the **Pen Icon** to edit your prompt templates.
   * *(Optional AI Generation)* In the prompt editor under the **Add-ons** tab, you can generate characters via API. **Note that AI generation is never perfect.** We highly recommend manually fixing the results or building your character from scratch.
4. **Chat Normally:** Enjoy your roleplay! The extension will run in the background. If you encounter any bugs, please leave your feedback.
<img width="1680" height="1360" alt="rtfs" src="https://github.com/user-attachments/assets/0fc7c5a8-6eb2-4b44-9f0f-93e589e558d8" />

---

## ⚠️ Model Testing & Compatibility Warning

Please note that this extension has only been tested on a very limited number of models (specifically verified using **gemma4-31b**). Because of this, parsing stability and JSON-following capabilities can vary significantly depending on the LLM you use.

Furthermore, **compatibility with other SillyTavern extensions has not been checked or verified.** 

If you use this extension and encounter any issues, or if you have suggestions for refactoring the code, **please leave your feedback! It would be incredibly helpful and deeply appreciated.**
