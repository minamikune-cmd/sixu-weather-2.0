import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.minamikune.sixuweather',
  appName: '四序天气',
  webDir: 'dist',
  android: {
    // 所有 API 均为公开 HTTPS GET，无需明文流量。
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // 由 src/platform/splash.ts 在 React 首帧后主动淡出，避免白屏闪烁。
      launchAutoHide: false,
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
}

export default config
