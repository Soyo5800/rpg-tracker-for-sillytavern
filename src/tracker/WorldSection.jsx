import React, { useRef, useState, useEffect } from 'react';
import { useRPG } from '../core/RPGControl';
import styles from './WorldSection.module.css';

function AutoGrowingTextArea({ value, onChange, placeholder, className, disabled }) {
  const textareaRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      if (!isFocused) {
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      }
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value, isFocused]);

  return (
    <textarea
      ref={textareaRef}
      className={className || styles.eventDescTextarea}
      style={{ resize: isFocused && !disabled ? 'vertical' : 'none' }}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => {
        if (disabled) return;
        setIsFocused(true);
        const el = textareaRef.current;
        if (el) {
          el.style.height = 'auto';
          el.style.height = `${el.scrollHeight}px`;
        }
      }}
      onBlur={() => setIsFocused(false)}
      placeholder={placeholder}
      rows={1}
      disabled={disabled}
    />
  );
}

export default function WorldSection() {
  const { trackerData, updateTrackerData, patchWorldField } = useRPG();
  
  const worldState = trackerData.worldState || { date: '', time: '', location: '', weather: '', events: [] };
  const worldStateLocks = trackerData.worldStateLocks || { date: false, time: false, location: false, weather: false };
  const events = Array.isArray(worldState.events) ? worldState.events : [];

  const guidePrompts = trackerData.guidePrompts || [];
  const isEnabled = (id) => {
    const guide = guidePrompts.find(g => g.id === id);
    return guide ? guide.enabled : true;
  };

  const safeStr = (val) => {
    if (val === undefined || val === null) return '';
    if (typeof val === 'object') {
      if (val.name) return String(val.name);
      if (val.desc) return String(val.desc);
      if (val.status) return String(val.status);
      return '';
    }
    const str = String(val);
    if (str === '[object Object]') return '';
    return str;
  };

  const handleUpdate = (updates) => {
    if (updateTrackerData) {
      updateTrackerData({
        ...trackerData,
        worldState: { ...worldState, ...updates }
      });
    }
  };

  const handleToggleLock = (key) => {
    if (updateTrackerData) {
      updateTrackerData({
        ...trackerData,
        worldStateLocks: {
          ...worldStateLocks,
          [key]: !worldStateLocks[key]
        }
      });
    }
  };

  const handleAddEvent = () => {
    const newEvent = { id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: '', desc: '' };
    handleUpdate({ events: [...events, newEvent] });
  };

  const handleEventChange = (index, key, value) => {
    const newEvents = [...events];
    if (typeof newEvents[index] === 'string') {
      newEvents[index] = { id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: '', desc: newEvents[index] };
    }

    const updatedEvt = { ...newEvents[index], [key]: value };

    newEvents[index] = updatedEvt;
    handleUpdate({ events: newEvents });
  };

  const handleDeleteEvent = (index) => {
    const newEvents = events.filter((_, i) => i !== index);
    handleUpdate({ events: newEvents });
  };

  return (
    <div className={styles.container}>

      {/* World State Section */}
      <div>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>World State</span>
        </div>

        <div className={styles.stateGrid}>
          {isEnabled('world_date') && (
            <div className={styles.rowField}>
              <button
                type="button"
                className={styles.lockBtn}
                onClick={() => handleToggleLock('date')}
                title={worldStateLocks.date ? 'Unlock Date' : 'Lock Date'}
              >
                <i className={`fa-solid ${worldStateLocks.date ? 'fa-lock' : 'fa-lock-open'}`} />
              </button>
              <span className={styles.fieldLabel}>Date</span>
              <AutoGrowingTextArea
                value={safeStr(worldState.date)}
                onChange={(val) => patchWorldField(['date'], val)}
                className={styles.stateTextarea}
                disabled={worldStateLocks.date}
                placeholder=""
              />
            </div>
          )}

          {isEnabled('world_time') && (
            <div className={styles.rowField}>
              <button
                type="button"
                className={styles.lockBtn}
                onClick={() => handleToggleLock('time')}
                title={worldStateLocks.time ? 'Unlock Time' : 'Lock Time'}
              >
                <i className={`fa-solid ${worldStateLocks.time ? 'fa-lock' : 'fa-lock-open'}`} />
              </button>
              <span className={styles.fieldLabel}>Time</span>
              <AutoGrowingTextArea
                value={safeStr(worldState.time)}
                onChange={(val) => patchWorldField(['time'], val)}
                className={styles.stateTextarea}
                disabled={worldStateLocks.time}
                placeholder=""
              />
            </div>
          )}

          {isEnabled('world_weather') && (
            <div className={styles.rowField}>
              <button
                type="button"
                className={styles.lockBtn}
                onClick={() => handleToggleLock('weather')}
                title={worldStateLocks.weather ? 'Unlock Weather' : 'Lock Weather'}
              >
                <i className={`fa-solid ${worldStateLocks.weather ? 'fa-lock' : 'fa-lock-open'}`} />
              </button>
              <span className={styles.fieldLabel}>Weather</span>
              <AutoGrowingTextArea
                value={safeStr(worldState.weather)}
                onChange={(val) => patchWorldField(['weather'], val)}
                className={styles.stateTextarea}
                disabled={worldStateLocks.weather}
                placeholder=""
              />
            </div>
          )}

          {isEnabled('world_location') && (
            <div className={styles.rowField}>
              <button
                type="button"
                className={styles.lockBtn}
                onClick={() => handleToggleLock('location')}
                title={worldStateLocks.location ? 'Unlock Location' : 'Lock Location'}
              >
                <i className={`fa-solid ${worldStateLocks.location ? 'fa-lock' : 'fa-lock-open'}`} />
              </button>
              <span className={styles.fieldLabel}>Location</span>
              <AutoGrowingTextArea
                value={safeStr(worldState.location)}
                onChange={(val) => patchWorldField(['location'], val)}
                className={styles.stateTextarea}
                disabled={worldStateLocks.location}
                placeholder=""
              />
            </div>
          )}
        </div>
      </div>

      {/* World Events Section */}
      {isEnabled('world_events') && (
        <div className={styles.eventsSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.eventsSectionTitle}>World Events</span>
            <button type="button" className={styles.addBtn} onClick={handleAddEvent}>
              + Add Event
            </button>
          </div>

          <div className={styles.eventsList}>
            {events.length === 0 ? (
              <p className={styles.emptyPlaceholder}>No recorded events.</p>
            ) : (
              events.map((evt, idx) => {
                const evtObj = typeof evt === 'string' ? { name: '', desc: evt } : evt;

                return (
                  <div key={evtObj.id || idx} className={styles.eventBlock}>
                    <div className={styles.eventHeaderRow}>
                      <span className={styles.eventNumber}>Event {idx + 1}</span>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => handleDeleteEvent(idx)}
                        title="Remove Event"
                      >
                        ×
                      </button>
                    </div>

                    <input
                      type="text"
                      className={styles.eventTitleInput}
                      value={evtObj.name || ''}
                      onChange={(e) => handleEventChange(idx, 'name', e.target.value)}
                      placeholder="Event Title..."
                    />

                    <AutoGrowingTextArea
                      value={evtObj.desc || ''}
                      onChange={(text) => handleEventChange(idx, 'desc', text)}
                      placeholder="Describe event..."
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

    </div>
  );
}