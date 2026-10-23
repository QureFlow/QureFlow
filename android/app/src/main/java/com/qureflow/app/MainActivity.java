package com.qureflow.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ClinicDiscoveryPlugin.class);
        super.onCreate(savedInstanceState);
        // Only debug builds can fetch the computer's HTTP development API.
        // Release builds keep WebView mixed-content protection enabled.
        if (BuildConfig.DEBUG) {
            getBridge().getWebView().getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
    }
}
