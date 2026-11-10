package com.minamikune.sixuweather;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

/**
 * FCM 注册令牌桥接：让 JS 层（platform/push.ts）能读取设备推送令牌。
 * 未配置 google-services.json 时 FirebaseApp 未初始化，isAvailable 返回 false，全部调用安全降级。
 * 同时暂存 FCM 通知点击带来的跳转载荷（subscriptionId/cityId），供 JS 启动时消费。
 */
@CapacitorPlugin(name = "PushToken")
public class PushTokenPlugin extends Plugin {

    private static JSObject pendingTapPayload = null;

    /** 由 MainActivity 在 onCreate/onNewIntent 调用；仅保留首次携带的载荷。 */
    public static synchronized void stashTapPayload(Intent intent) {
        if (intent == null || !intent.hasExtra("subscriptionId") && !intent.hasExtra("cityId")) return;
        if (pendingTapPayload != null) return;
        JSObject payload = new JSObject();
        if (intent.hasExtra("subscriptionId")) payload.put("subscriptionId", intent.getStringExtra("subscriptionId"));
        if (intent.hasExtra("cityId")) payload.put("cityId", intent.getStringExtra("cityId"));
        pendingTapPayload = payload;
    }

    /** JS 启动时消费一次 FCM 通知点击载荷（读后即清）。 */
    @PluginMethod
    public void consumeTapPayload(PluginCall call) {
        JSObject result;
        synchronized (PushTokenPlugin.class) {
            result = pendingTapPayload == null ? new JSObject() : pendingTapPayload;
            pendingTapPayload = null;
        }
        call.resolve(result);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", BuildConfig.FCM_ENABLED && !FirebaseApp.getApps(getContext()).isEmpty());
        call.resolve(result);
    }

    @PluginMethod
    public void getToken(PluginCall call) {
        if (!BuildConfig.FCM_ENABLED || FirebaseApp.getApps(getContext()).isEmpty()) {
            resolveToken(call, null);
            return;
        }
        FirebaseMessaging.getInstance().getToken()
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful() && task.getResult() != null) {
                        resolveToken(call, task.getResult());
                    } else {
                        // Firebase 实时令牌不可用时退回 onNewToken 缓存。
                        String cached = getContext()
                                .getSharedPreferences(SixuFirebaseMessagingService.PREFS_NAME, android.content.Context.MODE_PRIVATE)
                                .getString(SixuFirebaseMessagingService.PREF_TOKEN, null);
                        resolveToken(call, cached);
                    }
                });
    }

    private void resolveToken(PluginCall call, String token) {
        JSObject result = new JSObject();
        result.put("token", token);
        call.resolve(result);
    }
}
