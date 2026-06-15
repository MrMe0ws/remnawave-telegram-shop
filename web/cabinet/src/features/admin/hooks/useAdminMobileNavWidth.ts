import { useEffect, useState } from 'react'

import { getAdminMobileNavWidthPx } from '../layout/adminMobileNav'

export function useAdminMobileNavWidth() {
  const [width, setWidth] = useState(getAdminMobileNavWidthPx)

  useEffect(() => {
    const onResize = () => setWidth(getAdminMobileNavWidthPx())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return width
}
