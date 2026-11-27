import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

function lockAppViewportZoom() {
  if (typeof document === 'undefined') return
  const prevent = (e: Event) => {
    e.preventDefault()
  }

  // Prevent iOS Safari / WebKit two-finger pinch gestures (Safari ignores user-scalable=no)
  document.addEventListener('gesturestart', prevent, { passive: false })
  document.addEventListener('gesturechange', prevent, { passive: false })
  document.addEventListener('gestureend', prevent, { passive: false })

  // Prevent multi-touch pinch zooming while leaving 1-finger scrolling & swipes intact
  const preventPinch = (e: TouchEvent) => {
    if (e.touches.length > 1) {
      e.preventDefault()
    }
  }
  document.addEventListener('touchstart', preventPinch, { passive: false })
  document.addEventListener('touchmove', preventPinch, { passive: false })

  // Prevent Ctrl+wheel / trackpad pinch zoom in desktop or tablet PWAs
  document.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
      }
    },
    { passive: false },
  )
}

lockAppViewportZoom()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
