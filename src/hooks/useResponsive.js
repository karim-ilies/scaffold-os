import { useState, useEffect } from 'react'

export function useResponsive() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)
  useEffect(() => {
    const fn = () => setWidth(window.innerWidth)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return {
    isMobile:  width < 480,
    isSmall:   width < 640,
    isTablet:  width < 1024,
    isDesktop: width >= 1024,
  }
}
