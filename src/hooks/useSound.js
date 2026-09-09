import { useRef, useEffect, useCallback } from "react";

/**
 * أصوات مولّدة بالكامل بالكود عبر Web Audio API
 * مفيش أي ملفات صوت خارجية مطلوبة.
 *
 * الأصوات المتاحة:
 *  - click      : نقرة واجهة قصيرة
 *  - select     : اختيار حدث (نغمتين)
 *  - radar      : نبضة رادار
 *  - entry      : دخول الشهاب للغلاف الجوي (whoosh)
 *  - explosion  : الانفجار + موجة الضغط
 *  - alert      : إنذار متكرر
 *  - infrasound : الموجة تحت الصوتية (هزيم منخفض)
 */
export function useSound(enabled = true) {
  const ctxRef = useRef(null);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // إنشاء AudioContext عند أول تفاعل (المتصفحات تمنع التشغيل التلقائي)
  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  // ---------- أدوات مساعدة ----------

  function tone(ctx, { freq = 440, type = "sine", duration = 0.15, gain = 0.2, from, to, delay = 0 }) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const t0 = ctx.currentTime + delay;

    osc.type = type;
    osc.frequency.setValueAtTime(from ?? freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + duration);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  function noiseBuffer(ctx, seconds = 1) {
    const size = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function noise(ctx, { duration = 1, gain = 0.3, filterType = "lowpass", from = 200, to = 60, delay = 0, q = 1 }) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, duration + 0.1);

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = q;

    const g = ctx.createGain();
    const t0 = ctx.currentTime + delay;

    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(to, 20), t0 + duration);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    src.connect(filter).connect(g).connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + duration + 0.1);
  }

  // ---------- تعريف الأصوات ----------

  const sounds = {
    click(ctx) {
      tone(ctx, { freq: 880, type: "square", duration: 0.05, gain: 0.05 });
    },

    select(ctx) {
      tone(ctx, { freq: 520, type: "sine", duration: 0.09, gain: 0.12 });
      tone(ctx, { freq: 780, type: "sine", duration: 0.12, gain: 0.12, delay: 0.09 });
    },

    radar(ctx) {
      tone(ctx, { from: 1400, to: 400, type: "sine", duration: 0.35, gain: 0.08 });
    },

    entry(ctx) {
      // whoosh: ضجيج عالي التردد ينزل بسرعة + صفير خفيف
      noise(ctx, { duration: 1.6, gain: 0.35, filterType: "bandpass", from: 3000, to: 300, q: 0.8 });
      tone(ctx, { from: 1800, to: 120, type: "sawtooth", duration: 1.6, gain: 0.04 });
    },

    explosion(ctx) {
      // 1) الضربة الأولى: ضجيج قوي منخفض
      noise(ctx, { duration: 1.2, gain: 0.9, filterType: "lowpass", from: 900, to: 40 });
      // 2) الجسم العميق (sub bass)
      tone(ctx, { from: 110, to: 28, type: "sine", duration: 1.6, gain: 0.7 });
      // 3) الذيل: هزيم طويل يمثل موجة الضغط والصدى
      noise(ctx, { duration: 3.5, gain: 0.3, filterType: "lowpass", from: 300, to: 30, delay: 0.25 });
      // 4) رنين معدني خفيف بعد الانفجار
      tone(ctx, { from: 600, to: 180, type: "triangle", duration: 0.9, gain: 0.05, delay: 0.1 });
    },

    infrasound(ctx) {
      // موجة تحت صوتية: تردد شديد الانخفاض مع نبض
      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const g = ctx.createGain();
      const t0 = ctx.currentTime;

      osc.type = "sine";
      osc.frequency.value = 38; // قريب من حد السمع البشري
      lfo.type = "sine";
      lfo.frequency.value = 1.5;
      lfoGain.gain.value = 0.25;

      lfo.connect(lfoGain).connect(g.gain);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3);

      osc.connect(g).connect(ctx.destination);
      osc.start(t0);
      lfo.start(t0);
      osc.stop(t0 + 3.1);
      lfo.stop(t0 + 3.1);
    },

    alert(ctx) {
      for (let i = 0; i < 3; i++) {
        tone(ctx, { freq: 960, type: "square", duration: 0.12, gain: 0.07, delay: i * 0.22 });
        tone(ctx, { freq: 640, type: "square", duration: 0.12, gain: 0.07, delay: i * 0.22 + 0.11 });
      }
    },
  };

  const play = useCallback(
    (name) => {
      if (!enabledRef.current) return;
      const ctx = getCtx();
      if (!ctx || !sounds[name]) return;
      try {
        sounds[name](ctx);
      } catch (e) {
        console.warn("Sound error:", e);
      }
    },
    [getCtx]
  );

  // إغلاق الـ context عند إزالة المكوّن
  useEffect(() => {
    return () => {
      if (ctxRef.current && ctxRef.current.state !== "closed") {
        ctxRef.current.close();
      }
    };
  }, []);

  return { play, enabled };
}