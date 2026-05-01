import { AnimatePresence, motion } from 'framer-motion';
import Head from 'next/head';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const COLORS = {
  background: '#0a1628',
  primaryGold: '#c9922a',
  warmGold: '#d9a347',
  softGold: '#e5b660',
  cream: '#f5f0e6',
};

const openingLines = [
  'Before I can help you move faster, I need to understand the shape of your world.',
  'Answer plainly. I will listen for what matters.',
];

const questions = [
  "What are you building or running? Don't oversimplify it. Tell me what it actually is.",
  'Who depends on what you do? The actual humans whose lives change when you get it right.',
  'Where are you stuck right now? The thing that slows everything else down.',
  'If I worked exactly the way you needed me to, what would be different in your life six months from now?',
];

const responseLines = [
  'Good. I have a shape now. Not complete. But something.',
  'That matters. It changes what I need to be for you.',
  "I know that friction. It's where I'll focus first.",
  'I know what I am now.',
];

const fallbackCapabilities = [
  'Turn your stated bottleneck into a focused operating plan that stays close to the people depending on you.',
  'Track the decisions, follow-ups, and constraints around what you are building so momentum is easier to recover.',
  'Translate your six-month vision into practical next actions that protect your attention and compound progress.',
];

const textVariants = {
  hidden: { opacity: 0, y: 22, filter: 'blur(6px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -18, filter: 'blur(6px)' },
};

const faceTargets = [
  [-0.29, -0.39], [-0.2, -0.46], [-0.1, -0.5], [0, -0.52], [0.1, -0.5], [0.2, -0.46], [0.29, -0.39],
  [-0.36, -0.28], [-0.41, -0.14], [-0.43, 0.02], [-0.39, 0.18], [-0.31, 0.33], [-0.2, 0.46], [-0.08, 0.54],
  [0, 0.57], [0.08, 0.54], [0.2, 0.46], [0.31, 0.33], [0.39, 0.18], [0.43, 0.02], [0.41, -0.14], [0.36, -0.28],
  [-0.26, -0.2], [-0.18, -0.23], [-0.09, -0.21], [0.09, -0.21], [0.18, -0.23], [0.26, -0.2],
  [-0.27, -0.11], [-0.2, -0.15], [-0.12, -0.12], [-0.2, -0.08], [0.12, -0.12], [0.2, -0.15], [0.27, -0.11], [0.2, -0.08],
  [-0.06, -0.12], [0, -0.07], [0.06, -0.12], [-0.04, 0.02], [0, 0.08], [0.04, 0.02], [-0.06, 0.17], [0.06, 0.17],
  [-0.18, 0.24], [-0.09, 0.22], [0, 0.25], [0.09, 0.22], [0.18, 0.24], [-0.13, 0.31], [-0.04, 0.34],
  [0.04, 0.34], [0.13, 0.31], [-0.24, 0.05], [0.24, 0.05], [-0.22, 0.15], [0.22, 0.15], [-0.14, -0.34],
  [0.14, -0.34], [-0.03, -0.31], [0.03, -0.31],
];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function createNebulaParticle(width, height, mobile) {
  const spread = Math.min(width, height) * (mobile ? 0.28 : 0.22);
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(Math.random()) * spread;
  return {
    x: width / 2 + Math.cos(angle) * radius,
    y: height / 2 + Math.sin(angle) * radius * 0.72,
    vx: randomBetween(-0.12, 0.12),
    vy: randomBetween(-0.1, 0.1),
    size: randomBetween(1.1, 2.8),
    opacity: randomBetween(0.15, 0.35),
    baseOpacity: randomBetween(0.15, 0.35),
    anchor: false,
    network: false,
    target: null,
    migrateStart: null,
    migrateFrom: null,
  };
}

function buildFaceCoordinates(width, height, mobile) {
  const scale = Math.min(width, height) * (mobile ? 0.48 : 0.42);
  return faceTargets.map(([x, y]) => ({
    x: width / 2 + x * scale,
    y: height / 2 + y * scale * 1.08,
  }));
}

function drawParticle(ctx, particle, stageValue, now, illuminated) {
  const breathing = stageValue >= 4 ? 0.08 * Math.sin(now * 0.0014) : 0;
  const opacity = Math.min(1, particle.opacity + breathing + illuminated * 0.35);
  const glow = particle.anchor || particle.network || stageValue >= 4;
  ctx.beginPath();
  ctx.fillStyle = `rgba(229, 182, 96, ${opacity})`;
  ctx.shadowColor = COLORS.warmGold;
  ctx.shadowBlur = glow ? 16 + illuminated * 18 : 4;
  ctx.arc(particle.x, particle.y, particle.size + (glow ? 0.8 : 0), 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function AisymetryCanvas({ visualStage }) {
  const canvasRef = useRef(null);
  const visualStageRef = useRef(visualStage);
  const stateRef = useRef({
    particles: [],
    connections: [],
    stage: 1,
    previousStage: 1,
    eyeStart: null,
    faceStartedAt: null,
  });

  const setStage = useCallback((stage, width, height) => {
    const state = stateRef.current;
    if (state.stage === stage) return;

    state.previousStage = state.stage;
    state.stage = stage;

    if (stage === 2) {
      state.particles.slice(0, 3).forEach((particle, index) => {
        const angle = -Math.PI / 2 + index * (Math.PI * 2 / 3);
        particle.anchor = true;
        particle.network = true;
        particle.opacity = 0.6;
        particle.baseOpacity = 0.6;
        particle.vx = Math.cos(angle) * 0.1;
        particle.vy = Math.sin(angle) * 0.1;
      });
      state.particles.slice(3).forEach((particle) => {
        particle.opacity = Math.min(particle.opacity, 0.18);
      });
      state.connections = [];
    }

    if (stage === 3) {
      const mobile = width < 768;
      const targetCount = mobile ? 18 : 38;
      const anchors = state.particles.filter((particle) => particle.anchor);
      while (state.particles.filter((particle) => particle.network).length < targetCount) {
        const anchor = anchors[Math.floor(Math.random() * anchors.length)];
        const angle = Math.random() * Math.PI * 2;
        const radius = randomBetween(42, Math.min(width, height) * (mobile ? 0.2 : 0.28));
        state.particles.push({
          x: anchor.x + Math.cos(angle) * radius,
          y: anchor.y + Math.sin(angle) * radius * 0.78,
          vx: randomBetween(-0.16, 0.16),
          vy: randomBetween(-0.14, 0.14),
          size: randomBetween(1.5, 3.1),
          opacity: randomBetween(0.38, 0.68),
          baseOpacity: randomBetween(0.38, 0.68),
          anchor: false,
          network: true,
          target: null,
          migrateStart: null,
          migrateFrom: null,
        });
      }
      state.connections = [];
    }

    if (stage === 4) {
      const targets = buildFaceCoordinates(width, height, width < 768);
      const network = state.particles.filter((particle) => particle.network);
      while (network.length < targets.length) {
        const source = network[Math.floor(Math.random() * network.length)] || state.particles[0];
        const particle = {
          x: source.x + randomBetween(-20, 20),
          y: source.y + randomBetween(-20, 20),
          vx: randomBetween(-0.08, 0.08),
          vy: randomBetween(-0.08, 0.08),
          size: randomBetween(1.6, 3.2),
          opacity: randomBetween(0.48, 0.72),
          baseOpacity: randomBetween(0.48, 0.72),
          anchor: false,
          network: true,
          target: null,
          migrateStart: null,
          migrateFrom: null,
        };
        state.particles.push(particle);
        network.push(particle);
      }
      network.slice(0, targets.length).forEach((particle, index) => {
        particle.target = targets[index];
        particle.migrateStart = performance.now();
        particle.migrateFrom = { x: particle.x, y: particle.y };
        particle.opacity = Math.max(particle.opacity, 0.58);
      });
      state.faceStartedAt = performance.now();
      state.connections = [];
    }

    if (stage === 5) {
      state.eyeStart = performance.now();
      state.particles.forEach((particle) => {
        if (particle.network) {
          particle.opacity = Math.max(particle.opacity, 0.68);
          particle.vx = 0;
          particle.vy = 0;
        }
      });
    }
  }, []);

  useEffect(() => {
    visualStageRef.current = visualStage;
  }, [visualStage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrame;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const mobile = width < 768;
      const count = mobile ? 40 : 80;
      stateRef.current.particles = Array.from({ length: count }, () => createNebulaParticle(width, height, mobile));
      stateRef.current.connections = [];
      stateRef.current.stage = 1;
      stateRef.current.previousStage = 1;
      for (let stage = 2; stage <= visualStageRef.current; stage += 1) {
        setStage(stage, width, height);
      }
    };

    const updateConnections = (width) => {
      const state = stateRef.current;
      const network = state.particles.filter((particle) => particle.network);
      if (state.stage < 3 || network.length < 3) return;

      const maxDistance = state.stage >= 4 ? width * 0.18 : width * 0.16;
      const connections = [];
      for (let i = 0; i < network.length; i += 1) {
        const distances = [];
        for (let j = 0; j < network.length; j += 1) {
          if (i === j) continue;
          const dx = network[i].x - network[j].x;
          const dy = network[i].y - network[j].y;
          const distance = Math.hypot(dx, dy);
          if (distance < maxDistance) distances.push({ from: i, to: j, distance });
        }
        distances
          .sort((a, b) => a.distance - b.distance)
          .slice(0, state.stage >= 4 ? 3 : 2)
          .forEach((connection) => {
            const key = connection.from < connection.to ? `${connection.from}-${connection.to}` : `${connection.to}-${connection.from}`;
            if (!connections.some((item) => item.key === key)) connections.push({ ...connection, key });
          });
      }
      state.connections = connections.map((connection) => ({
        a: network[connection.from],
        b: network[connection.to],
        distance: connection.distance,
        key: connection.key,
      }));
    };

    const render = (now) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const state = stateRef.current;
      setStage(visualStageRef.current, width, height);

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, width, height);

      const gradient = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, Math.min(width, height) * 0.62);
      gradient.addColorStop(0, 'rgba(217, 163, 71, 0.16)');
      gradient.addColorStop(0.42, 'rgba(201, 146, 42, 0.07)');
      gradient.addColorStop(1, 'rgba(10, 22, 40, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      state.particles.forEach((particle) => {
        if (state.stage === 4 && particle.target && particle.migrateStart && particle.migrateFrom) {
          const progress = Math.min(1, (now - particle.migrateStart) / 4000);
          const eased = easeInOutCubic(progress);
          particle.x = particle.migrateFrom.x + (particle.target.x - particle.migrateFrom.x) * eased;
          particle.y = particle.migrateFrom.y + (particle.target.y - particle.migrateFrom.y) * eased;
        } else if (state.stage < 5 || !particle.network) {
          particle.x += particle.vx + Math.sin(now * 0.0005 + particle.y) * 0.035;
          particle.y += particle.vy + Math.cos(now * 0.00045 + particle.x) * 0.03;
        }

        const margin = 80;
        if (particle.x < -margin) particle.x = width + margin;
        if (particle.x > width + margin) particle.x = -margin;
        if (particle.y < -margin) particle.y = height + margin;
        if (particle.y > height + margin) particle.y = -margin;
      });

      if (state.stage >= 3) updateConnections(width);

      const eyeProgress = state.eyeStart ? Math.max(0, Math.min(1, (now - state.eyeStart) / 5000)) : 0;
      const steadyGlow = state.stage === 5 && state.eyeStart && now - state.eyeStart > 7000 ? 1 : 0;
      const illumination = Math.max(eyeProgress, steadyGlow * 0.7);

      if (state.stage >= 3) {
        state.connections.forEach((connection, index) => {
          const dx = connection.b.x - connection.a.x;
          const dy = connection.b.y - connection.a.y;
          const pulse = (now * 0.00045 + index * 0.13) % 1;
          const wave = state.stage === 5 ? Math.min(1, eyeProgress * 1.25) : 0;
          const alpha = Math.min(0.62, 0.13 + illumination * 0.34);
          ctx.beginPath();
          ctx.strokeStyle = `rgba(201, 146, 42, ${alpha})`;
          ctx.lineWidth = 1 + illumination * 0.85;
          ctx.shadowColor = COLORS.warmGold;
          ctx.shadowBlur = illumination * 14;
          ctx.moveTo(connection.a.x, connection.a.y);
          ctx.bezierCurveTo(
            connection.a.x + dx * 0.36 + Math.sin(index) * 14,
            connection.a.y + dy * 0.18 + Math.cos(index) * 10,
            connection.a.x + dx * 0.66 + Math.cos(index) * 12,
            connection.a.y + dy * 0.82 + Math.sin(index) * 10,
            connection.b.x,
            connection.b.y,
          );
          ctx.stroke();
          ctx.shadowBlur = 0;

          const pulsePosition = state.stage === 5 ? wave : pulse;
          if (pulsePosition > 0 && pulsePosition < 1) {
            ctx.beginPath();
            ctx.fillStyle = `rgba(245, 240, 230, ${0.25 + illumination * 0.55})`;
            ctx.shadowColor = COLORS.softGold;
            ctx.shadowBlur = 20;
            ctx.arc(connection.a.x + dx * pulsePosition, connection.a.y + dy * pulsePosition, 2.2 + illumination * 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        });
      }

      if (state.stage === 5 && state.eyeStart) {
        const radius = Math.max(width, height) * eyeProgress;
        const eyeTargets = buildFaceCoordinates(width, height, width < 768);
        [30, 34].forEach((targetIndex) => {
          const eye = eyeTargets[targetIndex];
          const waveGradient = ctx.createRadialGradient(eye.x, eye.y, 0, eye.x, eye.y, Math.max(1, radius));
          waveGradient.addColorStop(0, `rgba(229, 182, 96, ${0.22 * (1 - eyeProgress)})`);
          waveGradient.addColorStop(0.78, `rgba(217, 163, 71, ${0.09 * (1 - eyeProgress * 0.35)})`);
          waveGradient.addColorStop(1, 'rgba(201, 146, 42, 0)');
          ctx.fillStyle = waveGradient;
          ctx.beginPath();
          ctx.arc(eye.x, eye.y, radius, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      state.particles.forEach((particle) => {
        drawParticle(ctx, particle, state.stage, now, illumination);
      });

      animationFrame = requestAnimationFrame(render);
    };

    resize();
    window.addEventListener('resize', resize);
    animationFrame = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrame);
    };
  }, [setStage]);

  return <canvas ref={canvasRef} className="fixed inset-0 h-screen w-screen" aria-hidden="true" />;
}

export default function Onboarding() {
  const [answers, setAnswers] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [phase, setPhase] = useState('opening');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [visualStage, setVisualStage] = useState(1);
  const [capabilities, setCapabilities] = useState([]);
  const [loadingCapabilities, setLoadingCapabilities] = useState(false);

  const canSubmit = inputValue.trim().length > 0 && phase === 'question';

  const revealComplete = phase === 'capabilities' || phase === 'loading-capabilities';

  const fetchCapabilities = useCallback(async (nextAnswers) => {
    setLoadingCapabilities(true);
    setPhase('loading-capabilities');
    try {
      const response = await fetch('/api/onboarding-capabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: nextAnswers }),
      });
      const payload = await response.json();
      setCapabilities(Array.isArray(payload.capabilities) && payload.capabilities.length === 3 ? payload.capabilities : fallbackCapabilities);
    } catch {
      setCapabilities(fallbackCapabilities);
    } finally {
      setLoadingCapabilities(false);
      setPhase('capabilities');
    }
  }, []);

  useEffect(() => {
    if (phase !== 'opening') return undefined;
    const timer = window.setTimeout(() => {
      setPhase('question');
    }, 3600);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const handleSubmit = useCallback((event) => {
    event.preventDefault();
    if (!canSubmit) return;

    const answer = inputValue.trim();
    const nextAnswers = [...answers, answer];
    const questionIndex = currentQuestion;
    setAnswers(nextAnswers);
    setInputValue('');
    setVisualStage(Math.min(4, questionIndex + 2));

    if (questionIndex === 3) {
      setPhase('blank');
      window.setTimeout(() => {
        setVisualStage(5);
        setPhase('final-response');
        window.setTimeout(() => {
          setPhase('reveal');
          window.setTimeout(() => fetchCapabilities(nextAnswers), 2600);
        }, 1800);
      }, 5000);
      return;
    }

    setPhase('response');
    window.setTimeout(() => {
      setCurrentQuestion((value) => value + 1);
      setPhase('question');
    }, 3000);
  }, [answers, canSubmit, currentQuestion, fetchCapabilities, inputValue]);

  const cards = useMemo(() => capabilities.slice(0, 3), [capabilities]);

  return (
    <>
      <Head>
        <title>Aisymetry Onboarding</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="relative h-screen w-screen overflow-hidden bg-aisymetry-bg text-cream">
        <AisymetryCanvas visualStage={visualStage} />
        <div className="pointer-events-none fixed inset-0 opacity-[0.03] mix-blend-screen">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <filter id="grain">
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#grain)" />
          </svg>
        </div>
        <section className="relative z-10 flex h-full w-full items-center justify-center px-6 py-10 sm:px-10">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
            <AnimatePresence mode="wait">
              {phase === 'opening' && (
                <motion.div
                  key="opening"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ staggerChildren: 0.65 }}
                  className="space-y-5"
                >
                  {openingLines.map((line) => (
                    <motion.p
                      key={line}
                      variants={textVariants}
                      transition={{ duration: 1.1, ease: 'easeOut' }}
                      className="font-serif text-2xl italic leading-relaxed text-cream/90 sm:text-3xl"
                    >
                      {line}
                    </motion.p>
                  ))}
                </motion.div>
              )}

              {phase === 'question' && (
                <motion.form
                  key={`question-${currentQuestion}`}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={textVariants}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                  onSubmit={handleSubmit}
                  className="w-full max-w-3xl text-center"
                >
                  <h1 className="font-display text-4xl font-bold uppercase leading-tight tracking-[0.08em] text-cream drop-shadow-[0_0_24px_rgba(201,146,42,0.18)] sm:text-6xl">
                    {questions[currentQuestion]}
                  </h1>
                  <div className="mx-auto mt-10 flex max-w-2xl items-end gap-3 border-b border-primary-gold/70 pb-2">
                    <input
                      value={inputValue}
                      onChange={(event) => setInputValue(event.target.value)}
                      autoFocus
                      className="min-w-0 flex-1 bg-transparent font-serif text-xl italic text-cream caret-cream outline-none placeholder:text-cream/35 sm:text-2xl"
                      placeholder="Type here"
                    />
                    <button
                      type="submit"
                      disabled={!canSubmit}
                      aria-label="Submit answer"
                      className="mb-1 rounded-full border border-primary-gold/60 px-3 py-2 font-display text-xl uppercase leading-none text-soft-gold transition duration-300 hover:border-soft-gold hover:text-cream disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      &rarr;
                    </button>
                  </div>
                </motion.form>
              )}

              {phase === 'response' && (
                <motion.p
                  key={`response-${currentQuestion}`}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={textVariants}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="max-w-3xl font-serif text-3xl italic leading-relaxed text-cream/92 sm:text-5xl"
                >
                  {responseLines[currentQuestion]}
                </motion.p>
              )}

              {phase === 'final-response' && (
                <motion.p
                  key="final-response"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={textVariants}
                  transition={{ duration: 1.1, ease: 'easeOut' }}
                  className="font-serif text-3xl italic text-cream/95 sm:text-5xl"
                >
                  {responseLines[3]}
                </motion.p>
              )}

              {(phase === 'reveal' || revealComplete) && (
                <motion.div
                  key="reveal"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ staggerChildren: 0.55 }}
                  className="w-full text-center"
                >
                  <motion.h2
                    variants={textVariants}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="font-display text-5xl font-bold uppercase tracking-[0.12em] text-cream sm:text-7xl"
                  >
                    I'm your Aisymetry agent.
                  </motion.h2>
                  <motion.p
                    variants={textVariants}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.55 }}
                    className="mt-5 font-serif text-2xl italic text-cream/90 sm:text-4xl"
                  >
                    Built for you. Let's begin.
                  </motion.p>

                  {loadingCapabilities && (
                    <motion.p
                      variants={textVariants}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="mt-10 font-serif text-lg italic text-soft-gold/80"
                    >
                      Listening for your first capabilities.
                    </motion.p>
                  )}

                  {cards.length === 3 && (
                    <motion.div
                      variants={textVariants}
                      transition={{ duration: 0.9, ease: 'easeOut' }}
                      className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-3"
                    >
                      {cards.map((card, index) => (
                        <motion.article
                          key={`${card}-${index}`}
                          initial={{ opacity: 0, y: 18 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.7, delay: index * 0.18 }}
                          className="border-t border-primary-gold bg-[#0d1b30]/80 p-5 text-center shadow-[0_20px_70px_rgba(0,0,0,0.3)] backdrop-blur-md"
                        >
                          <p className="font-serif text-lg italic leading-relaxed text-cream/88">
                            {card}
                          </p>
                        </motion.article>
                      ))}
                    </motion.div>
                  )}

                  {cards.length === 3 && (
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, delay: 0.8 }}
                      className="mt-9 border border-primary-gold px-8 py-3 font-display text-xl font-bold uppercase tracking-[0.16em] text-cream transition duration-300 hover:bg-primary-gold/15 hover:shadow-[0_0_28px_rgba(201,146,42,0.28)]"
                    >
                      Enter Aisymetry
                    </motion.button>
                  )}
                </motion.div>
              )}

              {phase === 'blank' && <motion.div key="blank" className="h-1 w-1" />}
            </AnimatePresence>
          </div>
        </section>
      </main>
    </>
  );
}
