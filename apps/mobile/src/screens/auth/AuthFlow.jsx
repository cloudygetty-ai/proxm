import { useState, useEffect, useRef, useCallback } from "react";

// ─── TOKENS ────────────────────────────────────────────────────────────────────
const C = {
  void:       "#000000",
  surface:    "#060606",
  panel:      "#0c0c0c",
  border:     "#181818",
  dim:        "#222222",
  muted:      "#333333",
  subtle:     "#555555",
  ghost:      "#777777",
  text:       "#d8d8d8",
  bright:     "#ffffff",
  crimson:    "#cc1133",
  crimsonHi:  "#ff1a44",
  crimsonLo:  "#55000f",
  electric:   "#00aaff",
  electricLo: "#002233",
  amber:      "#ff7700",
};

const FONT_DISPLAY = "'Bebas Neue', 'Arial Black', sans-serif";
const FONT_MONO    = "'Space Mono', 'Courier New', monospace";

// ─── ALL AVAILABLE ACTION TAGS ─────────────────────────────────────────────────
const ALL_TAGS = [
  "#Now", "#Drinks", "#Discreet", "#Talk", "#Coffee",
  "#Walk", "#Drive", "#Late", "#Rooftop", "#Gym",
  "#Developer", "#Creative", "#Chill", "#Fast", "#Verified",
  "#NSA", "#Spontaneous", "#Social", "#Outdoors", "#Remote",
];

// ─── SCREENS ───────────────────────────────────────────────────────────────────
// splash → phone → otp → profile → tags → complete

// ─── UTILS ─────────────────────────────────────────────────────────────────────
const formatPhone = (raw) => {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0,3)}) ${d.slice(3)}`;
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
};

// ─── GLOBAL STYLES ─────────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Bebas+Neue&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #000; }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeIn {
      from { opacity: 0; } to { opacity: 1; }
    }
    @keyframes scanDown {
      0%   { transform: translateY(-100%); opacity: 0.06; }
      100% { transform: translateY(120vh); opacity: 0; }
    }
    @keyframes blink {
      0%, 100% { opacity: 1; } 50% { opacity: 0; }
    }
    @keyframes pulseRing {
      0%   { transform: scale(1);   opacity: 0.6; }
      100% { transform: scale(2.2); opacity: 0;   }
    }
    @keyframes shakeX {
      0%,100% { transform: translateX(0); }
      20%     { transform: translateX(-8px); }
      40%     { transform: translateX(8px); }
      60%     { transform: translateX(-5px); }
      80%     { transform: translateX(5px); }
    }
    @keyframes successPulse {
      0%   { box-shadow: 0 0 0 0 rgba(204,17,51,0.7); }
      70%  { box-shadow: 0 0 0 20px rgba(204,17,51,0); }
      100% { box-shadow: 0 0 0 0 rgba(204,17,51,0); }
    }
    @keyframes slideRight {
      from { transform: translateX(-100%); opacity: 0; }
      to   { transform: translateX(0);     opacity: 1; }
    }
    @keyframes countUp {
      from { transform: translateY(100%); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    @keyframes gridFlash {
      0%,100% { opacity: 0.07; }
      50%     { opacity: 0.18; }
    }

    input, button { font-family: ${FONT_MONO}; }
    input:focus { outline: none; }
    button { cursor: pointer; }
    button:disabled { opacity: 0.35; cursor: not-allowed; }
  `}</style>
);

// ─── LAYOUT SHELL ──────────────────────────────────────────────────────────────
function Shell({ children, style }) {
  return (
    <div style={{
      width: "100%", height: "100vh",
      background: C.void, overflow: "hidden",
      position: "relative", display: "flex",
      flexDirection: "column", alignItems: "center",
      justifyContent: "center", fontFamily: FONT_MONO,
      color: C.text, ...style,
    }}>
      {/* grid background */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `
          linear-gradient(${C.border} 1px, transparent 1px),
          linear-gradient(90deg, ${C.border} 1px, transparent 1px)
        `,
        backgroundSize: "44px 44px",
        animation: "gridFlash 4s ease-in-out infinite",
      }} />
      {/* scanline */}
      <div style={{
        position: "absolute", left: 0, right: 0, height: "40%",
        background: `linear-gradient(to bottom, transparent, rgba(204,17,51,0.04), transparent)`,
        animation: "scanDown 7s linear infinite",
        pointerEvents: "none",
      }} />
      {children}
    </div>
  );
}

