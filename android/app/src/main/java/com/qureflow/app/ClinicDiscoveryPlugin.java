package com.qureflow.app;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.LinkProperties;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.InetAddress;
import java.net.Inet4Address;
import java.net.NetworkInterface;
import java.net.InterfaceAddress;
import java.net.DatagramSocket;
import java.net.DatagramPacket;
import java.net.InetSocketAddress;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.ArrayList;
import java.util.Set;
import java.util.Locale;
import java.util.UUID;
import org.json.JSONObject;

/** Android DNS-SD finds the API without sweeping the subnet or requesting location access. */
@CapacitorPlugin(name = "ClinicDiscovery")
public class ClinicDiscoveryPlugin extends Plugin {
    private final Handler main = new Handler(Looper.getMainLooper());
    private Session current;
    private ConnectivityManager connectivity;
    private ConnectivityManager.NetworkCallback networkCallback;
    private String networkFingerprint = "";

    @Override
    public void load() {
        connectivity = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override public void onAvailable(Network network) { networkChanged(network.toString()); }
            @Override public void onLost(Network network) { networkChanged("lost:" + network); }
            @Override public void onLinkPropertiesChanged(Network network, LinkProperties links) {
                networkChanged(network + ":" + links.getLinkAddresses());
            }
        };
        try { connectivity.registerDefaultNetworkCallback(networkCallback); }
        catch (Exception ignored) { }
    }

    private void networkChanged(String fingerprint) {
        main.post(() -> {
            if (networkFingerprint.equals(fingerprint)) return;
            networkFingerprint = fingerprint;
            notifyListeners("networkChanged", new JSObject());
        });
    }

    @PluginMethod
    public void discover(PluginCall call) {
        main.post(() -> {
            if (current != null) current.finish();
            Session session = new Session(call);
            current = session;
            session.start();
        });
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        main.post(() -> {
            if (current != null) current.finish();
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (connectivity != null && networkCallback != null)
            try { connectivity.unregisterNetworkCallback(networkCallback); } catch (Exception ignored) { }
        main.post(() -> { if (current != null) current.finish(); });
    }

    private class Session implements NsdManager.DiscoveryListener {
        final PluginCall call;
        final NsdManager manager = (NsdManager) getContext().getSystemService(Context.NSD_SERVICE);
        final ArrayDeque<NsdServiceInfo> queue = new ArrayDeque<>();
        final Set<String> seen = new HashSet<>();
        final Set<String> addresses = new HashSet<>();
        final JSArray servers = new JSArray();
        final Set<DatagramSocket> datagrams = Collections.synchronizedSet(new HashSet<>());
        final Runnable deadline = this::finish;
        WifiManager.MulticastLock multicast;
        volatile boolean done;
        boolean resolving, started;
        String failure;

        Session(PluginCall call) { this.call = call; }

        void start() {
            main.postDelayed(deadline, 5500);
            startDirectDiscovery();
            try {
                WifiManager wifi = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wifi != null) {
                    multicast = wifi.createMulticastLock("QureFlow-discovery");
                    multicast.setReferenceCounted(false);
                    multicast.acquire();
                }
                manager.discoverServices("_qureflow._tcp.", NsdManager.PROTOCOL_DNS_SD, this);
            } catch (Exception error) {
                failure = "Network discovery could not start.";
            }
        }

        void finish() {
            if (done) return;
            done = true;
            main.removeCallbacks(deadline);
            synchronized (datagrams) {
                for (DatagramSocket socket : datagrams) socket.close();
                datagrams.clear();
            }
            if (started) try { manager.stopServiceDiscovery(this); } catch (Exception ignored) { }
            if (multicast != null && multicast.isHeld()) multicast.release();
            queue.clear();
            JSObject result = new JSObject();
            result.put("servers", servers);
            if (failure != null) result.put("error", failure);
            call.resolve(result);
            if (current == this) current = null;
        }

        @Override public void onDiscoveryStarted(String type) {
            main.post(() -> {
                started = true;
                if (done) try { manager.stopServiceDiscovery(this); } catch (Exception ignored) { }
            });
        }
        @Override public void onServiceFound(NsdServiceInfo info) {
            main.post(() -> {
                if (done || seen.size() >= 16 || !info.getServiceType().contains("_qureflow._tcp")) return;
                if (seen.add(info.getServiceName())) { queue.add(info); resolveNext(); }
            });
        }
        @Override public void onServiceLost(NsdServiceInfo info) { }
        @Override public void onDiscoveryStopped(String type) { }
        @Override public void onStartDiscoveryFailed(String type, int code) {
            main.post(() -> { failure = "Wi-Fi discovery is unavailable. Reconnect to Wi-Fi and retry."; });
        }
        @Override public void onStopDiscoveryFailed(String type, int code) { }

        void startDirectDiscovery() {
            // Hotspot interfaces may not belong to Android's default (cellular) NSD network.
            // Send a few local broadcasts on Wi-Fi/AP interfaces, without scanning hosts.
            Thread enumerate = new Thread(() -> {
                int count = 0;
                try {
                    for (NetworkInterface network : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                        String name = network.getName().toLowerCase(Locale.ROOT);
                        if (!network.isUp() || network.isLoopback() ||
                            !name.matches("^(wlan|swlan|wifi|ap|softap|br|eth|rndis).*")) continue;
                        for (InterfaceAddress address : network.getInterfaceAddresses()) {
                            if (!(address.getAddress() instanceof Inet4Address) ||
                                !address.getAddress().isSiteLocalAddress() ||
                                !(address.getBroadcast() instanceof Inet4Address)) continue;
                            if (count++ >= 4 || done) return;
                            Thread worker = new Thread(() -> queryLocalNetwork(address), "QureFlow-local-discovery");
                            worker.setDaemon(true);
                            worker.start();
                        }
                    }
                } catch (Exception ignored) { }
            }, "QureFlow-network-interfaces");
            enumerate.setDaemon(true);
            enumerate.start();
        }

        void queryLocalNetwork(InterfaceAddress local) {
            DatagramSocket socket = null;
            try {
                socket = new DatagramSocket(new InetSocketAddress(local.getAddress(), 0));
                synchronized (datagrams) {
                    if (done) { socket.close(); return; }
                    datagrams.add(socket);
                }
                socket.setBroadcast(true);
                socket.setSoTimeout(250);
                String nonce = UUID.randomUUID().toString();
                JSONObject query = new JSONObject();
                query.put("type", "QureFlowDiscover");
                query.put("version", 1);
                query.put("nonce", nonce);
                byte[] bytes = query.toString().getBytes(StandardCharsets.UTF_8);
                long deadlineAt = SystemClock.elapsedRealtime() + 4000;
                long nextSend = 0;
                while (!done && SystemClock.elapsedRealtime() < deadlineAt) {
                    if (SystemClock.elapsedRealtime() >= nextSend) {
                        socket.send(new DatagramPacket(bytes, bytes.length, local.getBroadcast(), 45831));
                        nextSend = SystemClock.elapsedRealtime() + 900;
                    }
                    DatagramPacket packet = new DatagramPacket(new byte[1024], 1024);
                    try { socket.receive(packet); } catch (SocketTimeoutException ignored) { continue; }
                    if (packet.getPort() != 45831 || !(packet.getAddress() instanceof Inet4Address) ||
                        !packet.getAddress().isSiteLocalAddress()) continue;
                    try {
                        JSONObject reply = new JSONObject(new String(packet.getData(), packet.getOffset(),
                            packet.getLength(), StandardCharsets.UTF_8));
                        if (!"QureFlowServer".equals(reply.optString("type")) ||
                            reply.optInt("version") != 1 || !nonce.equals(reply.optString("nonce"))) continue;
                        String id = reply.optString("serverId");
                        int port = reply.optInt("port");
                        if (!id.matches("[a-zA-Z0-9-]{1,80}") || port < 1 || port > 65535) continue;
                        String base = "http://" + packet.getAddress().getHostAddress() + ":" + port + "/api";
                        main.post(() -> {
                            if (done || addresses.size() >= 16 || !addresses.add(base)) return;
                            JSObject server = new JSObject();
                            server.put("apiBase", base);
                            server.put("serverId", id);
                            servers.put(server);
                        });
                    } catch (Exception ignored) { }
                }
            } catch (Exception ignored) { }
            finally {
                if (socket != null) { datagrams.remove(socket); socket.close(); }
            }
        }

        @SuppressWarnings("deprecation")
        void resolveNext() {
            if (done || resolving || queue.isEmpty()) return;
            resolving = true;
            try {
                manager.resolveService(queue.remove(), new NsdManager.ResolveListener() {
                    @Override public void onResolveFailed(NsdServiceInfo info, int code) {
                        main.post(() -> { resolving = false; resolveNext(); });
                    }
                    @Override public void onServiceResolved(NsdServiceInfo info) {
                        main.post(() -> {
                            if (!done) addServer(info);
                            resolving = false;
                            resolveNext();
                        });
                    }
                });
            } catch (Exception ignored) { resolving = false; resolveNext(); }
        }

        @SuppressWarnings("deprecation")
        void addServer(NsdServiceInfo info) {
            byte[] id = info.getAttributes().get("id");
            byte[] project = info.getAttributes().get("project");
            if (id == null || project == null ||
                !"QureFlow".equals(new String(project, StandardCharsets.UTF_8)) ||
                info.getPort() < 1 || info.getPort() > 65535) return;
            List<InetAddress> hosts = new ArrayList<>(Build.VERSION.SDK_INT >= 34
                ? info.getHostAddresses() : Collections.singletonList(info.getHost()));
            // Older Android resolves only one A record, which may be a virtual adapter.
            byte[] advertised = info.getAttributes().get("addresses");
            if (advertised != null) {
                String[] candidates = new String(advertised, StandardCharsets.UTF_8).split(",");
                for (int index = 0; index < Math.min(candidates.length, 14); index++) {
                    String candidate = candidates[index];
                    if (!candidate.matches("[0-9]{1,3}(\\.[0-9]{1,3}){3}")) continue;
                    try { hosts.add(InetAddress.getByName(candidate)); } catch (Exception ignored) { }
                }
            }
            for (InetAddress host : hosts) {
                if (!(host instanceof Inet4Address) || !host.isSiteLocalAddress()) continue;
                String base = "http://" + host.getHostAddress() + ":" + info.getPort() + "/api";
                if (!addresses.add(base) || addresses.size() > 16) continue;
                JSObject server = new JSObject();
                server.put("apiBase", base);
                server.put("serverId", new String(id, StandardCharsets.UTF_8));
                servers.put(server);
            }
        }
    }
}
