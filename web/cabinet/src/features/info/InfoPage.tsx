import { Navigate } from 'react-router-dom'

/** Старый маршрут /info — редирект на поддержку с якорем к блоку инструкций и документов. */
export default function InfoPage() {
  return <Navigate to="/support#cabinet-info" replace />
}
