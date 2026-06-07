/// <reference types="vite/client" />

import type { KindlePressApi } from '../../shared/types'

declare global {
  interface Window {
    kindlePress: KindlePressApi
  }
}
