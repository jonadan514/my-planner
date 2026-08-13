package com.jonadan514.myplanner;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.CapConfig;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(HealthConnectBridgePlugin.class);
        registerPlugin(LiveAppBridgePlugin.class);
        boolean liveMode = getSharedPreferences(
            LiveAppBridgePlugin.PREFERENCES_NAME,
            MODE_PRIVATE
        ).getBoolean(LiveAppBridgePlugin.LIVE_MODE_KEY, false);
        if (liveMode) {
            config = new CapConfig.Builder(this)
                .setServerUrl(LiveAppBridgePlugin.LIVE_APP_URL)
                .setErrorPath("offline.html")
                .create();
        }
        super.onCreate(savedInstanceState);
    }
}
