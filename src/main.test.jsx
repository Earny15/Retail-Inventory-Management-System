import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

function App() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>🎉 AluminiumPro Test</h1>
      <p>If you can see this, the basic React setup is working!</p>
      <div style={{ background: '#f0f0f0', padding: '10px', margin: '10px 0' }}>
        <h2>Status: Ready</h2>
        <p>✅ React is loaded</p>
        <p>✅ CSS is working</p>
        <p>✅ Development server is running</p>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)