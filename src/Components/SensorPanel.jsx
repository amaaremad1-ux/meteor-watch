import { useEffect, useRef, useState } from "react";

const WINDOW = 8; // ثواني معروضة على الشاشة

const CHANNELS = [
  {
    id: "seismic",
    label: "الإشارة الزلزالية",
    source: "USGS / IRIS",
    unit: "μm/s",
    color: "#5adc96",
    freq: 5.5,
    decay: 0.55,
  },
  {
    id: "infra",
    label: "الموجة تحت الصوتية",
    source: "CTBTO IMS",
    unit: "Pa",
    color: "#53ddff",
    freq: 1.1,
    decay: 0.3,
  },
];

export default function SensorPanel({ explosion, event }) {
  const refs = useRef({});
  const startRef = useRef(null);
  const rafRef = useRef(null);
  const accRef = useRef(0);
  const [peaks, setPeaks] = useState({ seismic: 0, infra: 0 });
  const [status, setStatus] = useState("idle");

  const energy = event?.energyNum || 1;
  const altitude = event?.altitude || 30;

  // سعة الإشارة تزيد مع الطاقة (لوغاريتمي)
  const amp = Math.min(1, 0.22 + Math.log10(energy + 1) / 2.6);

  // زمن وصول تقريبي: الموجة الزلزالية أسرع من الصوتية
  const arrival = {
    seismic: +(altitude / 60).toFixed(1),
    infra: +(altitude / 0.34 / 60).toFixed(1),
  };

  useEffect(() => {
    if (explosion) {
      startRef.current = performance.now();
      setStatus("recording");
      setPeaks({ seismic: 0, infra: 0 });
    } else {
      startRef.current = null;
      setStatus("idle");
      setPeaks({ seismic: 0, infra: 0 });
    }
  }, [explosion]);

  function fit(canvas) {
    const wrap = canvas.parentElement;
    const w = wrap.clientWidth || 300;
    const h = 90;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== w * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return { w, h };
  }

  function signalAt(ch, ts, seed) {
    const noise =
      Math.sin(ts * 37 + seed) * 0.012 + Math.sin(ts * 91 + seed * 2) * 0.008;
    const start = arrival[ch.id];
    if (ts < start) return noise;
    const dt = ts - start;
    const envelope = Math.min(1, dt * 5) * Math.exp(-dt * ch.decay);
    const wave =
      Math.sin(dt * ch.freq * Math.PI * 2) * 0.7 +
      Math.sin(dt * ch.freq * 2.3 * Math.PI * 2) * 0.3;
    return noise + wave * envelope * amp;
  }

  function drawChannel(ch, tNow, seed) {
    const canvas = refs.current[ch.id];
    if (!canvas) return 0;
    const { w, h } = fit(canvas);
    const ctx = canvas.getContext("2d");
    const mid = h / 2;

    ctx.fillStyle = "rgba(4,10,26,0.95)";
    ctx.fillRect(0, 0, w, h);

    // شبكة
    ctx.strokeStyle = "rgba(120,160,255,0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += w / 8) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.strokeStyle = "rgba(120,160,255,0.2)";
    ctx.stroke();

    // خط وصول الإشارة
    if (tNow !== null) {
      const xArr = w - ((tNow - arrival[ch.id]) / WINDOW) * w;
      if (xArr > 0 && xArr < w) {
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = `${ch.color}66`;
        ctx.beginPath();
        ctx.moveTo(xArr, 0);
        ctx.lineTo(xArr, h);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // الموجة
    let peak = 0;
    ctx.strokeStyle = ch.color;
    ctx.lineWidth = 1.6;
    ctx.shadowColor = ch.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      const ts =
        tNow === null
          ? -100 + (x / w) * WINDOW + seed
          : tNow - ((w - x) / w) * WINDOW;
      const v =
        tNow === null ? Math.sin(ts * 37) * 0.012 : signalAt(ch, ts, seed);
      peak = Math.max(peak, Math.abs(v));
      const y = mid - v * (h * 0.46);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    return peak;
  }

  useEffect(() => {
    const seed = Math.random() * 10;
    let last = performance.now();
    const loop = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      const t = startRef.current ? (now - startRef.current) / 1000 : null;

      const p = {};
      CHANNELS.forEach((ch) => (p[ch.id] = drawChannel(ch, t, seed)));

      accRef.current += dt;
      if (accRef.current > 0.2) {
        accRef.current = 0;
        if (t !== null) {
          setPeaks((old) => ({
            seismic: Math.max(old.seismic, p.seismic),
            infra: Math.max(old.infra, p.infra),
          }));
          if (t > 12) setStatus("done");
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, amp]);

  const STATUS = {
    idle: { text: "في انتظار حدث", cls: "" },
    recording: { text: "● تسجيل مباشر", cls: "live" },
    done: { text: "✓ تم التسجيل", cls: "done" },
  };

  return (
    <div className="sensor-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">GROUND SENSOR NETWORK</span>
          <h3>الإشارات الأرضية</h3>
        </div>
        <span className={`sensor-status ${STATUS[status].cls}`}>
          {STATUS[status].text}
        </span>
      </div>

      {CHANNELS.map((ch) => (
        <div className="channel" key={ch.id}>
          <div className="channel-meta">
            <div>
              <strong style={{ color: ch.color }}>{ch.label}</strong>
              <small>{ch.source}</small>
            </div>
            <div className="channel-values">
              <span>
                الذروة{" "}
                <b>
                  {(peaks[ch.id] * (ch.id === "seismic" ? 320 : 18)).toFixed(1)}{" "}
                  {ch.unit}
                </b>
              </span>
              <span>
                وصول <b>+{arrival[ch.id]} ث</b>
              </span>
            </div>
          </div>
          <div className="channel-canvas">
            <canvas ref={(el) => (refs.current[ch.id] = el)} />
          </div>
        </div>
      ))}

      <p className="sensor-note">
        الفرق الزمني بين وصول الإشارتين هو ما يستخدمه النموذج لحساب ارتفاع
        ومكان الانفجار.
      </p>
    </div>
  );
}