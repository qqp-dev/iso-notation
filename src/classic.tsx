import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClassicApp } from './ui/ClassicApp';
import './index.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ClassicApp />
    </React.StrictMode>
  );
}
