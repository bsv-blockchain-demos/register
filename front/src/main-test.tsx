import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function TestApp() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>QuarkID Test App</h1>
      <p>If you see this, React is working!</p>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TestApp />
  </StrictMode>,
);