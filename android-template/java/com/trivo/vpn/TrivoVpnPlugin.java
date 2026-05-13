package com.trivo.vpn;

import android.content.Intent;
import android.net.VpnService;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * TrivoVpnPlugin — Capacitor bridge for the JS layer.
 *
 * JS calls (see src/native/trivoVpn.ts):
 *   TrivoVpn.startTunnel({ config: "<json>" })
 *   TrivoVpn.stop()
 *
 * Permission flow:
 *   VpnService.prepare() returns an intent the user must approve once.
 *   We surface that requirement back to JS via call.reject("vpn_consent_required")
 *   so the UI can react. Once consent is granted, JS calls startTunnel again.
 */
@CapacitorPlugin(name = "TrivoVpn")
public class TrivoVpnPlugin extends Plugin {

    private static final String TAG = "TrivoVpnPlugin";
    private static final int REQ_VPN_CONSENT = 0xC0DE;

    private PluginCall pendingStart;

    @PluginMethod
    public void startTunnel(PluginCall call) {
        final JSObject cfg = call.getObject("config", new JSObject());
        Log.i(TAG, "startTunnel cfg=" + cfg);

        Intent prepare = VpnService.prepare(getContext());
        if (prepare != null) {
            // Need user consent; remember the call and launch the system dialog.
            pendingStart = call;
            call.setKeepAlive(true);
            startActivityForResult(call, prepare, "onVpnConsentResult");
            return;
        }
        launchService(call, cfg.toString());
    }

    /** Invoked by Capacitor after the system VPN-consent dialog returns. */
    public void onVpnConsentResult(PluginCall call, androidx.activity.result.ActivityResult result) {
        if (result.getResultCode() == android.app.Activity.RESULT_OK) {
            JSObject cfg = call.getObject("config", new JSObject());
            launchService(call, cfg.toString());
        } else {
            call.reject("vpn_consent_denied");
        }
        pendingStart = null;
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
}
