package com.minamikune.sixuweather;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PushTokenPlugin.class);
        super.onCreate(savedInstanceState);
        // 渠道在原生层兜底创建：FCM 消息可能在 JS 尚未运行时到达。
        NotificationChannels.ensureAll(this);
        PushTokenPlugin.stashTapPayload(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // FCM 通知点击（singleTask 复用 Activity）：暂存跳转载荷，等待 JS 消费。
        PushTokenPlugin.stashTapPayload(intent);
    }
}
