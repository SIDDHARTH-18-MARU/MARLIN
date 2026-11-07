import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// StrictMode is intentionally omitted: it double-invokes effects in dev,
// which mounts/unmounts the Cesium WebGL viewer twice and can leave the
// globe in a broken state. Every effect below still cleans up after itself.
createRoot(document.getElementById('root')!).render(<App />);
