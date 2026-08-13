import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.jonadan514.myplanner',
  appName: 'My Planner',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
