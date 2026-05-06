import { useState, useEffect, useRef, useCallback } from "react";
import type { UserPublic, HeatZone, WsServerEvent, WsClientEvent } from "@proxm/types";

// ── PWA registration ──────────────────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(console.error);
  });
}

// ── Push notification subscription ───────────────────────────────────────────
async function subscribePush(token: string) {
  if (!("PushManager" in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
    });
    await fetch(`${import.meta.env.VITE_API_URL}/api/users/me/push-sub`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(sub),
    });
  } catch (e) { console.warn("[push]", e); }
}

// ── Install prompt ─────────────────────────────────────────────────────────────
let _deferredPrompt: any = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  _deferredPrompt = e;
});

function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    );
    const check = () => setCanInstall(!!_deferredPrompt);
    check();
    window.addEventListener("beforeinstallprompt", check);
    return () => window.removeEventListener("beforeinstallprompt", check);
  }, []);

  const install = async () => {
    if (!_deferredPrompt) return;
    _deferredPrompt.prompt();
    const { outcome } = await _deferredPrompt.userChoice;
    if (outcome === "accepted") { _deferredPrompt = null; setCanInstall(false); }
  };

  return { canInstall, isStandalone, install };
}

// ── Geolocation hook ──────────────────────────────────────────────────────────
function useGeolocation(onUpdate: (lat: number, lng: number, acc: number) => void) {
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => onUpdate(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? 10),
      (err) => console.warn("[geo]", err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);
}

// ── WS ────────────────────────────────────────────────────────────────────────
let _ws: WebSocket | null = null;
const _handlers = new Set<(e: WsServerEvent) => void>();

function wsConnect(token: string) {
  if (_ws?.readyState === WebSocket.OPEN) return;
  const url = `${import.meta.env.VITE_WS_URL}?token=${token}`;
  _ws = new WebSocket(url);
  _ws.onopen  = () => console.log("[ws] open");
  _ws.onmessage = (e) => {
    let evt: WsServerEvent;
    try { evt = JSON.parse(e.data); } catch { return; }
    _handlers.forEach(fn => fn(evt));
  };
  _ws.onclose = () => {
    console.log("[ws] closed — retry in 3s");
    setTimeout(() => wsConnect(token), 3000);
  };
}

function wsSend(event: WsClientEvent) {
  if (_ws?.readyState === WebSocket.OPEN) _ws.send(JSON.stringify(event));
}

function useWsEvent(handler: (e: WsServerEvent) => void) {
  const stableHandler = useCallback(handler, []);
  useEffect(() => {
    _handlers.add(stableHandler);
    return () => { _handlers.delete(stableHandler); };
  }, [stableHandler]);
}

// ── Token store ───────────────────────────────────────────────────────────────
const tok = {
  get: () => localStorage.getItem("proxm_token"),
  set: (t: string) => localStorage.setItem("proxm_token", t),
  clear: () => localStorage.removeItem("proxm_token"),
};

// ── Vibration ─────────────────────────────────────────────────────────────────
const vibrate = (pattern: number[]) => navigator.vibrate?.(pattern);

// ── IndexedDB ping queue ──────────────────────────────────────────────────────
async function queuePing(toUserId: string) {
  if (!("indexedDB" in window)) return;
  const db = await openDB();
  const tx = db.transaction("pings", "readwrite");
  tx.objectStore("pings").add({ toUserId, ts: Date.now() });
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("proxm", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("pings", { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// ── Install banner ────────────────────────────────────────────────────────────
function InstallBanner({ onInstall, onDismiss }: { onInstall: () => void; onDismiss: () => void }) {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
      background: "#0c0c0c", borderBottom: "1px solid #cc1133",
      padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ fontSize: 20 }}>📍</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: "#fff", letterSpacing: "0.1em", fontFamily: "Space Mono, monospace" }}>
          Add PROXM to Home Screen
        </div>
        <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.1em", marginTop: 2, fontFamily: "Space Mono, monospace" }}>
          Faster · offline-ready · push alerts
        </div>
      </div>
      <button onClick={onInstall} style={{
        padding: "8px 16px", background: "#cc1133", border: "none",
        color: "#fff", fontSize: 10, letterSpacing: "0.25em",
        fontFamily: "Space Mono, monospace", cursor: "pointer",
      }}>
        INSTALL
      </button>
      <button onClick={onDismiss} style={{
        background: "none", border: "none", color: "#555", fontSize: 16, cursor: "pointer",
      }}>×</button>
    </div>
  );
}

