import { useState, useEffect, useRef, useCallback } from "react";
import type { UserPublic, HeatZone, WsServerEvent, WsClientEvent } from "@proxm/types";

// ── token store (localStorage for web) ───────────────────────────────────────
const getToken = () => localStorage.getItem("proxm_access_token");
const setToken = (t: string) => localStorage.setItem("proxm_access_token", t);
const clearToken = () => localStorage.removeItem("proxm_access_token");

// ── WS singleton ──────────────────────────────────────────────────────────────
let _ws: WebSocket | null = null;
const _listeners = new Set<(e: WsServerEvent) => void>();

function wsConnect(token: string) {
  if (_ws?.readyState === WebSocket.OPEN) return;
  _ws = new WebSocket(`${import.meta.env.VITE_WS_URL}?token=${token}`);
  _ws.onmessage = (e) => {
    let evt: WsServerEvent;
    try { evt = JSON.parse(e.data); } catch { return; }
    _listeners.forEach(fn => fn(evt));
  };
  _ws.onclose = () => setTimeout(() => wsConnect(token), 3000);
}

function wsSend(event: WsClientEvent) {
  if (_ws?.readyState === WebSocket.OPEN) _ws.send(JSON.stringify(event));
}

function useWsEvent(handler: (e: WsServerEvent) => void) {
  useEffect(() => {
    _listeners.add(handler);
    return () => { _listeners.delete(handler); };
  }, [handler]);
}

// ── Mapbox web map ────────────────────────────────────────────────────────────
declare global { interface Window { mapboxgl: any; } }

function useMapbox(containerRef: React.RefObject<HTMLDivElement>, myLat: number | null, myLng: number | null) {
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js";
    script.onload = () => {
      window.mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
      mapRef.current = new window.mapboxgl.Map({
        container: containerRef.current!,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [myLng ?? -74.006, myLat ?? 40.7128],
        zoom: 15,
        attributionControl: false,
        logoPosition: "bottom-right",
      });
    };
    document.head.appendChild(script);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css";
    document.head.appendChild(link);
  }, []);

  return mapRef;
}

