import { useEffect, useRef, useState } from "react";

const MAX_ALT = 120; // كم — أعلى نقطة في المشهد

const PHASE_ORDER = ["entry", "explosion", "shockwave", "seismic", "done"];
const PHASE_LABELS = {
  idle: "جاهز للإطلاق",
  entry: "دخول الغلاف الجوي",
  explosion: "الانفجار",
  shockwave: "انتشار موجة الضغط",
  seismic: "تسجيل الإشارة الزلزالية",
  done: "اكتملت المحاكاة",
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, p) => a + (b - a) * p;
const rand = (a, b) => a + Math.random() * (b - a);

export default function MeteorSimulation({ event, onExplosion, sound }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const S = useRef(null); // حالة المحاكاة (خارج React عشان الأداء)
  const rafRef = useRef(null);
  const speedRef = useRef(1);
  const explodedRef = useRef(false);
  const liveAccRef = useRef(0);

  const [phase, setPhase] = useState("idle");
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [live, setLive] = useState({ alt: MAX_ALT, vel: 0, t: 0, shock: 0 });

  // بيانات الحدث الحقيقي من NASA
  const burstAlt = event?.altitude || 30;
  const velocity = event?.velocity || 18;
  const energy = event?.energyNum || 1;
  const diameter = event?.diameter || 3;
  const color = event?.color || "#ff9b54";

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // ---------- أدوات هندسية ----------
  const altToY = (alt, groundY, topY) =>
    groundY - (alt / MAX_ALT) * (groundY - topY);

  function makeStars(W, H) {
    return Array.from({ length: 90 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H * 0.8,
      r: Math.random() * 1.3 + 0.2,
      tw: Math.random() * Math.PI * 2,
    }));
  }

  function fitCanvas() {
    const c = canvasRef.current;
    const wrap = wrapRef.current;
    if (!c || !wrap) return;
    const w = wrap.clientWidth || 600;
    const h = Math.max(260, Math.round(w * 0.56));
    const dpr = window.devicePixelRatio || 1;
    c.width = w * dpr;
    c.height = h * dpr;
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    c.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setSimPhase(s, name) {
    s.phase = name;
    s.phaseT = 0;
    setPhase(name);
  }

  function reset() {
    fitCanvas();
    const c = canvasRef.current;
    if (!c) return;
    const W = c.clientWidth;
    const H = c.clientHeight;
    const groundY = H * 0.82;
    const topY = H * 0.08;

    S.current = {
      W,
      H,
      groundY,
      topY,
      t: 0,
      phase: "idle",
      phaseT: 0,
      stars: makeStars(W, H),
      start: { x: W * 0.92, y: topY - 10 },
      burst: { x: W * 0.42, y: altToY(burstAlt, groundY, topY) },
      meteor: null,
      particles: [],
      fragments: [],
      flash: 0,
      shock: null,
      seismic: [],
      stations: [0.15, 0.5, 0.85].map((f, i) => ({
        x: W * f,
        id: i + 1,
        hit: false,
        hitT: 0,
      })),
      entryDuration: clamp(80 / velocity, 2.2, 5),
      shockDuration: clamp(burstAlt / 12, 1.2, 3),
    };
    explodedRef.current = false;
    liveAccRef.current = 0;
    setPhase("idle");
    setLive({ alt: MAX_ALT, vel: 0, t: 0, shock: 0 });
    draw();
  }

  // ---------- الانفجار ----------
  function explode(s) {
    setSimPhase(s, "explosion");
    s.flash = 1;
    s.meteor = null;
    const n = clamp(Math.round(14 + Math.log10(energy + 1) * 30), 14, 70);
    s.fragments = Array.from({ length: n }, () => {
      const a = rand(0, Math.PI * 2);
      const sp = rand(60, 90 + Math.log10(energy + 1) * 120);
      return {
        x: s.burst.x,
        y: s.burst.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.8, 1.6),
        size: rand(1.2, 3.4),
      };
    });
    s.shock = { r: 0 };
    sound?.play("explosion");

    if (!explodedRef.current) {
      explodedRef.current = true;
      onExplosion?.({ energy, altitude: burstAlt, velocity, time: s.t });
    }
  }

  // ---------- التحديث ----------
  function update(dt) {
    const s = S.current;
    if (!s) return;
    s.t += dt;
    s.phaseT += dt;

    if (s.phase === "entry") {
      const p = Math.min(s.phaseT / s.entryDuration, 1);
      const alt = MAX_ALT - p * (MAX_ALT - burstAlt);
      s.meteor = {
        x: lerp(s.start.x, s.burst.x, p),
        y: lerp(s.start.y, s.burst.y, p),
        alt,
        heat: alt < 100 ? clamp((100 - alt) / 60, 0, 1) : 0,
      };
      const count = 2 + Math.round(s.meteor.heat * 5);
      const dx = s.start.x - s.burst.x;
      const dy = s.start.y - s.burst.y;
      for (let i = 0; i < count; i++) {
        s.particles.push({
          x: s.meteor.x + rand(-3, 3),
          y: s.meteor.y + rand(-3, 3),
          vx: dx * rand(0.08, 0.22) + rand(-12, 12),
          vy: dy * rand(0.08, 0.22) + rand(-12, 12),
          life: rand(0.5, 1),
          size: rand(1, 2.8 + s.meteor.heat * 2),
        });
      }
      if (p >= 1) explode(s);
    } else if (s.phase === "explosion") {
      s.flash = Math.max(0, s.flash - dt * 1.8);
      if (s.phaseT > 0.5) setSimPhase(s, "shockwave");
    } else if (s.phase === "shockwave") {
      s.flash = Math.max(0, s.flash - dt * 1.8);
      const dist = s.groundY - s.burst.y;
      s.shock.r += (dist / s.shockDuration) * dt;
      if (s.shock.r >= dist) {
        setSimPhase(s, "seismic");
        s.seismic.push({ x: s.burst.x, r: 0, alpha: 1 });
        s.seismic.push({ x: s.burst.x, r: -40, alpha: 1 });
        sound?.play("infrasound");
      }
    } else if (s.phase === "seismic") {
      s.shock.r += s.W * 0.25 * dt;
      s.seismic.forEach((ring) => {
        ring.r += s.W * 0.28 * dt;
        ring.alpha = Math.max(0, 1 - ring.r / (s.W * 0.75));
      });
      s.stations.forEach((st) => {
        const reached = s.seismic.some(
          (r) => r.r >= Math.abs(st.x - s.burst.x)
        );
        if (reached && !st.hit) {
          st.hit = true;
          st.hitT = s.t;
          sound?.play("radar");
        }
      });
      if (s.phaseT > 4.2) setSimPhase(s, "done");
    }

    s.particles = s.particles.filter((p) => {
      p.life -= dt * 1.5;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      return p.life > 0;
    });
    s.fragments = s.fragments.filter((f) => {
      f.life -= dt;
      f.vy += 60 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      return f.life > 0 && f.y < s.groundY;
    });

    liveAccRef.current += dt;
    if (liveAccRef.current > 0.1) {
      liveAccRef.current = 0;
      const dist = s.groundY - s.burst.y;
      setLive({
        alt: s.meteor ? s.meteor.alt : s.phase === "idle" ? MAX_ALT : burstAlt,
        vel: s.phase === "entry" ? velocity : 0,
        t: s.t,
        shock: s.shock ? clamp((s.shock.r / dist) * burstAlt, 0, burstAlt) : 0,
      });
    }
  }
  // ===== نهاية الجزء 1 — الجزء 2 يُلصق مباشرة بعد هذا السطر =====// ---------- الرسم ----------
  function draw() {
    const s = S.current;
    const c = canvasRef.current;
    if (!s || !c) return;
    const ctx = c.getContext("2d");
    const { W, H, groundY, topY } = s;

    // السماء
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#020614");
    sky.addColorStop(0.7, "#0a1230");
    sky.addColorStop(1, "#13224a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // النجوم
    s.stars.forEach((st) => {
      const a = 0.4 + Math.sin(s.t * 2 + st.tw) * 0.3;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // طبقات الغلاف الجوي
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1;
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    [
      [100, "خط كارمان 100 كم"],
      [50, "الستراتوسفير 50 كم"],
      [12, "التروبوسفير 12 كم"],
    ].forEach(([alt, label]) => {
      const y = altToY(alt, groundY, topY);
      ctx.strokeStyle = "rgba(120,160,255,0.18)";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(160,190,255,0.5)";
      ctx.fillText(label, 8, y - 4);
    });
    ctx.setLineDash([]);

    // خط ارتفاع الانفجار الحقيقي
    ctx.strokeStyle = `${color}55`;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(0, s.burst.y);
    ctx.lineTo(W, s.burst.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.textAlign = "right";
    ctx.fillText(`ارتفاع الانفجار ${burstAlt} كم (NASA)`, W - 8, s.burst.y - 4);

    // الأرض
    const ground = ctx.createLinearGradient(0, groundY, 0, H);
    ground.addColorStop(0, "#1d3b2a");
    ground.addColorStop(1, "#0b1a12");
    ctx.fillStyle = ground;
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.strokeStyle = "rgba(90,220,150,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();

    // الحلقات الزلزالية على الأرض
    s.seismic.forEach((ring) => {
      if (ring.r <= 0) return;
      ctx.strokeStyle = `rgba(90,220,150,${ring.alpha * 0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(ring.x, groundY, ring.r, ring.r * 0.18, 0, 0, Math.PI * 2);
      ctx.stroke();
    });

    // محطات الرصد
    s.stations.forEach((st) => {
      const active = st.hit;
      const pulse = active ? 1 + Math.sin((s.t - st.hitT) * 10) * 0.3 : 1;
      ctx.fillStyle = active ? "#5adc96" : "rgba(160,190,255,0.7)";
      ctx.beginPath();
      ctx.moveTo(st.x, groundY - 16 * pulse);
      ctx.lineTo(st.x - 6, groundY);
      ctx.lineTo(st.x + 6, groundY);
      ctx.closePath();
      ctx.fill();
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = active ? "#5adc96" : "rgba(160,190,255,0.6)";
      ctx.fillText(
        active ? `ST-${st.id} ● تسجيل` : `ST-${st.id}`,
        st.x,
        groundY + 16
      );
    });

    // ذيل الشهاب
    s.particles.forEach((p) => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.life > 0.6 ? "#fff3c4" : color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // الشهاب
    if (s.meteor) {
      const m = s.meteor;
      const r = 4 + diameter * 0.35 + m.heat * 3;
      const glow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r * 5);
      glow.addColorStop(0, `${color}cc`);
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(m.x, m.y, r * 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = m.heat > 0.5 ? "#fff8e6" : color;
      ctx.beginPath();
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // الشظايا
    s.fragments.forEach((f) => {
      ctx.globalAlpha = clamp(f.life, 0, 1);
      ctx.fillStyle = f.life > 0.8 ? "#ffe9b0" : color;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // موجة الضغط
    if (s.shock) {
      ctx.strokeStyle = `${color}aa`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.burst.x, s.burst.y, s.shock.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `${color}44`;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(s.burst.x, s.burst.y, s.shock.r * 0.9, 0, Math.PI * 2);
      ctx.stroke();
    }

    // الفلاش
    if (s.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${s.flash * 0.85})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- حلقة التحريك ----------
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05) * speedRef.current;
      last = now;
      update(dt);
      draw();
      if (S.current?.phase === "done") {
        setRunning(false);
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // إعادة الضبط عند تغيير الحدث أو حجم الشاشة
  useEffect(() => {
    setRunning(false);
    reset();
    const onResize = () => {
      if (S.current?.phase === "idle") reset();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  // ---------- أزرار التحكم ----------
  function launch() {
    if (!S.current || S.current.phase !== "idle") reset();
    setSimPhase(S.current, "entry");
    sound?.play("entry");
    setRunning(true);
  }

  function togglePause() {
    if (!S.current || S.current.phase === "idle" || S.current.phase === "done")
      return;
    setRunning((r) => !r);
    sound?.play("click");
  }

  function restart() {
    setRunning(false);
    reset();
    sound?.play("click");
  }

  const phaseIndex = PHASE_ORDER.indexOf(phase);

  return (
    <div className="simulation-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">ATMOSPHERIC ENTRY SIMULATION</span>
          <h3>
            محاكاة حدث {event?.date} — {event?.region}
          </h3>
        </div>
        <span className="phase-badge" style={{ borderColor: color, color }}>
          {PHASE_LABELS[phase]}
        </span>
      </div>

      <div className="canvas-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} />
        {phase === "idle" && (
          <button className="canvas-cta" onClick={launch}>
            ▶ إطلاق المحاكاة
          </button>
        )}
      </div>

      <div className="phase-track">
        {PHASE_ORDER.slice(0, 4).map((p, i) => (
          <div
            key={p}
            className={`phase-step ${i < phaseIndex ? "done" : ""} ${
              i === phaseIndex ? "active" : ""
            }`}
          >
            <span />
            <small>{PHASE_LABELS[p]}</small>
          </div>
        ))}
      </div>

      <div className="sim-controls">
        <button className="primary-button" onClick={launch}>
          {phase === "idle" ? "إطلاق" : "إعادة الإطلاق"}
        </button>
        <button
          className="secondary-button"
          onClick={togglePause}
          disabled={phase === "idle" || phase === "done"}
        >
          {running ? "إيقاف مؤقت" : "متابعة"}
        </button>
        <button className="secondary-button" onClick={restart}>
          إعادة ضبط
        </button>
        <div className="speed-control">
          <span>السرعة</span>
          {[0.5, 1, 2].map((v) => (
            <button
              key={v}
              className={speed === v ? "active" : ""}
              onClick={() => setSpeed(v)}
            >
              {v}x
            </button>
          ))}
        </div>
      </div>

      <div className="simulation-data">
        <div>
          <span>الارتفاع الحالي</span>
          <strong>{live.alt.toFixed(1)} كم</strong>
        </div>
        <div>
          <span>السرعة</span>
          <strong>{live.vel ? `${live.vel} كم/ث` : "—"}</strong>
        </div>
        <div>
          <span>الزمن</span>
          <strong>{live.t.toFixed(1)} ث</strong>
        </div>
        <div>
          <span>القطر التقديري</span>
          <strong>{diameter} م</strong>
        </div>
        <div>
          <span>الطاقة (NASA)</span>
          <strong>{event?.energy} kt</strong>
        </div>
        <div>
          <span>موجة الضغط</span>
          <strong>{live.shock ? `${live.shock.toFixed(0)} كم` : "—"}</strong>
        </div>
      </div>
    </div>
  );
}