// ─── WORDMARK ──────────────────────────────────────────────────────────────────
function Wordmark({ size = 48, sub }) {
  return (
    <div style={{ textAlign: "center", marginBottom: sub ? 8 : 0 }}>
      <div style={{
        fontFamily: FONT_DISPLAY, fontSize: size,
        color: C.bright, letterSpacing: "0.25em",
        lineHeight: 1,
        textShadow: `0 0 40px rgba(204,17,51,0.4)`,
      }}>
        PROXM
      </div>
      {sub && (
        <div style={{
          fontSize: 9, letterSpacing: "0.35em", color: C.ghost,
          textTransform: "uppercase", marginTop: 6,
          animation: "fadeIn 1s ease 0.5s both",
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── SCREEN INDICATOR ──────────────────────────────────────────────────────────
function StepDots({ current, total }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 40 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? 20 : 6, height: 6,
          borderRadius: 3,
          background: i === current ? C.crimson : i < current ? C.muted : C.dim,
          transition: "all 0.3s ease",
          boxShadow: i === current ? `0 0 8px ${C.crimson}` : "none",
        }} />
      ))}
    </div>
  );
}

// ─── SCREEN 0: SPLASH ─────────────────────────────────────────────────────────
function SplashScreen({ onNext }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  return (
    <Shell>
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 0,
        opacity: visible ? 1 : 0, transition: "opacity 0.8s ease",
      }}>
        {/* top decoration */}
        <div style={{
          width: 1, height: 80, background: `linear-gradient(to bottom, transparent, ${C.crimson})`,
          marginBottom: 32,
          animation: visible ? "fadeIn 1s ease 0.3s both" : "none",
        }} />

        <div style={{ animation: "fadeUp 0.8s ease 0.2s both" }}>
          <Wordmark size={72} sub="Deploy. Don't Browse." />
        </div>

        <div style={{
          width: 1, height: 40, background: `linear-gradient(to bottom, ${C.crimson}, transparent)`,
          margin: "32px 0 48px",
          animation: "fadeIn 1s ease 0.5s both",
        }} />

        {/* tagline block */}
        <div style={{
          animation: "fadeUp 0.8s ease 0.5s both",
          textAlign: "center", marginBottom: 64,
        }}>
          {["Real-time proximity.", "60-second ping.", "30-second channel."].map((line, i) => (
            <div key={i} style={{
              fontSize: 11, letterSpacing: "0.2em", color: C.ghost,
              textTransform: "uppercase", lineHeight: 2.2,
              animation: `fadeUp 0.6s ease ${0.6 + i * 0.12}s both`,
            }}>
              {line}
            </div>
          ))}
        </div>

        <button
          onClick={onNext}
          style={{
            animation: "fadeUp 0.8s ease 1s both",
            padding: "18px 64px",
            background: C.crimson,
            border: "none",
            color: C.bright,
            fontSize: 13, letterSpacing: "0.35em",
            textTransform: "uppercase",
            fontFamily: FONT_MONO, fontWeight: 700,
            position: "relative",
            boxShadow: `0 0 0 1px ${C.crimson}, 0 0 30px rgba(204,17,51,0.3)`,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={e => {
            e.target.style.background = C.crimsonHi;
            e.target.style.boxShadow = `0 0 0 1px ${C.crimsonHi}, 0 0 40px rgba(255,26,68,0.5)`;
          }}
          onMouseLeave={e => {
            e.target.style.background = C.crimson;
            e.target.style.boxShadow = `0 0 0 1px ${C.crimson}, 0 0 30px rgba(204,17,51,0.3)`;
          }}
        >
          Enter
        </button>

        <div style={{
          marginTop: 32, fontSize: 9, letterSpacing: "0.2em",
          color: C.muted, textTransform: "uppercase",
          animation: "fadeIn 1s ease 1.4s both",
        }}>
          18+ · Location Required
        </div>
      </div>
    </Shell>
  );
}