// ── Offline banner ────────────────────────────────────────────────────────────
function OfflineBanner() {
  return (
    <div style={{
      position: "fixed", bottom: 80, left: 16, right: 16, zIndex: 9998,
      background: "#0c0c0c", border: "1px solid #333",
      padding: "10px 16px", display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff7700" }} />
      <span style={{ fontSize: 9, color: "#777", letterSpacing: "0.2em", fontFamily: "Space Mono, monospace" }}>
        OFFLINE · Map cached · Pings queued
      </span>
    </div>
  );
}

// ── Incoming ping overlay ──────────────────────────────────────────────────────
function IncomingPingOverlay({ user, onAccept, onReject, timer }: {
  user: UserPublic; onAccept: () => void; onReject: () => void; timer: number;
}) {
  const pct = (timer / 60) * 100;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(0,0,0,0.92)", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "flex-end",
    }}>
      <div style={{
        width: "100%", maxWidth: 420,
        background: "#080808", borderTop: "1px solid #cc1133",
        padding: "20px 24px 40px",
        animation: "slideUp 0.3s cubic-bezier(0.4,0,0.2,1)",
      }}>
        {/* timer bar */}
        <div style={{ height: 2, background: "#181818", marginBottom: 20 }}>
          <div style={{
            height: "100%", width: `${pct}%`,
            background: "#cc1133", transition: "width 1s linear",
          }} />
        </div>

        <div style={{ fontSize: 9, letterSpacing: "0.3em", color: "#555", marginBottom: 24, textAlign: "center", fontFamily: "Space Mono, monospace" }}>
          INCOMING PING · {timer}s
        </div>

        {/* ripple avatar */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div style={{ position: "relative", width: 80, height: 80 }}>
            {[1.6, 2.0, 2.4].map((s, i) => (
              <div key={i} style={{
                position: "absolute", inset: 0,
                borderRadius: "50%", border: "1px solid #cc1133",
                transform: `scale(${s})`, opacity: 0.3 - i * 0.08,
                animation: `pulseRing 2s ${i * 0.5}s infinite`,
              }} />
            ))}
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              background: "rgba(204,17,51,0.2)", border: "2px solid #cc1133",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32, fontFamily: "Bebas Neue, sans-serif", color: "#fff",
            }}>
              {user.displayName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: 8, fontFamily: "Bebas Neue, sans-serif", fontSize: 32, color: "#fff", letterSpacing: "0.05em" }}>
          {user.displayName}
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 8 }}>
          {user.actionTags.map(t => (
            <span key={t} style={{
              fontSize: 10, color: "#00aaff", border: "1px solid #00aaff",
              padding: "2px 8px", letterSpacing: "0.08em", fontFamily: "Space Mono, monospace",
              background: "rgba(0,170,255,0.08)",
            }}>{t}</span>
          ))}
        </div>

        <div style={{ textAlign: "center", marginBottom: 28, fontSize: 9, color: "#555", letterSpacing: "0.15em", fontFamily: "Space Mono, monospace" }}>
          {user.distanceMeters < 1000 ? `${Math.round(user.distanceMeters)}m away` : `${(user.distanceMeters/1000).toFixed(1)}km away`}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onReject} style={{
            flex: 1, padding: "18px 0", border: "1px solid #333", background: "transparent",
            color: "#555", fontSize: 11, letterSpacing: "0.3em", fontFamily: "Space Mono, monospace", cursor: "pointer",
          }}>PASS</button>
          <button onClick={() => { vibrate([0, 100, 80, 100]); onAccept(); }} style={{
            flex: 2, padding: "18px 0", border: "none", background: "#cc1133",
            color: "#fff", fontSize: 12, letterSpacing: "0.3em",
            fontFamily: "Space Mono, monospace", fontWeight: 700, cursor: "pointer",
            boxShadow: "0 0 20px rgba(204,17,51,0.4)",
          }}>PING BACK</button>
        </div>
      </div>
    </div>
  );
}

