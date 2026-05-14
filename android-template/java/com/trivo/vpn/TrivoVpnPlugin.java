package com.trivo.vpn;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.VpnService;
import android.util.Log;

import androidx.activity.result.ActivityResult;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * TrivoVpnPlugin — Capacitor bridge between JS and the native VpnService.
 *
 * JS API (see src/native/trivoVpn.ts):
 *   TrivoVpn.startTunnel({ config: { protocol, host, port, raw } })
 *   TrivoVpn.stop()
 *   TrivoVpn.addListener("healthChange", cb)
 *
 * Lifecycle events ("connected" | "disconnected" | "error") are received
 * from TrivoVpnService over a LocalBroadcast and forwarded to JS via
 * `notifyListeners("healthChange", ...)`.
 */
@CapacitorPlugin(name = "TrivoVpn")
public class TrivoVpnPlugin extends Plugin {

    private static final String TAG = "TrivoVpnPlugin";

    public static final String BROADCAST_STATUS = "com.trivo.vpn.STATUS";
    public static final String EXTRA_STATE = "state";   // connected | disconnected | error
    public static final String EXTRA_REASON = "reason";

    private final BroadcastReceiver statusReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String state = intent.getStringExtra(EXTRA_STATE);
            String reason = intent.getStringExtra(EXTRA_REASON);
            Log.i(TAG, "status broadcast state=" + state + " reason=" + reason);

            JSObject ev = new JSObject();
            // Map native states onto the JS NativeHealth contract.
            switch (state == null ? "" : state) {
                case "connected":
                    ev.put("state", "connected");
                    break;
                case "disconnected":
                    ev.put("state", "down");
                    break;
                case "error":
                default:
                    ev.put("state", "down");
                    if (reason != null) ev.put("reason", reason);
                    break;
            }
            notifyListeners("healthChange", ev);
        }
    };

    @Override
    public void load() {
        super.load();
        IntentFilter filter = new IntentFilter(BROADCAST_STATUS);
        LocalBroadcastManager.getInstance(getContext())
                .registerReceiver(statusReceiver, filter);
    }

    @Override
    protected void handleOnDestroy() {
        try {
            LocalBroadcastManager.getInstance(getContext()).unregisterReceiver(statusReceiver);
        } catch (Throwable ignored) {}
        super.handleOnDestroy();
    }

    @PluginMethod
    public void startTunnel(PluginCall call) {
        JSObject cfg = call.getObject("config", new JSObject());
        Log.i(TAG, "startTunnel cfg=" + cfg);

        Intent prepare = VpnService.prepare(getContext());
        if (prepare != null) {
            // Need user consent — launch the system dialog. Result lands in onVpnConsentResult.
            call.setKeepAlive(true);
            startActivityForResult(call, prepare, "onVpnConsentResult");
            return;
        }
        launchService(call, cfg.toString());
    }

    @ActivityCallback
    public void onVpnConsentResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() == android.app.Activity.RESULT_OK) {
            JSObject cfg = call.getObject("config", new JSObject());
            launchService(call, cfg.toString());
        } else {
            call.reject("vpn_consent_denied");
        }
    }

    private void launchService(PluginCall call, String configJson) {
        try {
            Intent svc = new Intent(getContext(), TrivoVpnService.class);
            svc.setAction(TrivoVpnService.ACTION_START);
            svc.putExtra(TrivoVpnService.EXTRA_CONFIG, configJson);
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                getContext().startForegroundService(svc);
            } else {
                getContext().startService(svc);
            }
            JSObject ret = new JSObject();
            ret.put("started", true);
            call.resolve(ret);
        } catch (Throwable t) {
            Log.e(TAG, "launchService failed", t);
            call.reject("launch_failed", t);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            Intent svc = new Intent(getContext(), TrivoVpnService.class);
            svc.setAction(TrivoVpnService.ACTION_STOP);
            getContext().startService(svc);
            JSObject ret = new JSObject();
            ret.put("stopped", true);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("stop_failed", t);
        }
    }

    /* ---------------- No-op bridges to satisfy the JS interface ---------------- */

    @PluginMethod public void tcpPing(PluginCall call)  { JSObject r=new JSObject(); r.put("rttMs", JSObject.NULL); call.resolve(r); }
    @PluginMethod public void icmpPing(PluginCall call) { JSObject r=new JSObject(); r.put("rttMs", JSObject.NULL); call.resolve(r); }
    @PluginMethod public void start(PluginCall call)    { startTunnel(call); }
    @PluginMethod public void setProtocol(PluginCall call)            { call.resolve(); }
    @PluginMethod public void setKillSwitch(PluginCall call)          { call.resolve(); }
    @PluginMethod public void setStealthMode(PluginCall call)         { call.resolve(); }
    @PluginMethod public void setAcceleration(PluginCall call)        { call.resolve(); }
    @PluginMethod public void scheduleScraper(PluginCall call)        { JSObject r=new JSObject(); r.put("scheduled", false); call.resolve(r); }
    @PluginMethod public void cancelScraper(PluginCall call)          { call.resolve(); }
    @PluginMethod public void isIgnoringBatteryOptimizations(PluginCall call) {
        JSObject r=new JSObject(); r.put("ignoring", true); call.resolve(r);
    }
    @PluginMethod public void requestIgnoreBatteryOptimizations(PluginCall call) {
        JSObject r=new JSObject(); r.put("requested", false); call.resolve(r);
    }
}
