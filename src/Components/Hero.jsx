import { useEffect, useState } from "react";

const PIPELINE = [
  {
    step: "01",
    title: "جمع البيانات",
    icon: "📡",
    text: "أقمار NASA CNEOS ترصد الشهب، وشبكات USGS/IRIS تسجّل الزلازل، ومحطات CTBTO ترصد الموجات تحت الصوتية.",
    tags: ["NASA API", "USGS", "Infrasound"],
  },
  {
    step: "02",
    title: "الربط الزمني والمكاني",
    icon: "🔗",
    text: "نطابق توقيت ومكان كل شهاب مع الإشارات الزلزالية والصوتية المسجّلة في نفس اللحظة والنطاق الجغرافي.",
    tags: ["Time Matching", "Geo Correlation"],
  },
  {
    step: "03",
    title: "الذكاء الاصطناعي",
    icon: "🧠",
    text: "نموذج يتعلّم من الأحداث السابقة ليحدد تلقائيًا مكان الانفجار وارتفاعه وطاقته من الإشارات فقط.",
    tags: ["Regression", "Signal Analysis"],
  },
  {
    step: "04",
    title: "النتيجة والإنذار",
    icon: "🎯",
    text: "واجهة تعرض التوقع مقارنةً بالقيمة الحقيقية، مع محاكاة الحدث وإنذار مبكر للمناطق المتأثرة.",
    tags: ["Dashboard", "Early Warning"],
  },
];

const STATS = [
  { value: "900+", label: "شهاب مسجّل في قاعدة NASA" },
  { value: "440 kt", label: "طاقة انفجار تشيليابينسك 2013" },
  { value: "< 20 Hz", label: "تردد الموجات تحت الصوتية" },
  { value: "24/7", label: "رصد مستمر حول الأرض" },
];

const PROBLEMS = [
  {
    title: "الشهب لا تُرصد إلا بعد وقوعها",
    text: "معظم الأجسام الصغيرة (أقل من 20 مترًا) لا تراها التلسكوبات قبل دخولها الغلاف الجوي.",
  },
  {
    title: "الإشارات موجودة لكنها مبعثرة",
    text: "الزلازل والموجات تحت الصوتية تسجّل الانفجار فعلًا، لكن لا أحد يربطها آليًا بالشهب.",
  },
  {
    title: "التحليل يدوي وبطيء",
    text: "تحديد مكان وطاقة الانفجار يحتاج علماء وأيامًا من الحسابات، بينما الإنذار يحتاج دقائق.",
  },
];

export default function Hero({ onStart }) {
  const [activeStep, setActiveStep] = useState(0);

  // تحريك خطوات الـ Pipeline تلقائيًا
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((s) => (s + 1) % PIPELINE.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="hero-page">
      {/* ===== الجزء العلوي ===== */}
      <div className="hero-top">
        <div className="hero-text">
          <p className="eyebrow">NASA SPACE APPS CHALLENGE · TEAM PROJECT</p>
          <h1 className="hero-title">
            Meteor <span className="accent">Watch</span> AI
          </h1>
          <p className="hero-subtitle">
            نظام ذكي يرصد انفجارات الشهب في الغلاف الجوي عبر ربط بيانات NASA
            بالموجات الزلزالية وتحت الصوتية، ويحدد مكان الانفجار وطاقته تلقائيًا.
          </p>
          <p className="hero-inspiration">
            ✦ مستوحى من فكرة الباحث المصري في استخدام الإشارات الأرضية لرصد
            الأحداث الفضائية.
          </p>

          <div className="hero-actions">
            <button className="primary-button large" onClick={onStart}>
              ▶ ادخل مركز القيادة
            </button>
            <a
              className="secondary-button large"
              href="https://cneos.jpl.nasa.gov/fireballs/"
              target="_blank"
              rel="noreferrer"
            >
              مصدر البيانات — NASA CNEOS
            </a>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-earth">
            <div className="atmosphere" />
            <div className="hero-meteor">
              <div className="hero-meteor-tail" />
            </div>
            <div className="shockwave" />
            <div className="shockwave delay" />
            <div className="seismic-ring" />
            <div className="seismic-ring delay" />
          </div>
          <div className="hero-labels">
            <span className="label-chip">☄ شهاب</span>
            <span className="label-chip">〰 موجة تحت صوتية</span>
            <span className="label-chip">◎ إشارة زلزالية</span>
          </div>
        </div>
      </div>

      {/* ===== الإحصائيات ===== */}
      <div className="stats-row">
        {STATS.map((s) => (
          <div className="stat-card" key={s.label}>
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ===== المشكلة ===== */}
      <div className="section-block">
        <p className="eyebrow">THE PROBLEM</p>
        <h2>لماذا هذا المشروع مهم؟</h2>
        <div className="problem-grid">
          {PROBLEMS.map((p, i) => (
            <article className="problem-card" key={p.title}>
              <span className="problem-index">{i + 1}</span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </article>
          ))}
        </div>
      </div>

      {/* ===== الـ Pipeline ===== */}
      <div className="section-block">
        <p className="eyebrow">HOW IT WORKS</p>
        <h2>كيف يعمل النظام؟</h2>

        <div className="pipeline">
          {PIPELINE.map((p, i) => (
            <article
              key={p.step}
              className={`pipeline-card ${activeStep === i ? "active" : ""}`}
              onMouseEnter={() => setActiveStep(i)}
            >
              <div className="pipeline-head">
                <span className="pipeline-icon">{p.icon}</span>
                <span className="pipeline-step">{p.step}</span>
              </div>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
              <div className="tag-row">
                {p.tags.map((t) => (
                  <span className="tag" key={t}>
                    {t}
                  </span>
                ))}
              </div>
              {i < PIPELINE.length - 1 && (
                <span className="pipeline-arrow">←</span>
              )}
            </article>
          ))}
        </div>
      </div>

      {/* ===== الخلاصة ===== */}
      <div className="section-block closing">
        <p className="eyebrow">THE VISION</p>
        <h2>من رصد الشهاب إلى الإنذار المبكر</h2>
        <p className="page-description">
          الأرض مليئة بأجهزة استشعار تسجّل كل انفجار في السماء دون أن تدري. نحن
          نعلّم الذكاء الاصطناعي أن يسمع هذه الإشارات ويحوّلها إلى معلومة دقيقة
          في ثوانٍ: أين انفجر الشهاب، وبأي قوة، ومن يجب تحذيره.
        </p>
        <button className="primary-button large" onClick={onStart}>
          جرّب المحاكاة الآن
        </button>
      </div>
    </section>
  );
}