// ── Web app entry ─────────────────────────────────────────────────────────────
export default function ProxmWeb() {
  const [authed, setAuthed] = useState(!!getToken());
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // Map state
  const [nearby, setNearby] = useState<UserPublic[]>([]);
  const [selected, setSelected] = useState<UserPublic | null>(null);
  const [pingState, setPingState] = useState<"idle" | "sent">("idle");
  const [filter, setFilter] = useState<"all" | "ready" | "verified">("all");
  const [myLat, setMyLat] = useState<number | null>(null);
  const [myLng, setMyLng] = useState<number | null>(null);
  const [refreshPct, setRefreshPct] = useState(0);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useMapbox(mapContainerRef, myLat, myLng);
  const markersRef = useRef<Map<string, any>>(new Map());

  // WS events
  const handleWsEvent = useCallback((evt: WsServerEvent) => {
    if (evt.type === "location_update") setNearby(evt.users);
    if (evt.type === "ping_accepted") alert(`Channel open: ${evt.channel.channelId}`);
    if (evt.type === "ghost_confirmed") alert("Ghost mode active");
  }, []);
  useWsEvent(handleWsEvent);

  // Geolocation + broadcast
  useEffect(() => {
    if (!authed) return;
    const token = getToken()!;
    wsConnect(token);

    navigator.geolocation?.watchPosition((pos) => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      setMyLat(lat); setMyLng(lng);
      wsSend({ type: "location_broadcast", lat, lng, accuracy });
    }, undefined, { enableHighAccuracy: true, maximumAge: 10000 });
  }, [authed]);

  // Refresh bar
  useEffect(() => {
    const id = setInterval(() => setRefreshPct(p => p >= 100 ? 0 : p + 100 / 300), 100);
    return () => clearInterval(id);
  }, []);

  // Update Mapbox markers when nearby changes
  useEffect(() => {
    if (!mapRef.current) return;
    const currentIds = new Set(nearby.map(u => u.id));

    // Remove stale
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) { marker.remove(); markersRef.current.delete(id); }
    });

    // Add/update
    nearby.forEach(u => {
      if (!u.lat || !u.lng) return;
      if (markersRef.current.has(u.id)) {
        markersRef.current.get(u.id)!.setLngLat([u.lng, u.lat]);
        return;
      }
      const el = document.createElement("div");
      el.className = `proxm-pin ${u.readyNow ? "pin-ready" : ""} ${selected?.id === u.id ? "pin-selected" : ""}`;
      el.textContent = u.displayName.charAt(0).toUpperCase();
      el.onclick = () => setSelected(u);
      const marker = new window.mapboxgl.Marker({ element: el })
        .setLngLat([u.lng, u.lat])
        .addTo(mapRef.current);
      markersRef.current.set(u.id, marker);
    });
  }, [nearby]);

  // Auth handlers
  const sendOtp = async () => {
    setLoading(true);
    const d = phone.replace(/\D/g, "");
    await fetch(`${import.meta.env.VITE_API_URL}/api/auth/otp/send`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: `+1${d}` }),
    });
    setOtpSent(true); setLoading(false);
  };

  const verifyOtp = async () => {
    setLoading(true);
    const d = phone.replace(/\D/g, "");
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/otp/verify`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: `+1${d}`, otp }),
    });
    const json = await res.json();
    if (json.ok) { setToken(json.data.accessToken); setAuthed(true); }
    setLoading(false);
  };

  const handlePing = () => {
    if (!selected) return;
    setPingState("sent");
    wsSend({ type: "ping_send", toUserId: selected.id });
  };

  const filteredUsers = nearby.filter(u => {
    if (filter === "ready") return u.readyNow;
    if (filter === "verified") return u.verified;
    return true;
  });

  // ── Auth screen ─────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <>
        <style>{WEB_STYLES}</style>
        <div className="auth-root">
          <div className="auth-scanline" />
          <div className="auth-grid" />
          <div className="auth-card">
            <div className="wordmark">PROXM</div>
            <div className="auth-sub">Deploy. Don't Browse.</div>
            {!otpSent ? (
              <>
                <label className="field-label">PHONE NUMBER</label>
                <input
                  className="auth-input"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+1 (000) 000-0000"
                  type="tel"
                />
                <button
                  className="auth-btn"
                  onClick={sendOtp}
                  disabled={loading || phone.replace(/\D/g, "").length !== 10}
                >
                  {loading ? "SENDING···" : "SEND CODE"}
                </button>
              </>
            ) : (
              <>
                <label className="field-label">VERIFICATION CODE</label>
                <input
                  className="auth-input"
                  value={otp}
                  onChange={e => setOtp(e.target.value.slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                />
                <button
                  className="auth-btn"
                  onClick={verifyOtp}
                  disabled={loading || otp.length !== 6}
                >
                  {loading ? "VERIFYING···" : "VERIFY"}
                </button>
                <button className="auth-link" onClick={() => setOtpSent(false)}>← Change number</button>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  // ── Map view ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{WEB_STYLES}</style>
      <div className="map-root">
        {/* Mapbox container */}
        <div ref={mapContainerRef} className="map-canvas" />

        {/* HUD top */}
        <div className="hud-top">
          <div className="hud-row">
            <span className="wordmark sm">PROXM</span>
            <div className="hud-stats">
              <span className="stat-chip red">● {filteredUsers.filter(u => u.readyNow).length} READY</span>
              <span className="stat-chip blue">✓ {filteredUsers.filter(u => u.verified).length}</span>
            </div>
            <button className="ghost-btn" onClick={() => wsSend({ type: "ghost_activate" })}>
              GHOST
            </button>
          </div>
          {/* refresh bar */}
          <div className="refresh-track">
            <div className="refresh-fill" style={{ width: `${refreshPct}%` }} />
          </div>
          {/* filters */}
          <div className="filter-bar">
            {(["all", "ready", "verified"] as const).map(f => (
              <button
                key={f}
                className={`filter-btn ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "ALL" : f === "ready" ? "READY NOW" : "VERIFIED"}
              </button>
            ))}
          </div>
        </div>

        {/* Profile sheet */}
        {selected && (
          <div className="profile-sheet">
            <div className="sheet-row">
              <div className="sheet-avatar">{selected.displayName.charAt(0)}</div>
              <div className="sheet-info">
                <div className="sheet-name">{selected.displayName}</div>
                <div className="sheet-badges">
                  {selected.readyNow && <span className="badge red">READY NOW</span>}
                  {selected.verified && <span className="badge blue">VERIFIED</span>}
                  <span className="dist">
                    {selected.distanceMeters < 1000
                      ? `${Math.round(selected.distanceMeters)}m`
                      : `${(selected.distanceMeters / 1000).toFixed(1)}km`}
                  </span>
                </div>
                <div className="sheet-tags">
                  {selected.actionTags.map(t => <span key={t} className="tag">{t}</span>)}
                </div>
                {selected.vibe && <div className="vibe">♫ {selected.vibe}</div>}
              </div>
            </div>
            <div className="sheet-actions">
              <button
                className={`btn-ping ${pingState === "sent" ? "sent" : ""}`}
                onClick={handlePing}
              >
                {pingState === "sent" ? "⬤ PINGED" : "PING"}
              </button>
              <button className="btn-vector">VECTOR</button>
              <button className="btn-close" onClick={() => { setSelected(null); setPingState("idle"); }}>✕</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const WEB_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Bebas+Neue&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #000; font-family: 'Space Mono', monospace; color: #d8d8d8; }

  /* Auth */
  .auth-root {
    width: 100vw; height: 100vh; background: #000;
    display: flex; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
  }
  .auth-grid {
    position: absolute; inset: 0; pointer-events: none;
    background-image: linear-gradient(#181818 1px, transparent 1px),
      linear-gradient(90deg, #181818 1px, transparent 1px);
    background-size: 44px 44px; opacity: 0.5;
  }
  .auth-scanline {
    position: absolute; left: 0; right: 0; height: 40%;
    background: linear-gradient(to bottom, transparent, rgba(204,17,51,0.04), transparent);
    animation: scanDown 7s linear infinite; pointer-events: none;
  }
  @keyframes scanDown { 0% { transform: translateY(-100%); } 100% { transform: translateY(120vh); } }
  .auth-card {
    position: relative; z-index: 10; width: 100%; max-width: 360px;
    padding: 0 24px; display: flex; flex-direction: column; gap: 0;
  }
  .wordmark {
    font-family: 'Bebas Neue', sans-serif; font-size: 64px;
    color: #fff; letter-spacing: 16px; margin-bottom: 4px;
    text-shadow: 0 0 40px rgba(204,17,51,0.4);
  }
  .wordmark.sm { font-size: 28px; letter-spacing: 8px; margin-bottom: 0; }
  .auth-sub { font-size: 9px; letter-spacing: 4px; color: #444; margin-bottom: 48px; }
  .field-label { font-size: 9px; letter-spacing: 4px; color: #555; margin-bottom: 8px; display: block; }
  .auth-input {
    width: 100%; padding: 18px 16px; background: #060606;
    border: 1px solid #181818; border-bottom: 2px solid #cc1133;
    color: #fff; font-family: 'Space Mono', monospace; font-size: 16px;
    letter-spacing: 2px; margin-bottom: 16px; outline: none;
  }
  .auth-input:focus { border-color: #cc1133; box-shadow: 0 0 0 1px rgba(204,17,51,0.2); }
  .auth-btn {
    width: 100%; padding: 18px; background: #cc1133; border: none;
    color: #fff; font-family: 'Space Mono', monospace; font-size: 12px;
    letter-spacing: 5px; font-weight: 700; cursor: pointer; margin-bottom: 12px;
    box-shadow: 0 0 20px rgba(204,17,51,0.3);
    transition: all 0.15s ease;
  }
  .auth-btn:disabled { background: #333; box-shadow: none; cursor: not-allowed; }
  .auth-link { background: none; border: none; color: #555; font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 2px; cursor: pointer; }

  /* Map */
  .map-root { width: 100vw; height: 100vh; position: relative; background: #000; }
  .map-canvas { width: 100%; height: 100%; }

  /* HUD */
  .hud-top {
    position: absolute; top: 0; left: 0; right: 0; z-index: 100;
    background: linear-gradient(to bottom, rgba(0,0,0,0.95), transparent);
    padding: 16px 16px 0;
  }
  .hud-row { display: flex; align-items: center; gap: 12; margin-bottom: 6px; }
  .hud-stats { display: flex; gap: 6px; flex: 1; margin-left: 12px; }
  .stat-chip {
    font-size: 8px; letter-spacing: 2px; padding: 3px 8px;
    border: 1px solid #181818; background: rgba(0,0,0,0.8);
    font-family: 'Space Mono', monospace;
  }
  .stat-chip.red { color: #cc1133; border-color: #cc1133; }
  .stat-chip.blue { color: #00aaff; border-color: #00aaff; }
  .ghost-btn {
    padding: 4px 12px; border: 1px solid #222; background: rgba(0,0,0,0.8);
    color: #555; font-family: 'Space Mono', monospace; font-size: 9px;
    letter-spacing: 3px; cursor: pointer;
    transition: all 0.15s;
  }
  .ghost-btn:hover { border-color: #cc1133; color: #cc1133; }
  .refresh-track { height: 2px; background: #181818; margin-bottom: 8px; }
  .refresh-fill { height: 100%; background: #cc1133; box-shadow: 0 0 6px #cc1133; transition: width 0.1s linear; }
  .filter-bar { display: flex; gap: 4px; padding-bottom: 8px; }
  .filter-btn {
    padding: 4px 10px; border: 1px solid #181818;
    background: rgba(0,0,0,0.8); color: #555;
    font-family: 'Space Mono', monospace; font-size: 8px;
    letter-spacing: 2px; cursor: pointer; transition: all 0.15s;
  }
  .filter-btn.active { background: #cc1133; border-color: #cc1133; color: #fff; }

  /* Profile sheet */
  .profile-sheet {
    position: absolute; bottom: 0; left: 0; right: 0; z-index: 100;
    background: rgba(6,6,6,0.98); border-top: 1px solid #cc1133;
    padding: 16px 16px 32px;
    animation: slideUp 0.35s cubic-bezier(0.4,0,0.2,1);
  }
  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .sheet-row { display: flex; gap: 14px; margin-bottom: 14px; }
  .sheet-avatar {
    width: 56px; height: 56px; background: rgba(204,17,51,0.2);
    border: 1px solid #cc1133; display: flex; align-items: center;
    justify-content: center; font-family: 'Bebas Neue', sans-serif;
    font-size: 24px; color: #fff; flex-shrink: 0;
  }
  .sheet-info { flex: 1; }
  .sheet-name { font-family: 'Bebas Neue', sans-serif; font-size: 26px; color: #fff; letter-spacing: 1px; margin-bottom: 6px; }
  .sheet-badges { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; }
  .badge { font-size: 8px; letter-spacing: 2px; padding: 2px 6px; border: 1px solid; font-family: 'Space Mono', monospace; }
  .badge.red { color: #cc1133; border-color: #cc1133; }
  .badge.blue { color: #00aaff; border-color: #00aaff; }
  .dist { font-size: 9px; color: #555; letter-spacing: 1px; }
  .sheet-tags { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 6px; }
  .tag { font-size: 10px; color: #00aaff; background: rgba(0,170,255,0.1); border: 1px solid #00aaff; padding: 2px 8px; letter-spacing: 1px; }
  .vibe { font-size: 9px; color: #555; letter-spacing: 1px; }
  .sheet-actions { display: flex; gap: 8px; }
  .btn-ping {
    flex: 2; padding: 15px; border: 2px solid #cc1133; background: transparent;
    color: #cc1133; font-family: 'Space Mono', monospace; font-size: 11px;
    letter-spacing: 4px; font-weight: 700; cursor: pointer; transition: all 0.15s;
  }
  .btn-ping.sent { background: rgba(204,17,51,0.15); }
  .btn-vector {
    flex: 2; padding: 15px; border: 1px solid #00aaff; background: transparent;
    color: #00aaff; font-family: 'Space Mono', monospace; font-size: 11px;
    letter-spacing: 4px; font-weight: 700; cursor: pointer;
  }
  .btn-close {
    width: 52px; padding: 15px; border: 1px solid #333; background: transparent;
    color: #555; font-size: 16px; cursor: pointer;
  }

  /* Mapbox pins */
  .proxm-pin {
    width: 38px; height: 38px; border-radius: 50%;
    background: #111; border: 1.5px solid #333;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 700; font-size: 14px;
    font-family: 'Bebas Neue', sans-serif;
    cursor: pointer; transition: all 0.2s ease;
  }
  .proxm-pin.pin-ready {
    background: rgba(204,17,51,0.8); border-color: #cc1133;
    box-shadow: 0 0 12px rgba(204,17,51,0.6);
  }
  .proxm-pin.pin-selected { border-color: #fff; border-width: 2px; transform: scale(1.2); }
`;
