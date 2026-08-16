import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './ModalGlobal.css';
import './CommonGlobal.css';

// --- 모바일 터치 드래그 앤 드롭 지원 폴리필 ---
import { polyfill } from "mobile-drag-drop";
import "mobile-drag-drop/default.css"; // (선택) 드래그 시 반투명 이미지 효과

// 폴리필 활성화 (터치 환경에서만 자동으로 작동)
polyfill({
  dragImageCenterOnTouch: true // 터치한 손가락 중앙에 아이템이 따라다니도록 설정
});

const rootElement = document.getElementById('my-rpg-react-root');

if (rootElement) {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("[RPG Tracker] React rendering error:", error);
  }
}
