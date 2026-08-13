package com.jonadan514.myplanner;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(HealthConnectBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