// ─── SCREEN 1: PHONE ENTRY ────────────────────────────────────────────────────
function PhoneScreen({ onNext }) {
  const [phone, setPhone] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const digits = phone.replace(/\D/g, "");

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 300); }, []);

  const handleSubmit = () => {
    if (digits.length !== 10) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); onNext(phone); }, 1200);
  };

  return (
    <Shell>
      <div style={{
        width: "100%", maxWidth: 380, padding: "0 24px",
        display: "flex", flexDirection: "column",
        alignItems: "center",
        animation: "fadeUp 0.5s ease",
      }}>
        <StepDots current={0} total={4} />
        <Wordmark size={42} />

        <div style={{ marginTop: 48, marginBottom: 12, width: "100%", textAlign: "left" }}>
          <div style={{
            fontSize: 10, letterSpacing: "0.25em", color: C.ghost,
            textTransform: "uppercase", marginBottom: 24,
          }}>
            Enter your number
          </div>

          {/* Phone input */}
          <div style={{
            position: "relative",
            border: `1px solid ${focused ? C.crimson : C.border}`,
            background: C.surface,
            transition: "border-color 0.2s ease",
            boxShadow: focused ? `0 0 0 1px ${C.crimsonLo}, inset 0 0 20px rgba(204,17,51,0.04)` : "none",
          }}>
            {/* country flag */}
            <div style={{
              position: "absolute", left: 16, top: "50%",
              transform: "translateY(-50%)",
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 10, letterSpacing: "0.1em", color: C.ghost,
              borderRight: `1px solid ${C.border}`, paddingRight: 12,
            }}>
              🇺🇸 +1
            </div>

            <input
              ref={inputRef}
              value={formatPhone(digits)}
              onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              placeholder="(000) 000-0000"
              style={{
                width: "100%", padding: "20px 20px 20px 88px",
                background: "transparent", border: "none",
                fontSize: 18, letterSpacing: "0.15em",
                color: C.bright, fontFamily: FONT_MONO,
                caretColor: C.crimson,
              }}
            />

            {/* cursor blink when empty + focused */}
            {focused && digits.length === 0 && (
              <div style={{
                position: "absolute", left: 90, top: "50%",
                transform: "translateY(-50%)",
                width: 2, height: 20, background: C.crimson,
                animation: "blink 1s step-end infinite",
              }} />
            )}
          </div>

          {/* progress bar */}
          <div style={{ height: 2, background: C.border, marginTop: 0 }}>
            <div style={{
              height: "100%",
              width: `${(digits.length / 10) * 100}%`,
              background: C.crimson,
              transition: "width 0.15s ease",
              boxShadow: `0 0 6px ${C.crimson}`,
            }} />
          </div>
        </div>

        <div style={{
          fontSize: 9, letterSpacing: "0.15em", color: C.muted,
          textTransform: "uppercase", marginBottom: 40,
          alignSelf: "flex-start",
        }}>
          {digits.length}/10 · SMS verification
        </div>

        <button
          onClick={handleSubmit}
          disabled={digits.length !== 10 || loading}
          style={{
            width: "100%", padding: "18px 0",
            background: digits.length === 10 ? C.crimson : C.dim,
            border: "none", color: C.bright,
            fontSize: 12, letterSpacing: "0.3em",
            textTransform: "uppercase", fontWeight: 700,
            transition: "all 0.2s ease",
            boxShadow: digits.length === 10 ? `0 0 20px rgba(204,17,51,0.35)` : "none",
            fontFamily: FONT_MONO,
          }}
        >
          {loading ? (
            <span style={{ letterSpacing: "0.2em" }}>Sending ···</span>
          ) : "Send Code"}
        </button>

        <div style={{
          marginTop: 24, fontSize: 9, letterSpacing: "0.15em",
          color: C.muted, textTransform: "uppercase", textAlign: "center",
          lineHeight: 1.8,
        }}>
          By continuing you agree to our Terms.<br/>
          Standard rates may apply.
        </div>
      </div>
    </Shell>
  );
}

