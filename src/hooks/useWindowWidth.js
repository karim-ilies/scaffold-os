import { useState, useEffect } from 'react'

export function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth)
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  const isMobile  = width < 768
  const isTablet  = width >= 768 && width < 1024
  const isDesktop = width >= 1024
  return { width, isMobile, isTablet, isDesktop }
}
