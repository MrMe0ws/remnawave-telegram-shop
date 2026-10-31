import { createLucideIcon } from 'lucide-react'

/*
 * Иконка раздела «Колесо фортуны»: обод, 6 спиц, стрелка сверху и
 * через сектор полупрозрачная заливка тем же цветом. Рисуется как
 * обычная иконка lucide — цвет, размер и толщина линии берутся снаружи.
 */
export const FortuneWheelIcon = createLucideIcon('FortuneWheel', [
  ['path', { d: 'M20 13A8 8 0 0 1 16 19.93L13 14.73A2 2 0 0 0 14 13Z', fill: 'currentColor', fillOpacity: '0.28', stroke: 'none', key: 's1' }],
  ['path', { d: 'M8 19.93A8 8 0 0 1 4 13L10 13A2 2 0 0 0 11 14.73Z', fill: 'currentColor', fillOpacity: '0.28', stroke: 'none', key: 's2' }],
  ['path', { d: 'M8 6.07A8 8 0 0 1 16 6.07L13 11.27A2 2 0 0 0 11 11.27Z', fill: 'currentColor', fillOpacity: '0.28', stroke: 'none', key: 's3' }],
  ['circle', { cx: '12', cy: '13', r: '8', key: 'rim' }],
  ['circle', { cx: '12', cy: '13', r: '2', key: 'hub' }],
  ['path', { d: 'M14 13h6M13 14.73l3 5.2M11 14.73l-3 5.2M10 13H4M11 11.27l-3-5.2M13 11.27l3-5.2', key: 'spokes' }],
  ['path', { d: 'M9.5 2.5h5L12 6.5z', fill: 'currentColor', key: 'pointer' }],
])
