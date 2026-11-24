import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '../styles/index.css'
import '../styles/onboarding.css'
import '../styles/ui-bug-fixes.css'
import '../styles/design-system/index.css'
import '../styles/trajectory-app-theme.css'
import '../styles/trajectory-workspace-redesign.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
