package com.minamikune.sixuweather;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * FCM 下行消息接收服务（真实推送服务通道）。
 * 后端经 FCM HTTP v1 API 下发，服务器密钥只存在于后端，绝不打包进应用。
 * 通知点击后携带 subscriptionId/cityId 回到 MainActivity，由 JS 层完成页面跳转。
 */
public class SixuFirebaseMessagingService extends FirebaseMessagingService {

    static final String PREFS_NAME = "sixu.push";
    static final String PREF_TOKEN = "fcmToken";

    @Override
    public void onNewToken(String token) {
        // 缓存最新令牌；PushTokenPlugin 读取时优先返回 Firebase 实时令牌，此处仅作兜底。
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(PREF_TOKEN, token).apply();
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        NotificationChannels.ensureAll(this);

        String title = message.getNotification() != null && message.getNotification().getTitle() != null
                ? message.getNotification().getTitle()
                : "四序天气";
        String body = message.getNotification() != null && message.getNotification().getBody() != null
                ? message.getNotification().getBody()
                : "";

        // data 载荷允许后端指定渠道与跳转目标；渠道经白名单校验。
        String channelId = NotificationChannels.sanitizeChannelId(message.getData().get("channelId"));
        String subscriptionId = message.getData().get("subscriptionId");
        String cityId = message.getData().get("cityId");

        Intent launch = new Intent(this, MainActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (subscriptionId != null) launch.putExtra("subscriptionId", subscriptionId);
        if (cityId != null) launch.putExtra("cityId", cityId);
        PendingIntent contentIntent = PendingIntent.getActivity(
                this,
                0,
                launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        int notificationId = (int) (System.currentTimeMillis() % Integer.MAX_VALUE);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setContentIntent(contentIntent)
                .setAutoCancel(true);

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.notify(notificationId, builder.build());
        }
    }
}