// ─── SCREEN 2: OTP VERIFY ────────────────────────────────────────────────────
function OtpScreen({ phone, onNext, onBack }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [loading, setLoading] = useState(false);
  const refs = Array.from({ length: 6 }, () => useRef(null));

  useEffect(() => {
    refs[0].current?.focus();
    const id = setInterval(() => setResendTimer(t => t > 0 ? t - 1 : 0), 1000);
    return () => clearInterval(id);
  }, []);

  const handleKey = (i, e) => {
    if (e.key === "Backspace") {
      const next = [...digits];
      if (next[i]) { next[i] = ""; setDigits(next); }
      else if (i > 0) { refs[i - 1].current?.focus(); next[i - 1] = ""; setDigits(next); }
      return;
    }
    if (e.key === "ArrowLeft" && i > 0) { refs[i - 1].current?.focus(); return; }
    if (e.key === "ArrowRight" && i < 5) { refs[i + 1].current?.focus(); return; }
    if (/^\d$/.test(e.key)) {
      const next = [...digits];
      next[i] = e.key;
      setDigits(next);
      if (i < 5) refs[i + 1].current?.focus();
      if (i === 5 && next.every(d => d)) {
        setTimeout(() => verify(next.join("")), 100);
      }
    }
  };

  const verify = (code) => {
    setLoading(true);
    setTimeout(() => {
      // Simulate: "000000" = wrong, anything else = success
      if (code === "000000") {
        setLoading(false);
        setShake(true);
        setTimeout(() => setShake(false), 600);
        setDigits(["", "", "", "", "", ""]);
        setTimeout(() => refs[0].current?.focus(), 50);
      } else {
        setSuccess(true);
        setTimeout(() => onNext(), 900);
      }
    }, 800);
  };

  const full = digits.every(d => d !== "");

  return (
    <Shell>
      <div style={{
        width: "100%", maxWidth: 380, padding: "0 24px",
        display: "flex", flexDirection: "column",
        alignItems: "center",
        animation: "fadeUp 0.5s ease",
      }}>
        <StepDots current={1} total={4} />
        <Wordmark size={42} />

        <div style={{
          marginTop: 48, width: "100%",
          opacity: success ? 0.3 : 1, transition: "opacity 0.3s ease",
        }}>
          <div style={{ marginBottom: 8, fontSize: 10, letterSpacing: "0.25em", color: C.ghost, textTransform: "uppercase" }}>
            Verification code
          </div>
          <div style={{
            fontSize: 11, color: C.muted, letterSpacing: "0.1em",
            marginBottom: 32,
          }}>
            Sent to {phone} · <span style={{ color: C.crimson, cursor: "pointer" }} onClick={onBack}>change</span>
          </div>

          {/* OTP digits */}
          <div style={{
            display: "flex", gap: 10, justifyContent: "center", marginBottom: 4,
            animation: shake ? "shakeX 0.5s ease" : "none",
          }}>
            {digits.map((d, i) => (
              <div key={i} style={{ position: "relative", flex: 1 }}>
                <input
                  ref={refs[i]}
                  value={d}
                  onKeyDown={e => handleKey(i, e)}
                  onChange={() => {}} // controlled via onKeyDown
                  maxLength={1}
                  inputMode="numeric"
                  style={{
                    width: "100%", height: 60,
                    background: d ? C.surface : C.void,
                    border: `1px solid ${
                      success ? C.crimson :
                      d ? C.muted :
                      document.activeElement === refs[i]?.current ? C.crimson : C.border
                    }`,
                    color: C.bright, fontSize: 22, fontWeight: 700,
                    textAlign: "center", fontFamily: FONT_MONO,
                    letterSpacing: 0,
                    transition: "all 0.15s ease",
                    boxShadow: d ? `inset 0 0 10px rgba(204,17,51,0.08)` : "none",
                    caretColor: "transparent",
                  }}
                />
                {/* bottom bar */}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
                  background: d ? C.crimson : C.dim,
                  transition: "background 0.2s ease",
                  boxShadow: d ? `0 0 4px ${C.crimson}` : "none",
                }} />
              </div>
            ))}
          </div>

          <div style={{
            textAlign: "center", marginTop: 24,
            fontSize: 9, letterSpacing: "0.2em", color: C.muted,
            textTransform: "uppercase",
          }}>
            {resendTimer > 0 ? (
              `Resend in ${resendTimer}s`
            ) : (
              <span style={{ color: C.crimson, cursor: "pointer" }}>Resend Code</span>
            )}
          </div>
        </div>

        {/* success state */}
        {success && (
          <div style={{
            position: "absolute", display: "flex",
            flexDirection: "column", alignItems: "center", gap: 16,
            animation: "fadeUp 0.4s ease",
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: C.crimson,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28,
              animation: "successPulse 0.6s ease",
            }}>
              ✓
            </div>
            <div style={{ fontSize: 11, letterSpacing: "0.25em", color: C.ghost, textTransform: "uppercase" }}>
              Verified
            </div>
          </div>
        )}

        {loading && !success && (
          <div style={{
            marginTop: 32, fontSize: 9, letterSpacing: "0.3em",
            color: C.ghost, textTransform: "uppercase",
            animation: "blink 1s step-end infinite",
          }}>
            Verifying ···
          </div>
        )}

        <div style={{
          marginTop: 48, fontSize: 9, letterSpacing: "0.15em",
          color: C.muted, textTransform: "uppercase", textAlign: "center",
        }}>
          Demo: any code except 000000 works
        </div>
      </div>
    </Shell>
  );
}

