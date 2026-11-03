package com.odyssey.game;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebViewAssetLoader;
import java.util.Locale;

/**
 * ODYSSEY — the whole game is the web app in src/main/assets/.
 * It is served to the WebView through WebViewAssetLoader under
 * https://appassets.androidplatform.net/assets/ so ES modules,
 * localStorage, audio files, and fonts all behave exactly as on a real origin.
 * No network is used at any point (no INTERNET permission).
 */
public class MainActivity extends AppCompatActivity implements TextToSpeech.OnInitListener {

    private static final String START_URL =
            "https://appassets.androidplatform.net/assets/index.html";

    private WebView web;
    private TextToSpeech tts;
    private boolean ttsReady = false;

    public class AndroidTTSBridge {
        @JavascriptInterface
        public void speak(String text, float pitch, float rate) {
            if (!ttsReady || tts == null) return;
            runOnUiThread(() -> {
                try {
                    tts.setPitch(pitch);
                    tts.setSpeechRate(rate);
                    tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "odyssey_line");
                } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public void stop() {
            if (ttsReady && tts != null) {
                runOnUiThread(() -> {
                    try {
                        tts.stop();
                    } catch (Exception ignored) {}
                });
            }
        }
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS && tts != null) {
            tts.setLanguage(Locale.US);
            ttsReady = true;
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            tts = new TextToSpeech(this, this);
        } catch (Exception ignored) {}

        web = new WebView(this);
        setContentView(web);

        // fullscreen, immersive — hide status and nav bars
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);   // localStorage = saves
        web.getSettings().setDatabaseEnabled(true);
        web.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
        web.getSettings().setMediaPlaybackRequiresUserGesture(false);
        web.getSettings().setTextZoom(100);             // ignore system font scale
        web.setBackgroundColor(0xFF1A1008);             // --terra-black

        web.addJavascriptInterface(new AndroidTTSBridge(), "AndroidTTS");

        web.setWebViewClient(new android.webkit.WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, android.webkit.WebResourceRequest req) {
                // keep every navigation inside the asset origin
                return !req.getUrl().getHost().equals("appassets.androidplatform.net");
            }

            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(WebView v, android.webkit.WebResourceRequest req) {
                return loader.shouldInterceptRequest(req.getUrl());
            }
        });

        // back = advance dialogue (same as tapping), double-back exits
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            private long lastBack = 0;

            @Override
            public void handleOnBackPressed() {
                long now = System.currentTimeMillis();
                if (now - lastBack < 900) {
                    finish(); // second press within 0.9s quits
                } else {
                    lastBack = now;
                    web.evaluateJavascript(
                            "(window.odysseyBackPress ? window.odysseyBackPress() : false)",
                            null);
                }
            }
        });

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl(START_URL);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (tts != null) {
            try { tts.stop(); } catch (Exception ignored) {}
        }
        web.onPause();
        web.pauseTimers(); // full pause: stop rAF + audio while backgrounded
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.resumeTimers();
        web.onResume();
        // re-enter immersive mode after any system UI appearance
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    protected void onDestroy() {
        if (tts != null) {
            try {
                tts.stop();
                tts.shutdown();
            } catch (Exception ignored) {}
            tts = null;
        }
        if (web != null) {
            web.loadUrl("about:blank");
            web.destroy();
        }
        super.onDestroy();
    }
}