// ── Audio channel overlay ──────────────────────────────────────────────────────
function AudioOverlay({ timer, onEnd }: { timer: number; onEnd: () => void }) {
  const [bars, setBars] = useState(Array(18).fill(8));
  useEffect(() => {
    const id = setInterval(() => setBars(Array(18).fill(0).map(() => Math.floor(Math.random() * 48 + 8))), 100);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 600, background: "#000",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      animation: "fadeIn 0.4s ease",
    }}>
      <div style={{ fontSize: 9, letterSpacing: "0.3em", color: "#555", marginBottom: 16, fontFamily: "Space Mono, monospace" }}>
        LIVE AUDIO CHANNEL
      </div>
      <div style={{ fontSize: 80, color: "#cc1133", fontFamily: "Space Mono, monospace", fontWeight: 700, lineHeight: 1, textShadow: "0 0 30px #cc1133" }}>
        {timer}
      </div>
      <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#444", marginBottom: 48, fontFamily: "Space Mono, monospace" }}>
        seconds remaining
      </div>
      <div style={{ display: "flex", gap: 4, height: 56, alignItems: "center", marginBottom: 48 }}>
        {bars.map((h, i) => (
          <div key={i} style={{
            width: 4, height: h, borderRadius: 2, background: "#cc1133",
            boxShadow: "0 0 6px rgba(204,17,51,0.6)", transition: "height 0.08s ease",
          }} />
        ))}
      </div>
      <div style={{ fontSize: 9, color: "#333", letterSpacing: "0.15em", marginBottom: 40, fontFamily: "Space Mono, monospace" }}>
        Talk fast. Channel closes automatically.
      </div>
      <button onClick={onEnd} style={{
        padding: "16px 48px", background: "#cc1133", border: "none",
        color: "#fff", fontSize: 11, letterSpacing: "0.4em",
        fontFamily: "Space Mono, monospace", fontWeight: 700, cursor: "pointer",
      }}>
        END CHANNEL
      </button>
    </div>
  );
}

