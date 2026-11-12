package com.odyssey.game;

import android.annotation.SuppressLint;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebViewAssetLoader;
import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * ODYSSEY — serves web app from assets/ with Over-The-Air (OTA) live update
 * override folder (files/odyssey_ota/) under https://appassets.androidplatform.net/assets/.
 * When an update is pushed to version.json, the app notifies on the home screen,
 * blocks play until updated, downloads updated files into odyssey_ota/, and reloads.
 */
public class MainActivity extends AppCompatActivity implements TextToSpeech.OnInitListener {

    private static final String START_URL =
            "https://appassets.androidplatform.net/assets/index.html";
    private static final String PREFS_NAME = "odyssey_ota";

    private WebView web;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private SharedPreferences prefs;
    private File otaDir;
    private File otaTmpDir;
    private final ExecutorService bgPool = Executors.newSingleThreadExecutor();

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

    public class AndroidUpdater {
        @JavascriptInterface
        public String getState() {
            try {
                JSONObject o = new JSONObject();
                o.put("bundledBuild", BuildConfig.BUNDLED_BUILD);
                o.put("bundledVersion", BuildConfig.BUNDLED_VERSION);
                o.put("installedBuild", prefs.getInt("installed_build", BuildConfig.BUNDLED_BUILD));
                o.put("installedVersion", prefs.getString("installed_version", BuildConfig.BUNDLED_VERSION));
                o.put("installedHash", prefs.getString("installed_hash", ""));
                o.put("pendingBuild", prefs.getInt("pending_build", 0));
                o.put("pendingVersion", prefs.getString("pending_version", ""));
                o.put("pendingNotes", prefs.getString("pending_notes", ""));
                o.put("pendingHash", prefs.getString("pending_hash", ""));
                o.put("manifestUrl", BuildConfig.DEFAULT_MANIFEST_URL);
                return o.toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        @JavascriptInterface
        public void checkUpdate(final String customUrl) {
            final String urlStr = (customUrl != null && !customUrl.isEmpty())
                    ? customUrl : BuildConfig.DEFAULT_MANIFEST_URL;
            bgPool.execute(() -> {
                try {
                    String raw = fetchText(cacheBust(urlStr));
                    JSONObject remote = new JSONObject(raw);
                    int rBuild = remote.optInt("build", 0);
                    String rVer = remote.optString("version", "");
                    String rNotes = remote.optString("notes", "");
                    String rHash = remote.optString("hash", "");

                    int curBuild = prefs.getInt("installed_build", BuildConfig.BUNDLED_BUILD);
                    String curHash = prefs.getString("installed_hash", "");
                    boolean needsUpdate = rBuild > curBuild
                            || (!rHash.isEmpty() && !curHash.isEmpty() && !rHash.equals(curHash));

                    JSONObject ev = new JSONObject();
                    ev.put("type", "status");
                    ev.put("installedBuild", curBuild);
                    ev.put("installedVersion", prefs.getString("installed_version", BuildConfig.BUNDLED_VERSION));
                    ev.put("installedHash", curHash);

                    if (needsUpdate) {
                        prefs.edit()
                                .putInt("pending_build", rBuild)
                                .putString("pending_version", rVer)
                                .putString("pending_notes", rNotes)
                                .putString("pending_hash", rHash)
                                .apply();
                        ev.put("status", "update_available");
                        ev.put("remoteBuild", rBuild);
                        ev.put("remoteVersion", rVer);
                        ev.put("notes", rNotes);
                        ev.put("hash", rHash);
                    } else {
                        prefs.edit()
                                .remove("pending_build")
                                .remove("pending_version")
                                .remove("pending_notes")
                                .remove("pending_hash")
                                .apply();
                        ev.put("status", "up_to_date");
                    }
                    emitUpdaterEvent(ev);
                } catch (Exception e) {
                    try {
                        JSONObject ev = new JSONObject();
                        ev.put("type", "status");
                        int curBuild = prefs.getInt("installed_build", BuildConfig.BUNDLED_BUILD);
                        int pendingBuild = prefs.getInt("pending_build", 0);
                        String curHash = prefs.getString("installed_hash", "");
                        String pendHash = prefs.getString("pending_hash", "");
                        boolean stillPending = pendingBuild > curBuild
                                || (!pendHash.isEmpty() && !curHash.isEmpty() && !pendHash.equals(curHash));
                        ev.put("status", stillPending ? "update_available" : "offline");
                        if (stillPending) {
                            ev.put("remoteBuild", pendingBuild);
                            ev.put("remoteVersion", prefs.getString("pending_version", ""));
                            ev.put("notes", prefs.getString("pending_notes", ""));
                            ev.put("hash", pendHash);
                        }
                        emitUpdaterEvent(ev);
                    } catch (Exception ignored) {}
                }
            });
        }

        @JavascriptInterface
        public void startUpdate(final String customUrl) {
            final String urlStr = (customUrl != null && !customUrl.isEmpty())
                    ? customUrl : BuildConfig.DEFAULT_MANIFEST_URL;
            bgPool.execute(() -> {
                ExecutorService dlPool = Executors.newFixedThreadPool(6);
                try {
                    String raw = fetchText(cacheBust(urlStr));
                    JSONObject remote = new JSONObject(raw);
                    final int rBuild = remote.optInt("build", prefs.getInt("installed_build", BuildConfig.BUNDLED_BUILD) + 1);
                    final String rVer = remote.optString("version", BuildConfig.BUNDLED_VERSION);
                    final String rHash = remote.optString("hash", "");
                    String baseUrl = remote.optString("baseUrl", "https://raw.githubusercontent.com/SwarupRock/ODYSSEY/main/");
                    if (!baseUrl.endsWith("/")) baseUrl = baseUrl + "/";

                    JSONArray arr = remote.optJSONArray("files");
                    if (arr == null || arr.length() == 0) {
                        throw new IllegalStateException("Update manifest contains no files");
                    }

                    deleteRecursive(otaTmpDir);
                    if (!otaTmpDir.mkdirs() && !otaTmpDir.isDirectory()) {
                        throw new IllegalStateException("Cannot create staging directory");
                    }

                    final int total = arr.length();
                    final AtomicInteger done = new AtomicInteger(0);
                    final String fBase = baseUrl;
                    List<Callable<Void>> tasks = new ArrayList<>(total);

                    for (int i = 0; i < total; i++) {
                        final String rel = sanitizeRelPath(arr.getString(i));
                        if (rel == null) continue;
                        tasks.add(() -> {
                            String dlUrl = cacheBust(fBase + rel);
                            byte[] data = fetchBytes(dlUrl);
                            File out = new File(otaTmpDir, rel);
                            File parent = out.getParentFile();
                            if (parent != null && !parent.exists()) parent.mkdirs();
                            try (FileOutputStream fos = new FileOutputStream(out)) {
                                fos.write(data);
                            }
                            int d = done.incrementAndGet();
                            if (d == total || d % 4 == 0 || d == 1) {
                                JSONObject prog = new JSONObject();
                                prog.put("type", "progress");
                                prog.put("done", d);
                                prog.put("total", total);
                                prog.put("file", rel);
                                emitUpdaterEvent(prog);
                            }
                            return null;
                        });
                    }

                    List<Future<Void>> futures = dlPool.invokeAll(tasks);
                    for (Future<Void> f : futures) {
                        f.get(); // throw if any single file failed
                    }

                    // Also store remote manifest locally inside otaTmpDir
                    try (FileOutputStream fos = new FileOutputStream(new File(otaTmpDir, "version.json"))) {
                        fos.write(raw.getBytes(StandardCharsets.UTF_8));
                    }

                    // Atomically swap staging -> live OTA dir
                    File oldDir = new File(getFilesDir(), "odyssey_ota_old");
                    deleteRecursive(oldDir);
                    if (otaDir.exists() && !otaDir.renameTo(oldDir)) {
                        deleteRecursive(otaDir);
                    }
                    if (!otaTmpDir.renameTo(otaDir)) {
                        throw new IllegalStateException("Failed to activate update");
                    }
                    deleteRecursive(oldDir);

                    prefs.edit()
                            .putInt("installed_build", rBuild)
                            .putString("installed_version", rVer)
                            .putString("installed_hash", rHash)
                            .remove("pending_build")
                            .remove("pending_version")
                            .remove("pending_notes")
                            .remove("pending_hash")
                            .apply();

                    JSONObject ok = new JSONObject();
                    ok.put("type", "complete");
                    ok.put("build", rBuild);
                    ok.put("version", rVer);
                    ok.put("hash", rHash);
                    emitUpdaterEvent(ok);
                } catch (Exception e) {
                    deleteRecursive(otaTmpDir);
                    try {
                        JSONObject err = new JSONObject();
                        err.put("type", "error");
                        err.put("message", e.getMessage() != null ? e.getMessage() : "Update download failed");
                        emitUpdaterEvent(err);
                    } catch (Exception ignored) {}
                } finally {
                    dlPool.shutdownNow();
                }
            });
        }

        @JavascriptInterface
        public void reloadApp() {
            runOnUiThread(() -> {
                if (web != null) {
                    web.clearCache(true);
                    web.loadUrl(START_URL);
                }
            });
        }
    }

    private void emitUpdaterEvent(final JSONObject ev) {
        final String js = "(window.__odysseyUpdaterEvent && window.__odysseyUpdaterEvent(" + ev.toString() + "))";
        runOnUiThread(() -> {
            if (web != null) web.evaluateJavascript(js, null);
        });
    }

    private static String cacheBust(String u) {
        return u + (u.contains("?") ? "&" : "?") + "t=" + System.currentTimeMillis();
    }

    private static String fetchText(String urlStr) throws Exception {
        return new String(fetchBytes(urlStr), StandardCharsets.UTF_8);
    }

    private static byte[] fetchBytes(String urlStr) throws Exception {
        URL u = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) u.openConnection();
        conn.setConnectTimeout(8000);
        conn.setReadTimeout(12000);
        conn.setUseCaches(false);
        conn.setRequestProperty("Cache-Control", "no-cache");
        int code = conn.getResponseCode();
        if (code < 200 || code >= 300) {
            conn.disconnect();
            throw new IllegalStateException("HTTP " + code + " for " + urlStr);
        }
        try (InputStream is = new BufferedInputStream(conn.getInputStream());
             ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) != -1) bos.write(buf, 0, n);
            return bos.toByteArray();
        } finally {
            conn.disconnect();
        }
    }

    private static String sanitizeRelPath(String raw) {
        if (raw == null) return null;
        String clean = raw.replace('\\', '/').trim();
        while (clean.startsWith("/")) clean = clean.substring(1);
        if (clean.isEmpty() || clean.contains("..")) return null;
        return clean;
    }

    private static void deleteRecursive(File f) {
        if (f == null || !f.exists()) return;
        if (f.isDirectory()) {
            File[] kids = f.listFiles();
            if (kids != null) {
                for (File k : kids) deleteRecursive(k);
            }
        }
        f.delete();
    }

    private static String guessMime(String path) {
        String low = path.toLowerCase(Locale.US);
        if (low.endsWith(".html") || low.endsWith(".htm")) return "text/html";
        if (low.endsWith(".js") || low.endsWith(".mjs")) return "application/javascript";
        if (low.endsWith(".css")) return "text/css";
        if (low.endsWith(".json")) return "application/json";
        if (low.endsWith(".webmanifest")) return "application/manifest+json";
        if (low.endsWith(".woff2")) return "font/woff2";
        if (low.endsWith(".png")) return "image/png";
        if (low.endsWith(".jpg") || low.endsWith(".jpeg")) return "image/jpeg";
        if (low.endsWith(".svg")) return "image/svg+xml";
        if (low.endsWith(".mp3")) return "audio/mpeg";
        return "application/octet-stream";
    }

    private void syncBundledPrefs() {
        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        otaDir = new File(getFilesDir(), "odyssey_ota");
        otaTmpDir = new File(getFilesDir(), "odyssey_ota_tmp");
        int savedBuild = prefs.getInt("installed_build", 0);
        if (savedBuild < BuildConfig.BUNDLED_BUILD) {
            // Fresh APK install or upgrade: wipe older OTA cache & initialize bundled build
            deleteRecursive(otaDir);
            deleteRecursive(otaTmpDir);
            String bundledHash = "";
            try (InputStream is = getAssets().open("version.json");
                 ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
                byte[] buf = new byte[4096];
                int n;
                while ((n = is.read(buf)) != -1) bos.write(buf, 0, n);
                JSONObject j = new JSONObject(bos.toString(StandardCharsets.UTF_8.name()));
                bundledHash = j.optString("hash", "");
            } catch (Exception ignored) {}
            prefs.edit()
                    .putInt("installed_build", BuildConfig.BUNDLED_BUILD)
                    .putString("installed_version", BuildConfig.BUNDLED_VERSION)
                    .putString("installed_hash", bundledHash)
                    .remove("pending_build")
                    .remove("pending_version")
                    .remove("pending_notes")
                    .remove("pending_hash")
                    .apply();
        }
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS && tts != null) {
            tts.setLanguage(Locale.US);
            ttsReady = true;
        }
    }

    private void setImmersiveMode() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            android.view.WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(android.view.WindowInsets.Type.statusBars() | android.view.WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        }
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            setImmersiveMode();
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        syncBundledPrefs();

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        try {
            tts = new TextToSpeech(this, this);
        } catch (Exception ignored) {}

        web = new WebView(this);
        setContentView(web);
        setImmersiveMode();

        final WebViewAssetLoader.AssetsPathHandler bundledAssets =
                new WebViewAssetLoader.AssetsPathHandler(this);

        final WebViewAssetLoader.PathHandler otaOverlayHandler = path -> {
            String clean = sanitizeRelPath(path);
            if (clean != null && otaDir.exists()) {
                File f = new File(otaDir, clean);
                if (f.exists() && f.isFile()) {
                    try {
                        WebResourceResponse resp = new WebResourceResponse(
                                guessMime(clean),
                                "utf-8",
                                new BufferedInputStream(new FileInputStream(f)));
                        Map<String, String> headers = new HashMap<>();
                        headers.put("Cache-Control", "no-store");
                        headers.put("Access-Control-Allow-Origin", "*");
                        resp.setResponseHeaders(headers);
                        return resp;
                    } catch (Exception ignored) {}
                }
            }
            return bundledAssets.handle(path);
        };

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", otaOverlayHandler)
                .build();

        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setDatabaseEnabled(true);
        web.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
        web.getSettings().setMediaPlaybackRequiresUserGesture(false);
        web.getSettings().setTextZoom(100);
        web.getSettings().setUseWideViewPort(true);
        web.getSettings().setLoadWithOverviewMode(true);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setBackgroundColor(0xFF1A1008);

        web.addJavascriptInterface(new AndroidTTSBridge(), "AndroidTTS");
        web.addJavascriptInterface(new AndroidUpdater(), "AndroidUpdater");

        web.setWebViewClient(new android.webkit.WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, android.webkit.WebResourceRequest req) {
                return !req.getUrl().getHost().equals("appassets.androidplatform.net");
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, android.webkit.WebResourceRequest req) {
                return loader.shouldInterceptRequest(req.getUrl());
            }
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            private long lastBack = 0;

            @Override
            public void handleOnBackPressed() {
                long now = System.currentTimeMillis();
                if (now - lastBack < 900) {
                    finish();
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
        web.pauseTimers();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.resumeTimers();
        web.onResume();
        setImmersiveMode();
        if (web != null) {
            web.evaluateJavascript("(window.odysseyCheckUpdate && window.odysseyCheckUpdate(false))", null);
        }
    }

    @Override
    protected void onDestroy() {
        bgPool.shutdownNow();
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