// ─── SCREEN 3: PROFILE SETUP ──────────────────────────────────────────────────
function ProfileScreen({ onNext }) {
  const [name, setName] = useState("");
  const [vibe, setVibe] = useState("");
  const [nameFocused, setNameFocused] = useState(false);
  const [vibeFocused, setVibeFocused] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 300); }, []);

  const canNext = name.trim().length >= 2;

  return (
    <Shell>
      <div style={{
        width: "100%", maxWidth: 380, padding: "0 24px",
        display: "flex", flexDirection: "column",
        alignItems: "center",
        animation: "fadeUp 0.5s ease",
      }}>
        <StepDots current={2} total={4} />
        <Wordmark size={42} />

        <div style={{ marginTop: 48, width: "100%" }}>
          {/* Name */}
          <div style={{ marginBottom: 32 }}>
            <label style={{
              display: "block", fontSize: 9, letterSpacing: "0.25em",
              color: C.ghost, textTransform: "uppercase", marginBottom: 10,
            }}>
              Display Name
            </label>
            <div style={{
              border: `1px solid ${nameFocused ? C.crimson : C.border}`,
              background: C.surface,
              transition: "border-color 0.2s, box-shadow 0.2s",
              boxShadow: nameFocused ? `0 0 0 1px ${C.crimsonLo}` : "none",
            }}>
              <input
                ref={nameRef}
                value={name}
                onChange={e => setName(e.target.value.slice(0, 24))}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                placeholder="How you appear on the map"
                style={{
                  width: "100%", padding: "18px 16px",
                  background: "transparent", border: "none",
                  fontSize: 15, color: C.bright,
                  fontFamily: FONT_MONO, letterSpacing: "0.05em",
                  caretColor: C.crimson,
                }}
              />
            </div>
            <div style={{ height: 2, background: C.dim }}>
              <div style={{
                height: "100%",
                width: `${Math.min(100, (name.length / 24) * 100)}%`,
                background: name.length > 20 ? C.amber : C.crimson,
                transition: "all 0.15s ease",
              }} />
            </div>
            <div style={{
              textAlign: "right", fontSize: 9, color: C.muted,
              letterSpacing: "0.1em", marginTop: 4,
            }}>
              {name.length}/24
            </div>
          </div>

          {/* Photo placeholder */}
          <div style={{ marginBottom: 32 }}>
            <label style={{
              display: "block", fontSize: 9, letterSpacing: "0.25em",
              color: C.ghost, textTransform: "uppercase", marginBottom: 10,
            }}>
              Photo
            </label>
            <div style={{
              height: 96, border: `1px dashed ${C.border}`,
              background: C.surface,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", gap: 12,
              transition: "border-color 0.2s",
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.crimson}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
            >
              <span style={{ fontSize: 20 }}>📷</span>
              <span style={{
                fontSize: 9, letterSpacing: "0.2em", color: C.ghost,
                textTransform: "uppercase",
              }}>
                Upload Photo
              </span>
            </div>
          </div>

          {/* Vibe */}
          <div style={{ marginBottom: 40 }}>
            <label style={{
              display: "block", fontSize: 9, letterSpacing: "0.25em",
              color: C.ghost, textTransform: "uppercase", marginBottom: 10,
            }}>
              Vibe <span style={{ color: C.muted }}>· optional</span>
            </label>
            <div style={{
              border: `1px solid ${vibeFocused ? C.electric : C.border}`,
              background: C.surface, transition: "all 0.2s",
              boxShadow: vibeFocused ? `0 0 0 1px ${C.electricLo}` : "none",
            }}>
              <input
                value={vibe}
                onChange={e => setVibe(e.target.value.slice(0, 60))}
                onFocus={() => setVibeFocused(true)}
                onBlur={() => setVibeFocused(false)}
                placeholder="Artist · Track or what you're building"
                style={{
                  width: "100%", padding: "14px 16px",
                  background: "transparent", border: "none",
                  fontSize: 12, color: C.text,
                  fontFamily: FONT_MONO, letterSpacing: "0.03em",
                  caretColor: C.electric,
                }}
              />
            </div>
            <div style={{
              fontSize: 9, color: C.muted, letterSpacing: "0.1em",
              marginTop: 6, textTransform: "uppercase",
            }}>
              Shown as scrolling ticker on your pin
            </div>
          </div>

          <button
            onClick={() => canNext && onNext({ name: name.trim(), vibe })}
            disabled={!canNext}
            style={{
              width: "100%", padding: "18px 0",
              background: canNext ? C.crimson : C.dim,
              border: "none", color: C.bright,
              fontSize: 12, letterSpacing: "0.3em",
              textTransform: "uppercase", fontWeight: 700,
              transition: "all 0.2s ease", fontFamily: FONT_MONO,
              boxShadow: canNext ? `0 0 20px rgba(204,17,51,0.3)` : "none",
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </Shell>
  );
}

// ─── SCREEN 4: ACTION TAGS ────────────────────────────────────────────────────
function TagsScreen({ onNext }) {
  const [selected, setSelected] = useState([]);

  const toggle = (tag) => {
    setSelected(prev => {
      if (prev.includes(tag)) return prev.filter(t => t !== tag);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, tag];
    });
  };

  const canNext = selected.length === 3;

  return (
    <Shell>
      <div style={{
        width: "100%", maxWidth: 420, padding: "0 24px",
        display: "flex", flexDirection: "column",
        alignItems: "center",
        animation: "fadeUp 0.5s ease",
      }}>
        <StepDots current={3} total={4} />
        <Wordmark size={42} />

        <div style={{ marginTop: 40, width: "100%" }}>
          <div style={{ marginBottom: 8, fontSize: 9, letterSpacing: "0.25em", color: C.ghost, textTransform: "uppercase" }}>
            Choose 3 Action Tags
          </div>
          <div style={{
            fontSize: 11, color: C.muted, letterSpacing: "0.1em",
            marginBottom: 28,
          }}>
            This is your entire profile. Choose fast.
          </div>

          {/* Tag grid */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32,
          }}>
            {ALL_TAGS.map((tag, i) => {
              const isSelected = selected.includes(tag);
              const isDisabled = !isSelected && selected.length >= 3;
              const selIdx = selected.indexOf(tag);

              return (
                <button
                  key={tag}
                  onClick={() => !isDisabled && toggle(tag)}
                  style={{
                    padding: "9px 14px",
                    background: isSelected
                      ? `linear-gradient(135deg, ${C.crimson}, ${C.crimsonLo})`
                      : C.surface,
                    border: `1px solid ${isSelected ? C.crimson : isDisabled ? C.dim : C.border}`,
                    color: isSelected ? C.bright : isDisabled ? C.muted : C.text,
                    fontSize: 11, letterSpacing: "0.1em",
                    fontFamily: FONT_MONO,
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease",
                    position: "relative",
                    boxShadow: isSelected ? `0 0 12px rgba(204,17,51,0.4)` : "none",
                    animation: `fadeUp 0.4s ease ${i * 0.03}s both`,
                  }}
                  onMouseEnter={e => {
                    if (!isDisabled && !isSelected) {
                      e.currentTarget.style.borderColor = C.crimson;
                      e.currentTarget.style.color = C.bright;
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = isDisabled ? C.dim : C.border;
                      e.currentTarget.style.color = isDisabled ? C.muted : C.text;
                    }
                  }}
                >
                  {tag}
                  {isSelected && (
                    <span style={{
                      position: "absolute", top: -6, right: -6,
                      width: 16, height: 16, borderRadius: "50%",
                      background: C.bright, color: C.void,
                      fontSize: 9, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {selIdx + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected preview */}
          <div style={{
            display: "flex", gap: 8, marginBottom: 32, minHeight: 36,
            alignItems: "center",
          }}>
            {selected.length === 0 ? (
              <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.2em", textTransform: "uppercase" }}>
                Select 3 tags
              </div>
            ) : selected.map((tag, i) => (
              <div key={tag} style={{
                padding: "6px 12px",
                background: C.crimsonLo,
                border: `1px solid ${C.crimson}`,
                color: C.crimson, fontSize: 11,
                letterSpacing: "0.1em",
                animation: "slideRight 0.2s ease",
              }}>
                {tag}
              </div>
            ))}
            {selected.length > 0 && selected.length < 3 && (
              <div style={{
                padding: "6px 12px",
                border: `1px dashed ${C.border}`,
                color: C.muted, fontSize: 9,
                letterSpacing: "0.2em", textTransform: "uppercase",
              }}>
                {3 - selected.length} more
              </div>
            )}
          </div>

          <button
            onClick={() => canNext && onNext(selected)}
            disabled={!canNext}
            style={{
              width: "100%", padding: "18px 0",
              background: canNext ? C.crimson : C.dim,
              border: "none", color: C.bright,
              fontSize: 12, letterSpacing: "0.3em",
              textTransform: "uppercase", fontWeight: 700,
              transition: "all 0.2s ease", fontFamily: FONT_MONO,
              boxShadow: canNext ? `0 0 20px rgba(204,17,51,0.3)` : "none",
            }}
          >
            {canNext ? "Go Live" : `Pick ${3 - selected.length} More`}
          </button>
        </div>
      </div>
    </Shell>
  );
}

// ─── SCREEN 5: COMPLETE ───────────────────────────────────────────────────────
function CompleteScreen({ profile, onLaunch }) {
  const [phase, setPhase] = useState(0); // 0=building, 1=ready

  useEffect(() => {
    const id = setTimeout(() => setPhase(1), 2000);
    return () => clearTimeout(id);
  }, []);

  const lines = [
    "Initializing location grid ···",
    "Calibrating heat zones ···",
    "Activating broadcast ···",
    "Profile deployed.",
  ];
  const [lineIdx, setLineIdx] = useState(0);
  useEffect(() => {
    if (lineIdx >= lines.length - 1) return;
    const id = setTimeout(() => setLineIdx(i => i + 1), 450);
    return () => clearTimeout(id);
  }, [lineIdx]);

  return (
    <Shell>
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", width: "100%", maxWidth: 380, padding: "0 24px",
        animation: "fadeIn 0.5s ease",
      }}>
        {phase === 0 ? (
          <>
            {/* Boot sequence */}
            <div style={{
              fontFamily: FONT_MONO, fontSize: 10,
              letterSpacing: "0.15em", color: C.ghost,
              width: "100%", marginBottom: 48,
              textTransform: "uppercase",
            }}>
              {lines.slice(0, lineIdx + 1).map((line, i) => (
                <div key={i} style={{
                  marginBottom: 12,
                  color: i === lineIdx ? C.crimson : C.muted,
                  animation: "fadeUp 0.3s ease",
                }}>
                  <span style={{ color: C.dim }}>›</span> {line}
                </div>
              ))}
              <span style={{ animation: "blink 1s step-end infinite", color: C.crimson }}>_</span>
            </div>

            <Wordmark size={56} />
          </>
        ) : (
          <>
            {/* Profile card preview */}
            <div style={{
              width: "100%",
              border: `1px solid ${C.crimson}`,
              background: C.surface,
              padding: 24,
              marginBottom: 40,
              animation: "fadeUp 0.5s ease",
              position: "relative",
              boxShadow: `0 0 40px rgba(204,17,51,0.15), inset 0 0 40px rgba(204,17,51,0.04)`,
            }}>
              {/* verified badge */}
              <div style={{
                position: "absolute", top: -1, right: 20,
                background: C.electric, color: C.void,
                fontSize: 8, letterSpacing: "0.2em",
                padding: "3px 8px", textTransform: "uppercase",
                fontWeight: 700,
              }}>
                Live
              </div>

              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                {/* avatar */}
                <div style={{
                  width: 56, height: 56,
                  background: `linear-gradient(135deg, ${C.crimson} 0%, ${C.crimsonLo} 100%)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, fontWeight: 700, color: C.bright,
                  border: `1px solid ${C.crimson}`, flexShrink: 0,
                  fontFamily: FONT_DISPLAY,
                }}>
                  {profile.name.charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{
                    fontFamily: FONT_DISPLAY, fontSize: 26,
                    color: C.bright, letterSpacing: "0.05em",
                    marginBottom: 8, lineHeight: 1,
                  }}>
                    {profile.name}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    {profile.tags.map(t => (
                      <span key={t} style={{
                        fontSize: 10, color: C.electric,
                        background: C.electricLo,
                        border: `1px solid ${C.electric}`,
                        padding: "2px 8px", letterSpacing: "0.08em",
                      }}>{t}</span>
                    ))}
                  </div>
                  {profile.vibe && (
                    <div style={{
                      fontSize: 9, color: C.ghost, letterSpacing: "0.1em",
                      borderLeft: `2px solid ${C.muted}`, paddingLeft: 8,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      ♫ {profile.vibe}
                    </div>
                  )}
                </div>
              </div>

              {/* status row */}
              <div style={{
                marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}`,
                display: "flex", gap: 16, alignItems: "center",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: C.crimson,
                    boxShadow: `0 0 8px ${C.crimson}`,
                    animation: "successPulse 2s infinite",
                  }} />
                  <span style={{ fontSize: 9, color: C.ghost, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                    Broadcasting
                  </span>
                </div>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 9, color: C.muted, letterSpacing: "0.1em" }}>
                  0.0mi · Ready Now
                </span>
              </div>
            </div>

            <Wordmark size={48} sub="You're deployed." />

            <button
              onClick={onLaunch}
              style={{
                marginTop: 40, width: "100%", padding: "20px 0",
                background: C.crimson, border: "none",
                color: C.bright, fontSize: 13, letterSpacing: "0.35em",
                textTransform: "uppercase", fontWeight: 700,
                fontFamily: FONT_MONO,
                boxShadow: `0 0 0 1px ${C.crimson}, 0 0 40px rgba(204,17,51,0.4)`,
                animation: "successPulse 2s infinite",
              }}
            >
              Open Map
            </button>
          </>
        )}
      </div>
    </Shell>
  );
}

// ─── ROUTER ───────────────────────────────────────────────────────────────────
export default function ProxmAuth() {
  const [screen, setScreen] = useState("splash");
  const [data, setData] = useState({ phone: "", name: "", vibe: "", tags: [] });

  const go = (next, patch = {}) => {
    setData(d => ({ ...d, ...patch }));
    setScreen(next);
  };

  return (
    <>
      <GlobalStyles />
      {screen === "splash" && (
        <SplashScreen onNext={() => go("phone")} />
      )}
      {screen === "phone" && (
        <PhoneScreen onNext={(phone) => go("otp", { phone })} />
      )}
      {screen === "otp" && (
        <OtpScreen
          phone={data.phone}
          onNext={() => go("profile")}
          onBack={() => go("phone")}
        />
      )}
      {screen === "profile" && (
        <ProfileScreen onNext={({ name, vibe }) => go("tags", { name, vibe })} />
      )}
      {screen === "tags" && (
        <TagsScreen onNext={(tags) => go("complete", { tags })} />
      )}
      {screen === "complete" && (
        <CompleteScreen
          profile={data}
          onLaunch={() => go("splash")} // loop back for demo
        />
      )}
    </>
  );
}
