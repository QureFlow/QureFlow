import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.qureflow.app',
  appName: 'QureFlow',
  webDir: 'dist-mobile',
  // Packaged assets stay local; only the API is on the development computer.
  server: { androidScheme: 'https' },
};

export default config;
