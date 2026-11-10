package com.minamikune.sixuweather;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

import java.util.Arrays;
import java.util.List;

/**
 * 原生侧通知渠道注册：与 JS 层 platform/notifications.ts 的 CHANNEL_DEFINITIONS 保持一致。
 * FCM 消息可能在应用从未启动的情况下到达，因此渠道必须在原生层兜底创建（幂等）。
 */
public final class NotificationChannels {

    public static final String CHANNEL_DAILY = "daily";
    public static final String CHANNEL_REMINDER = "reminder";
    public static final String CHANNEL_WARNING = "warning";

    private static final class Def {
        final String id;
        final String name;
        final String description;
        final int importance;
        final boolean vibration;

        Def(String id, String name, String description, int importance, boolean vibration) {
            this.id = id;
            this.name = name;
            this.description = description;
            this.importance = importance;
            this.vibration = vibration;
        }
    }

    private static final List<Def> DEFINITIONS = Arrays.asList(
            new Def(CHANNEL_DAILY, "每日天气", "订阅城市的每日天气摘要",
                    NotificationManager.IMPORTANCE_DEFAULT, false),
            new Def(CHANNEL_REMINDER, "天气提醒", "降雨、高温、大风等提醒",
                    NotificationManager.IMPORTANCE_DEFAULT, true),
            new Def(CHANNEL_WARNING, "天气预警", "中央气象台官方预警与强天气提醒",
                    NotificationManager.IMPORTANCE_HIGH, true)
    );

    private NotificationChannels() {
    }

    /** 幂等注册全部通知渠道。重复调用安全。 */
    public static void ensureAll(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        for (Def def : DEFINITIONS) {
            NotificationChannel channel = new NotificationChannel(def.id, def.name, def.importance);
            channel.setDescription(def.description);
            channel.enableVibration(def.vibration);
            manager.createNotificationChannel(channel);
        }
    }

    /** 校验渠道 id 属于本应用白名单，防止推送数据注入任意渠道。 */
    public static String sanitizeChannelId(String candidate) {
        for (Def def : DEFINITIONS) {
            if (def.id.equals(candidate)) return def.id;
        }
        return CHANNEL_WARNING;
    }
}
