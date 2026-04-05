import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const root = document.getElementById('root')!;

try {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (err) {
  root.innerHTML = `<div style="color:#e8785e;padding:40px;font-family:sans-serif;">
    <h1>Failed to load</h1>
    <pre style="color:#e8e0dc;margin-top:16px;">${err}</pre>
  </div>`;
}
