package com.trivo.vpn;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.VpnService;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.util.Log;

import org.json.JSONObject;

import java.io.IOException;

/**
 * TrivoVpnService — native Android VpnService wrapper.
 *
 * Lifecycle:
 *   1. JS calls TrivoVpn.startTunnel({ config }) via the Capacitor plugin.
 *   2. The plugin starts this service with the JSON config in the intent.
 *   3. onStartCommand() parses the config, builds the tun interface via
 *      establish(), and hands the file descriptor to the native VPN core
 *      (sing-box .aar dropped into android/app/libs/ by GitHub Actions).
 */
public class TrivoVpnService extends VpnService {

    private static final String TAG = "TrivoVpnService";
    private static final String CHANNEL_ID = "trivo_vpn_channel";
    private static final int NOTIFICATION_ID = 0x7113;

    public static final String ACTION_START = "com.trivo.vpn.START";
    public static final String ACTION_STOP  = "com.trivo.vpn.STOP";
    public static final String EXTRA_CONFIG = "config_json";

    private ParcelFileDescriptor tunInterface;
    private Thread coreThread;
    private volatile boolean running = false;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        final String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            shutdown();
            stopSelf();
            return START_NOT_STICKY;
        }

        final String configJson = intent.getStringExtra(EXTRA_CONFIG);
        Log.i(TAG, "onStartCommand action=" + action + " hasConfig=" + (configJson != null));

        startForeground(NOTIFICATION_ID, buildNotification("Trivo VPN connecting…"));

        try {
            establishTunnel(configJson);
        } catch (Exception e) {
            Log.e(TAG, "establishTunnel failed", e);
            shutdown();
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    /**
     * Build the tun interface and hand the fd to the native core.
     */
    private void establishTunnel(String configJson) throws IOException {
        String protocol = "unknown";
        String host = "?";
        int port = 0;
        try {
            if (configJson != null) {
                JSONObject cfg = new JSONObject(configJson);
                protocol = cfg.optString("protocol", protocol);
                host     = cfg.optString("host", host);
                port     = cfg.optInt("port", port);
                Log.i(TAG, "VPN cfg parsed protocol=" + protocol
                        + " host=" + host + " port=" + port);
            }
        } catch (Exception e) {
            Log.w(TAG, "config parse failed", e);
        }

        Builder b = new Builder()
                .setSession("Trivo VPN")
                .setMtu(1500)
                .addAddress("10.10.0.2", 24)
                .addRoute("0.0.0.0", 0)
                .addRoute("::", 0)
                .addDnsServer("1.1.1.1")
                .addDnsServer("1.0.0.1");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            b.setMetered(false);
        }

        tunInterface = b.establish();
        if (tunInterface == null) {
            throw new IOException("VpnService.Builder.establish() returned null");
        }
        running = true;

        final int fd = tunInterface.getFd();
        final String coreConfig = configJson == null ? "{}" : configJson;
        final String coreProtocol = protocol;

        coreThread = new Thread(() -> {
            try {
                Log.i(TAG, "core thread starting protocol=" + coreProtocol + " fd=" + fd);

                // Initialize the native sing-box core
                io.nekohasekai.libbox.Libbox.setup(getApplicationContext().getFilesDir().getAbsolutePath());
                io.nekohasekai.libbox.BoxService box = new io.nekohasekai.libbox.BoxService(coreConfig, fd);
                box.start();

                while (running && !Thread.currentThread().isInterrupted()) {
                    Thread.sleep(1000L);
                }
                box.stop();
            } catch (InterruptedException ie) {
                Log.i(TAG, "core thread interrupted");
            } catch (Throwable t) {
                Log.e(TAG, "core thread crashed", t);
            }
        }, "trivo-vpn-core");
        coreThread.start();

        updateNotification("Trivo VPN active · " + protocol);
    }

    public void establish(String configJson) throws IOException {
        establishTunnel(configJson);
    }

    private void shutdown() {
        running = false;
        if (coreThread != null) {
            coreThread.interrupt();
            coreThread = null;
        }
        if (tunInterface != null) {
            try { tunInterface.close(); } catch (IOException ignored) {}
            tunInterface = null;
        }
    }

    @Override
    public void onDestroy() {
        Log.i(TAG, "onDestroy");
        shutdown();
        super.onDestroy();
    }

    @Override
    public void onRevoke() {
        Log.w(TAG, "onRevoke — VPN permission revoked by user/OS");
        shutdown();
        super.onRevoke();
    }

    private Notification buildNotification(String text) {
        ensureChannel();
        Intent open = new Intent(this, getMainActivityClass());
        PendingIntent pi = PendingIntent.getActivity(
                this, 0, open,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder nb = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        return nb.setContentTitle("Trivo VPN")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.stat_sys_vpn_ic)
                .setContentIntent(pi)
                .setOngoing(true)
                .build();
    }

    private void updateNotification(String text) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification(text));
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "Trivo VPN", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Active VPN tunnel status");
        nm.createNotificationChannel(ch);
    }

    @SuppressWarnings("unchecked")
    private Class<?> getMainActivityClass() {
        try {
            return Class.forName(getPackageName() + ".MainActivity");
        } catch (ClassNotFoundException e) {
            return TrivoVpnService.class;
        }
    }
}