// ── Profile sheet ─────────────────────────────────────────────────────────────
function ProfileSheet({ user, onClose, onPing, onVector, pingState }: {
  user: UserPublic | null;
  onClose: () => void;
  onPing: () => void;
  onVector: () => void;
  pingState: "idle" | "sent";
}) {
  if (!user) return null;
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
      background: "rgba(6,6,6,0.98)", borderTop: "1px solid #cc1133",
      padding: "16px 16px 32px",
      animation: "slideUp 0.35s cubic-bezier(0.4,0,0.2,1)",
      maxWidth: 600, margin: "0 auto",
    }}>
      <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
        <div style={{
          width: 56, height: 56, background: "rgba(204,17,51,0.2)",
          border: "1px solid #cc1133", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 22, fontFamily: "Bebas Neue, sans-serif",
          color: "#fff", flexShrink: 0,
        }}>
          {user.displayName.charAt(0)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 26, color: "#fff", letterSpacing: "0.05em", marginBottom: 6 }}>
            {user.displayName}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
            {user.readyNow && <span style={{ fontSize: 8, color: "#cc1133", border: "1px solid #cc1133", padding: "2px 6px", letterSpacing: "0.2em", fontFamily: "Space Mono, monospace" }}>READY NOW</span>}
            {user.verified && <span style={{ fontSize: 8, color: "#00aaff", border: "1px solid #00aaff", padding: "2px 6px", letterSpacing: "0.2em", fontFamily: "Space Mono, monospace" }}>VERIFIED</span>}
            <span style={{ fontSize: 9, color: "#555", letterSpacing: "0.1em", fontFamily: "Space Mono, monospace" }}>
              {user.distanceMeters < 1000 ? `${Math.round(user.distanceMeters)}m` : `${(user.distanceMeters/1000).toFixed(1)}km`}
            </span>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
            {user.actionTags.map(t => (
              <span key={t} style={{
                fontSize: 10, color: "#00aaff", background: "rgba(0,170,255,0.08)",
                border: "1px solid #00aaff", padding: "2px 8px", letterSpacing: "0.08em",
                fontFamily: "Space Mono, monospace",
              }}>{t}</span>
            ))}
          </div>
          {user.vibe && <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.1em", fontFamily: "Space Mono, monospace" }}>♫ {user.vibe}</div>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => { vibrate([50]); onPing(); }} style={{
          flex: 2, padding: "16px 0",
          border: `2px solid #cc1133`,
          background: pingState === "sent" ? "rgba(204,17,51,0.15)" : "transparent",
          color: "#cc1133", fontSize: 11, letterSpacing: "0.3em",
          fontFamily: "Space Mono, monospace", fontWeight: 700, cursor: "pointer",
        }}>
          {pingState === "sent" ? "⬤ PINGED" : "PING"}
        </button>
        <button onClick={onVector} style={{
          flex: 2, padding: "16px 0", border: "1px solid #00aaff",
          background: "transparent", color: "#00aaff",
          fontSize: 11, letterSpacing: "0.3em",
          fontFamily: "Space Mono, monospace", fontWeight: 700, cursor: "pointer",
        }}>VECTOR</button>
        <button onClick={onClose} style={{
          width: 52, padding: "16px 0", border: "1px solid #333",
          background: "transparent", color: "#555", fontSize: 16, cursor: "pointer",
        }}>✕</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function ProxmPWA() {
  const { canInstall, isStandalone, install } = useInstallPrompt();
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Auth
  const [authed, setAuthed] = useState(!!tok.get());
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // Map
  const [nearby, setNearby] = useState<UserPublic[]>([]);
  const [selected, setSelected] = useState<UserPublic | null>(null);
  const [pingState, setPingState] = useState<"idle" | "sent">("idle");
  const [filter, setFilter] = useState<"all" | "ready" | "verified">("all");
  const [myLat, setMyLat] = useState<number | null>(null);
  const [myLng, setMyLng] = useState<number | null>(null);
  const [ghostMode, setGhostMode] = useState(false);
  const [readyNow, setReadyNow] = useState(false);
  const [refreshPct, setRefreshPct] = useState(0);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());

  // Ping / audio
  const [incomingPing, setIncomingPing] = useState<{ user: UserPublic; pingId: string } | null>(null);
  const [pingTimer, setPingTimer] = useState(60);
  const [audioActive, setAudioActive] = useState(false);
  const [audioTimer, setAudioTimer] = useState(30);

  // Online/offline
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // Install banner — show after 3s if not standalone
  useEffect(() => {
    if (canInstall && !isStandalone) {
      const id = setTimeout(() => setShowInstallBanner(true), 3000);
      return () => clearTimeout(id);
    }
  }, [canInstall, isStandalone]);

  // WS events
  useWsEvent(useCallback((evt) => {
    switch (evt.type) {
      case "location_update": setNearby(evt.users); break;
      case "ping_received": {
        const from = evt.ping.fromUserId;
        const user = nearby.find(u => u.id === from);
        if (user) {
          vibrate([0, 200, 100, 200]);
          setIncomingPing({ user, pingId: evt.ping.id });
          setPingTimer(60);
        }
        break;
      }
      case "ping_accepted":
        setIncomingPing(null);
        setAudioActive(true);
        setAudioTimer(30);
        vibrate([0, 100, 80, 100, 80, 300]);
        break;
      case "ping_expired":
        setIncomingPing(null);
        break;
      case "ghost_confirmed":
        setGhostMode(true);
        break;
    }
  }, [nearby]));

  // Init map
  useEffect(() => {
    if (!authed || mapRef.current || !mapContainerRef.current) return;
    const loadMap = () => {
      if (!window.mapboxgl) return;
      window.mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
      mapRef.current = new window.mapboxgl.Map({
        container: mapContainerRef.current!,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [myLng ?? -74.006, myLat ?? 40.7128],
        zoom: 15,
        attributionControl: false,
      });
    };
    if (window.mapboxgl) { loadMap(); return; }
    const s = document.createElement("script");
    s.src = "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js";
    s.onload = loadMap;
    document.head.appendChild(s);
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css";
    document.head.appendChild(l);
  }, [authed]);

  // GPS
  useGeolocation((lat, lng, acc) => {
    setMyLat(lat); setMyLng(lng);
    if (!ghostMode) wsSend({ type: "location_broadcast", lat, lng, accuracy: acc });
    if (mapRef.current) mapRef.current.easeTo({ center: [lng, lat], duration: 800 });
  });

  // Refresh bar
  useEffect(() => {
    const id = setInterval(() => setRefreshPct(p => p >= 100 ? 0 : p + 100 / 300), 100);
    return () => clearInterval(id);
  }, []);

  // Ping countdown
  useEffect(() => {
    if (!incomingPing) return;
    const id = setInterval(() => {
      setPingTimer(t => { if (t <= 1) { setIncomingPing(null); return 60; } return t - 1; });
    }, 1000);
    return () => clearInterval(id);
  }, [incomingPing?.pingId]);

  // Audio countdown
  useEffect(() => {
    if (!audioActive) return;
    const id = setInterval(() => {
      setAudioTimer(t => { if (t <= 1) { setAudioActive(false); return 30; } return t - 1; });
    }, 1000);
    return () => clearInterval(id);
  }, [audioActive]);

  // Update markers
  useEffect(() => {
    if (!mapRef.current) return;
    const currentIds = new Set(nearby.map(u => u.id));
    markersRef.current.forEach((m, id) => { if (!currentIds.has(id)) { m.remove(); markersRef.current.delete(id); } });
    nearby.forEach(u => {
      if (!u.lat || !u.lng) return;
      if (markersRef.current.has(u.id)) { markersRef.current.get(u.id).setLngLat([u.lng, u.lat]); return; }
      const el = document.createElement("div");
      el.className = `proxm-pin${u.readyNow ? " pin-ready" : ""}`;
      el.textContent = u.displayName.charAt(0).toUpperCase();
      el.addEventListener("click", () => { setSelected(u); setPingState("idle"); vibrate([30]); });
      markersRef.current.set(u.id, new window.mapboxgl.Marker({ element: el }).setLngLat([u.lng, u.lat]).addTo(mapRef.current));
    });
  }, [nearby]);

  // Auth
  const sendOtp = async () => {
    setLoading(true);
    const d = phone.replace(/\D/g, "");
    await fetch(`${import.meta.env.VITE_API_URL}/api/auth/otp/send`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: `+1${d}` }),
    }).catch(() => null);
    setOtpSent(true); setLoading(false);
  };

  const verifyOtp = async () => {
    setLoading(true);
    const d = phone.replace(/\D/g, "");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/otp/verify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `+1${d}`, otp }),
      });
      const json = await res.json();
      if (json.ok) {
        tok.set(json.data.accessToken);
        wsConnect(json.data.accessToken);
        await subscribePush(json.data.accessToken);
        setAuthed(true);
      }
    } catch {}
    setLoading(false);
  };

  const filteredUsers = nearby.filter(u => {
    if (filter === "ready") return u.readyNow;
    if (filter === "verified") return u.verified;
    return true;
  });

  // Ghost mode active
  if (ghostMode) {
    return (
      <>
        <style>{STYLES}</style>
        <div style={{ width: "100vw", height: "100vh", background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>🔋</div>
          <div style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 48, color: "#fff", letterSpacing: 4, marginBottom: 8 }}>10%</div>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#333", fontFamily: "Space Mono, monospace", marginBottom: 64 }}>LOW BATTERY · LOCATION OFF</div>
          <button onClick={() => { setGhostMode(false); wsSend({ type: "location_broadcast", lat: myLat ?? 0, lng: myLng ?? 0, accuracy: 10 }); }} style={{
            border: "1px solid #222", background: "none", color: "#444",
            padding: "12px 32px", fontSize: 9, letterSpacing: 4,
            fontFamily: "Space Mono, monospace", cursor: "pointer",
          }}>RESUME</button>
        </div>
      </>
    );
  }

  // Auth screen
  if (!authed) {
    return (
      <>
        <style>{STYLES}</style>
        <div className="auth-root">
          <div className="auth-grid" />
          <div className="auth-scanline" />
          <div className="auth-card">
            <div style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 64, color: "#fff", letterSpacing: 16, marginBottom: 4, textShadow: "0 0 40px rgba(204,17,51,0.4)" }}>PROXM</div>
            <div style={{ fontSize: 9, letterSpacing: 4, color: "#444", marginBottom: 48, fontFamily: "Space Mono, monospace" }}>Deploy. Don't Browse.</div>
            {!otpSent ? (
              <>
                <label className="f-label">PHONE NUMBER</label>
                <input className="f-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (000) 000-0000" type="tel" onKeyDown={e => e.key === "Enter" && sendOtp()} />
                <button className="f-btn" onClick={sendOtp} disabled={loading || phone.replace(/\D/g, "").length !== 10}>
                  {loading ? "SENDING···" : "SEND CODE"}
                </button>
              </>
            ) : (
              <>
                <label className="f-label">VERIFICATION CODE</label>
                <input className="f-input" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" maxLength={6} autoFocus onKeyDown={e => e.key === "Enter" && verifyOtp()} />
                <button className="f-btn" onClick={verifyOtp} disabled={loading || otp.length !== 6}>
                  {loading ? "VERIFYING···" : "VERIFY"}
                </button>
                <button style={{ background: "none", border: "none", color: "#555", fontFamily: "Space Mono, monospace", fontSize: 10, letterSpacing: 2, cursor: "pointer", marginTop: 12 }} onClick={() => setOtpSent(false)}>← Change number</button>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  // Map view
  return (
    <>
      <style>{STYLES}</style>

      {showInstallBanner && !isStandalone && (
        <InstallBanner onInstall={() => { install(); setShowInstallBanner(false); }} onDismiss={() => setShowInstallBanner(false)} />
      )}

      {!isOnline && <OfflineBanner />}

      <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#000" }}>
        {/* Mapbox */}
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

        {/* HUD */}
        <div className="hud">
          <div className="hud-row">
            <span className="wm-sm">PROXM</span>
            <div style={{ display: "flex", gap: 6, flex: 1, marginLeft: 12 }}>
              <span className="chip red">● {filteredUsers.filter(u => u.readyNow).length} READY</span>
              <span className="chip blue">✓ {filteredUsers.filter(u => u.verified).length}</span>
            </div>
            <button className="ghost-btn" onClick={() => wsSend({ type: "ghost_activate" })}>GHOST</button>
          </div>
          <div className="ref-track"><div className="ref-fill" style={{ width: `${refreshPct}%` }} /></div>
          <div style={{ display: "flex", gap: 4 }}>
            {(["all", "ready", "verified"] as const).map(f => (
              <button key={f} className={`f-chip ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {f === "all" ? "ALL" : f === "ready" ? "READY" : "VERIFIED"}
              </button>
            ))}
          </div>
        </div>

        {/* Ready toggle */}
        <button
          className={`ready-btn ${readyNow ? "active" : ""}`}
          onClick={() => {
            setReadyNow(r => !r);
            vibrate([30]);
            wsSend({ type: "location_broadcast", lat: myLat ?? 0, lng: myLng ?? 0, accuracy: 5 });
          }}
        >
          {readyNow ? "READY NOW" : "SET READY"}
        </button>

        {/* Profile sheet */}
        <ProfileSheet user={selected} onClose={() => setSelected(null)} onPing={() => { setPingState("sent"); if (selected) wsSend({ type: "ping_send", toUserId: selected.id }); }} onVector={() => {}} pingState={pingState} />

        {/* Incoming ping */}
        {incomingPing && (
          <IncomingPingOverlay
            user={incomingPing.user}
            timer={pingTimer}
            onAccept={() => { wsSend({ type: "ping_respond", pingId: incomingPing.pingId, accept: true }); setIncomingPing(null); }}
            onReject={() => { wsSend({ type: "ping_respond", pingId: incomingPing.pingId, accept: false }); setIncomingPing(null); }}
          />
        )}

        {/* Audio channel */}
        {audioActive && <AudioOverlay timer={audioTimer} onEnd={() => setAudioActive(false)} />}
      </div>
    </>
  );
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Bebas+Neue&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #000; font-family: 'Space Mono', monospace; color: #d8d8d8; overscroll-behavior: none; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }

  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
  @keyframes pulseRing { 0% { opacity: 0.4; transform: scale(1); } 100% { opacity: 0; transform: scale(2.2); } }
  @keyframes scanDown { 0% { transform: translateY(-100%); } 100% { transform: translateY(120vh); } }

  /* Auth */
  .auth-root { width: 100vw; height: 100vh; background: #000; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
  .auth-grid { position: absolute; inset: 0; pointer-events: none; background-image: linear-gradient(#181818 1px, transparent 1px), linear-gradient(90deg, #181818 1px, transparent 1px); background-size: 44px 44px; opacity: 0.5; }
  .auth-scanline { position: absolute; left: 0; right: 0; height: 40%; background: linear-gradient(to bottom, transparent, rgba(204,17,51,0.04), transparent); animation: scanDown 7s linear infinite; pointer-events: none; }
  .auth-card { position: relative; z-index: 10; width: 100%; max-width: 360px; padding: 0 24px; }
  .f-label { display: block; font-size: 9px; letter-spacing: 4px; color: #555; margin-bottom: 8px; }
  .f-input { width: 100%; padding: 18px 16px; background: #060606; border: 1px solid #181818; border-bottom: 2px solid #cc1133; color: #fff; font-family: 'Space Mono', monospace; font-size: 16px; letter-spacing: 2px; margin-bottom: 16px; outline: none; }
  .f-input:focus { box-shadow: 0 0 0 1px rgba(204,17,51,0.2); }
  .f-btn { width: 100%; padding: 18px; background: #cc1133; border: none; color: #fff; font-family: 'Space Mono', monospace; font-size: 12px; letter-spacing: 5px; font-weight: 700; cursor: pointer; box-shadow: 0 0 20px rgba(204,17,51,0.3); }
  .f-btn:disabled { background: #333; box-shadow: none; cursor: not-allowed; }

  /* HUD */
  .hud { position: absolute; top: 0; left: 0; right: 0; z-index: 100; background: linear-gradient(to bottom, rgba(0,0,0,0.95), transparent); padding: 16px 16px 0; }
  .hud-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .wm-sm { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: #fff; letter-spacing: 8px; }
  .chip { font-size: 8px; letter-spacing: 2px; padding: 3px 8px; border: 1px solid; font-family: 'Space Mono', monospace; background: rgba(0,0,0,0.8); }
  .chip.red { color: #cc1133; border-color: #cc1133; }
  .chip.blue { color: #00aaff; border-color: #00aaff; }
  .ghost-btn { padding: 4px 12px; border: 1px solid #222; background: rgba(0,0,0,0.8); color: #555; font-family: 'Space Mono', monospace; font-size: 9px; letter-spacing: 3px; cursor: pointer; transition: all 0.15s; }
  .ghost-btn:hover { border-color: #cc1133; color: #cc1133; }
  .ref-track { height: 2px; background: #181818; margin-bottom: 8px; }
  .ref-fill { height: 100%; background: #cc1133; box-shadow: 0 0 6px #cc1133; transition: width 0.1s linear; }
  .f-chip { padding: 4px 10px; border: 1px solid #181818; background: rgba(0,0,0,0.8); color: #555; font-family: 'Space Mono', monospace; font-size: 8px; letter-spacing: 2px; cursor: pointer; transition: all 0.15s; }
  .f-chip.active { background: #cc1133; border-color: #cc1133; color: #fff; }

  /* Ready button */
  .ready-btn { position: absolute; bottom: 200px; right: 16px; z-index: 100; padding: 10px 14px; border: 1px solid #333; background: rgba(0,0,0,0.9); color: #555; font-family: 'Space Mono', monospace; font-size: 9px; letter-spacing: 3px; cursor: pointer; transition: all 0.15s; font-weight: 700; }
  .ready-btn.active { border-color: #cc1133; color: #cc1133; background: rgba(204,17,51,0.12); }

  /* Mapbox pins */
  .proxm-pin { width: 38px; height: 38px; border-radius: 50%; background: #111; border: 1.5px solid #333; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 15px; font-family: 'Bebas Neue', sans-serif; cursor: pointer; transition: all 0.2s; }
  .proxm-pin.pin-ready { background: rgba(204,17,51,0.85); border-color: #cc1133; box-shadow: 0 0 12px rgba(204,17,51,0.6); }
  .proxm-pin:hover { transform: scale(1.15); }

  /* Mapbox overrides */
  .mapboxgl-ctrl-bottom-right, .mapboxgl-ctrl-bottom-left { display: none !important; }
`;
