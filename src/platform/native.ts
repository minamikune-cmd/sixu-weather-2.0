// 平台判断的唯一来源，避免模块间循环引用。
import { Capacitor } from '@capacitor/core'

export const isNative = Capacitor.isNativePlatform()
export const isAndroid = Capacitor.getPlatform() === 'android'
export const isWeb = !isNative
export type PlatformName = 'web' | 'android' | 'ios'
export const platformName = Capacitor.getPlatform() as PlatformName
