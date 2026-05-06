import Head from "next/head";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import Lenis from "lenis";
import { AnimatePresence, motion } from "framer-motion";
import { Barlow_Condensed, Fraunces } from "next/font/google";

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-barlow-condensed",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: "700",
  style: "italic",
  variable: "--font-fraunces",
});

const COLORS = {
  background: "#0a1628",
  primaryGold: "#c9922a",
  warmGold: "#d9a347",
  softGold: "#e5b660",
  cream: "#f5f0e6",
};

const DESKTOP_PARTICLE_COUNT = 150;
const MOBILE_PARTICLE_COUNT = 82;
const FACE_POINT_COUNT = 90;
const NETWORK_NODE_COUNT = 63;
const MAX_LINES = 260;
const QUESTION_GATES = [0.18, 0.3, 0.54, 0.76];

const fallbackCapabilities = [
  {
    headline: "Map The Work",
    body: "I will turn what you are building into a living operating map. Your agent is ready.",
  },
  {
    headline: "Protect The Humans",
    body: "I will keep the people who depend on you visible in every decision. Your agent is ready.",
  },
  {
    headline: "Clear The Friction",
    body: "I will focus first where momentum is slowing down. Your agent is ready.",
  },
];

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function getQuestionGateIndex(progress, submittedAnswers) {
  return QUESTION_GATES.findIndex((gate, index) => progress >= gate && !submittedAnswers[index]);
}

const vertexShader = `
  attribute float aSize;
  attribute float aSeed;
  attribute float aFrequency;
  attribute float aWarmth;
  attribute float aOpacity;
  attribute float aEmphasis;
  attribute float aEye;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uBreathStrength;
  uniform float uEyeGlow;

  varying float vDepth;
  varying float vBreath;
  varying float vWarmth;
  varying float vOpacity;
  varying float vEmphasis;
  varying float vEye;

  void main() {
    vec3 transformed = position;

    float localDrift = sin(uTime * 0.11 + aSeed * 6.28318530718) * 0.035 * uBreathStrength;
    transformed.x += localDrift * (0.35 + aWarmth);
    transformed.y += cos(uTime * 0.09 + aSeed * 4.7) * 0.025 * uBreathStrength;

    vec4 modelViewPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * modelViewPosition;

    float cameraDepth = clamp((-modelViewPosition.z - 3.0) / 7.0, 0.0, 1.0);
    float depthScale = mix(1.44, 0.72, cameraDepth);
    float breath = 0.5 + 0.5 * sin(uTime * aFrequency + aSeed * 12.5663706144);
    float eyeScale = 1.0 + aEye * uEyeGlow * 1.3;
    float breathScale = 1.0 + breath * 0.12 * uBreathStrength;

    gl_PointSize = aSize * (1.0 + aEmphasis * 1.25) * eyeScale * depthScale * breathScale * uPixelRatio * 42.0 / -modelViewPosition.z;

    vDepth = cameraDepth;
    vBreath = breath;
    vWarmth = aWarmth;
    vOpacity = aOpacity;
    vEmphasis = aEmphasis;
    vEye = aEye;
  }
`;

const fragmentShader = `
  precision highp float;

  uniform vec3 uPrimaryGold;
  uniform vec3 uSoftGold;
  uniform float uEyeGlow;

  varying float vDepth;
  varying float vBreath;
  varying float vWarmth;
  varying float vOpacity;
  varying float vEmphasis;
  varying float vEye;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float radius = length(uv);
    float core = 1.0 - smoothstep(0.0, 0.2, radius);
    float glow = 1.0 - smoothstep(0.03, 0.5, radius);

    if (glow <= 0.0) {
      discard;
    }

    vec3 color = mix(uPrimaryGold, uSoftGold, vWarmth);
    color += color * vEye * pow(uEyeGlow, 2.4) * 1.35;
    float depthOpacity = mix(1.0, 0.52, vDepth);
    float breathOpacity = 0.06 + vBreath * 0.12;
    float alpha = (glow * 0.8 + core * 0.55) * (depthOpacity + breathOpacity + vEmphasis * 0.2) * vOpacity;

    gl_FragColor = vec4(color, alpha);
  }
`;

const lineVertexShader = `
  attribute float aAlong;
  attribute float aLineOpacity;
  attribute float aPulseOffset;
  attribute float aPulseSpeed;

  varying float vAlong;
  varying float vLineOpacity;
  varying float vPulseOffset;
  varying float vPulseSpeed;

  void main() {
    vAlong = aAlong;
    vLineOpacity = aLineOpacity;
    vPulseOffset = aPulseOffset;
    vPulseSpeed = aPulseSpeed;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const lineFragmentShader = `
  precision highp float;

  uniform vec3 uLineGold;
  uniform float uTime;
  uniform float uSurge;

  varying float vAlong;
  varying float vLineOpacity;
  varying float vPulseOffset;
  varying float vPulseSpeed;

  void main() {
    float pulseHead = fract(uTime * vPulseSpeed + vPulseOffset + uSurge);
    float pulse = smoothstep(pulseHead - 0.18, pulseHead, vAlong) - smoothstep(pulseHead, pulseHead + 0.18, vAlong);
    float alpha = vLineOpacity * (0.62 + pulse * 1.4 + uSurge * 0.55);
    gl_FragColor = vec4(uLineGold, alpha);
  }
`;

function easeInOutCubic(value) {
  const t = Math.max(0, Math.min(1, value));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function smoothRange(start, end, value) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function makeFaceTargets(isMobile) {
  const scale = isMobile ? 0.86 : 1;
  const targets = [];
  const add = (region, points) => {
    points.forEach((point) => targets.push({ region, x: point[0] * scale, y: point[1] * scale, z: point[2] * scale }));
  };

  add("hairline", [
    [-1.55, 1.72, -0.08], [-1.18, 1.95, 0.03], [-0.78, 2.1, 0.1], [-0.36, 2.18, 0.14], [0, 2.2, 0.16],
    [0.36, 2.18, 0.14], [0.78, 2.1, 0.1], [1.18, 1.95, 0.03], [1.55, 1.72, -0.08], [0, 1.82, 0.24],
  ]);
  add("brow", [
    [-1.16, 0.95, 0.18], [-0.83, 1.07, 0.22], [-0.48, 1.03, 0.28], [-0.18, 0.93, 0.32],
    [0.18, 0.93, 0.32], [0.48, 1.03, 0.28], [0.83, 1.07, 0.22], [1.16, 0.95, 0.18],
  ]);
  add("leftEye", [
    [-1.02, 0.56, 0.38], [-0.82, 0.67, 0.42], [-0.58, 0.66, 0.45], [-0.4, 0.54, 0.4], [-0.58, 0.43, 0.48],
    [-0.82, 0.43, 0.45], [-0.72, 0.55, 0.62], [-0.93, 0.55, 0.52], [-0.5, 0.55, 0.54], [-0.72, 0.31, 0.35],
  ]);
  add("rightEye", [
    [1.02, 0.56, 0.38], [0.82, 0.67, 0.42], [0.58, 0.66, 0.45], [0.4, 0.54, 0.4], [0.58, 0.43, 0.48],
    [0.82, 0.43, 0.45], [0.72, 0.55, 0.62], [0.93, 0.55, 0.52], [0.5, 0.55, 0.54], [0.72, 0.31, 0.35],
  ]);
  add("cheek", [
    [-1.36, 0.2, 0.08], [-1.08, 0.0, 0.26], [-0.78, -0.12, 0.36], [-0.42, -0.05, 0.42],
    [0.42, -0.05, 0.42], [0.78, -0.12, 0.36], [1.08, 0.0, 0.26], [1.36, 0.2, 0.08],
  ]);
  add("nose", [
    [0, 0.78, 0.5], [-0.12, 0.48, 0.58], [0.12, 0.48, 0.58], [-0.08, 0.18, 0.68],
    [0.08, 0.18, 0.68], [-0.2, -0.08, 0.54], [0.2, -0.08, 0.54], [0, -0.16, 0.68],
  ]);
  add("upperLip", [
    [-0.48, -0.58, 0.42], [-0.24, -0.5, 0.53], [0, -0.56, 0.62], [0.24, -0.5, 0.53], [0.48, -0.58, 0.42], [0, -0.42, 0.52],
  ]);
  add("lowerChin", [
    [-0.58, -0.82, 0.32], [-0.3, -0.92, 0.44], [0, -0.98, 0.5], [0.3, -0.92, 0.44], [0.58, -0.82, 0.32],
    [-0.48, -1.25, 0.18], [-0.18, -1.43, 0.26], [0.18, -1.43, 0.26], [0.48, -1.25, 0.18], [0, -1.58, 0.12],
  ]);
  add("jaw", [
    [-1.68, 0.64, -0.12], [-1.74, 0.22, -0.05], [-1.58, -0.28, 0], [-1.3, -0.78, 0.04], [-0.9, -1.24, 0.08],
    [0.9, -1.24, 0.08], [1.3, -0.78, 0.04], [1.58, -0.28, 0], [1.74, 0.22, -0.05], [1.68, 0.64, -0.12],
  ]);
  add("neck", [
    [-0.72, -1.72, -0.08], [-0.46, -1.88, 0], [-0.24, -2.12, 0.04], [0, -2.22, 0.06], [0.24, -2.12, 0.04],
    [0.46, -1.88, 0], [0.72, -1.72, -0.08], [-0.98, -2.34, -0.2], [0, -2.44, -0.08], [0.98, -2.34, -0.2],
  ]);

  return isMobile ? targets.filter((_, index) => index % 2 === 0).slice(0, 50) : targets;
}

function createParticleData(isMobile) {
  const count = isMobile ? MOBILE_PARTICLE_COUNT : DESKTOP_PARTICLE_COUNT;
  const faceTargets = makeFaceTargets(isMobile);
  const anchors = [
    new THREE.Vector3(-1.75, 0.58, 0.2),
    new THREE.Vector3(1.52, 0.24, -0.18),
    new THREE.Vector3(-0.28, -1.12, 0.36),
  ];
  const start = [];
  const network = [];
  const face = [];
  const sourceAnchor = [];
  const eye = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const radius = Math.pow(Math.random(), 0.58);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    start.push(new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * radius * 4.25,
      Math.sin(phi) * Math.sin(theta) * radius * 2.05 + Math.sin(theta * 2) * 0.18,
      Math.cos(phi) * radius * 3.1 - 1.1,
    ));

    if (i < 3) {
      sourceAnchor.push(i);
      network.push(anchors[i].clone());
    } else if (i < NETWORK_NODE_COUNT) {
      const anchorIndex = (i - 3) % 3;
      const ring = Math.floor((i - 3) / 3);
      const angle = ring * 0.82 + anchorIndex * 2.1;
      const spread = 0.35 + ((ring % 7) / 7) * 1.05;
      sourceAnchor.push(anchorIndex);
      network.push(new THREE.Vector3(
        anchors[anchorIndex].x + Math.cos(angle) * spread + (Math.random() - 0.5) * 0.5,
        anchors[anchorIndex].y + Math.sin(angle * 0.9) * spread * 0.68 + (Math.random() - 0.5) * 0.4,
        anchors[anchorIndex].z + Math.sin(angle * 1.7) * 0.45,
      ));
    } else {
      sourceAnchor.push(i % 3);
      network.push(start[i].clone().multiplyScalar(0.82));
    }

    const target = faceTargets[i % faceTargets.length];
    face.push(new THREE.Vector3(target.x, target.y, target.z));
    if (target.region === "leftEye" || target.region === "rightEye") {
      eye[i] = 1;
    }
  }

  return { count, anchors, start, network, face, sourceAnchor, eye, faceTargetCount: faceTargets.length };
}

function makeParticleGeometry(data) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(data.count * 3);
  const sizes = new Float32Array(data.count);
  const seeds = new Float32Array(data.count);
  const frequencies = new Float32Array(data.count);
  const warmth = new Float32Array(data.count);
  const opacity = new Float32Array(data.count);
  const emphasis = new Float32Array(data.count);

  for (let i = 0; i < data.count; i += 1) {
    positions[i * 3] = data.start[i].x;
    positions[i * 3 + 1] = data.start[i].y;
    positions[i * 3 + 2] = data.start[i].z;
    sizes[i] = 0.5 + Math.random() * 2.0;
    seeds[i] = Math.random();
    frequencies[i] = 0.35 + Math.random() * 0.75;
    warmth[i] = Math.random();
    opacity[i] = 1;
    emphasis[i] = 0;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute("aFrequency", new THREE.BufferAttribute(frequencies, 1));
  geometry.setAttribute("aWarmth", new THREE.BufferAttribute(warmth, 1));
  geometry.setAttribute("aOpacity", new THREE.BufferAttribute(opacity, 1));
  geometry.setAttribute("aEmphasis", new THREE.BufferAttribute(emphasis, 1));
  geometry.setAttribute("aEye", new THREE.BufferAttribute(data.eye, 1));

  return geometry;
}

function makeLineGeometry() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(MAX_LINES * 2 * 3);
  const along = new Float32Array(MAX_LINES * 2);
  const opacity = new Float32Array(MAX_LINES * 2);
  const pulseOffset = new Float32Array(MAX_LINES * 2);
  const pulseSpeed = new Float32Array(MAX_LINES * 2);

  for (let i = 0; i < MAX_LINES; i += 1) {
    along[i * 2] = 0;
    along[i * 2 + 1] = 1;
    const offset = Math.random();
    const speed = 0.12 + Math.random() * 0.18;
    pulseOffset[i * 2] = offset;
    pulseOffset[i * 2 + 1] = offset;
    pulseSpeed[i * 2] = speed;
    pulseSpeed[i * 2 + 1] = speed;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aAlong", new THREE.BufferAttribute(along, 1));
  geometry.setAttribute("aLineOpacity", new THREE.BufferAttribute(opacity, 1));
  geometry.setAttribute("aPulseOffset", new THREE.BufferAttribute(pulseOffset, 1));
  geometry.setAttribute("aPulseSpeed", new THREE.BufferAttribute(pulseSpeed, 1));

  return geometry;
}

function writeLine(lineIndex, positions, opacity, a, b, draw, alpha) {
  const clampedDraw = Math.max(0, Math.min(1, draw));
  const basePosition = lineIndex * 6;
  const baseOpacity = lineIndex * 2;
  positions[basePosition] = a.x;
  positions[basePosition + 1] = a.y;
  positions[basePosition + 2] = a.z;
  positions[basePosition + 3] = mix(a.x, b.x, clampedDraw);
  positions[basePosition + 4] = mix(a.y, b.y, clampedDraw);
  positions[basePosition + 5] = mix(a.z, b.z, clampedDraw);
  opacity[baseOpacity] = alpha;
  opacity[baseOpacity + 1] = alpha;
}

function clearLines(fromIndex, positions, opacity) {
  for (let i = fromIndex; i < MAX_LINES; i += 1) {
    const p = i * 6;
    const o = i * 2;
    positions[p] = 0;
    positions[p + 1] = 0;
    positions[p + 2] = 0;
    positions[p + 3] = 0;
    positions[p + 4] = 0;
    positions[p + 5] = 0;
    opacity[o] = 0;
    opacity[o + 1] = 0;
  }
}

function collectNearestEdges(points, count, perParticle) {
  const edges = [];
  const seen = new Set();

  for (let i = 0; i < count; i += 1) {
    const nearest = [];
    for (let j = 0; j < count; j += 1) {
      if (i === j) {
        continue;
      }
      const distance = points[i].distanceToSquared(points[j]);
      nearest.push([j, distance]);
    }
    nearest.sort((a, b) => a[1] - b[1]);
    nearest.slice(0, perParticle).forEach(([j]) => {
      const a = Math.min(i, j);
      const b = Math.max(i, j);
      const key = `${a}:${b}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([a, b]);
      }
    });
  }

  return edges.slice(0, MAX_LINES);
}

function NebulaCanvas({ progressRef, pulseRef }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return undefined;
    }

    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const data = createParticleData(isMobile);
    const livePositions = Array.from({ length: data.count }, () => new THREE.Vector3());

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(COLORS.background, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.background);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0.42, 8.6);
    camera.rotation.x = THREE.MathUtils.degToRad(-5);

    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = 256;
    glowCanvas.height = 256;
    const context = glowCanvas.getContext("2d");
    const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, "rgba(229, 182, 96, 0.5)");
    gradient.addColorStop(0.36, "rgba(201, 146, 42, 0.22)");
    gradient.addColorStop(1, "rgba(10, 22, 40, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);

    const glowTexture = new THREE.CanvasTexture(glowCanvas);
    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: new THREE.Color(COLORS.primaryGold),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Sprite(glowMaterial);
    glow.position.set(0, 0, -2.2);
    glow.scale.set(8.2, 5.4, 1);
    scene.add(glow);

    const geometry = makeParticleGeometry(data);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uPrimaryGold: { value: new THREE.Color(COLORS.primaryGold) },
        uSoftGold: { value: new THREE.Color(COLORS.softGold) },
        uBreathStrength: { value: 1 },
        uEyeGlow: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(geometry, material);
    particles.rotation.x = THREE.MathUtils.degToRad(5);
    scene.add(particles);

    const lineGeometry = makeLineGeometry();
    const lineMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSurge: { value: 0 },
        uLineGold: { value: new THREE.Color(COLORS.primaryGold) },
      },
      vertexShader: lineVertexShader,
      fragmentShader: lineFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lines);

    let lastFrameTime = performance.now() / 1000;
    let elapsedTime = 0;
    let animationFrame = 0;
    let frameCount = 0;
    let lowFrameCount = 0;
    let disableParallax = reduceMotion;
    let surge = 0;
    let lastPulse = pulseRef.current;
    let cursorTargetX = 0;
    let cursorTargetY = 0;
    let cursorX = 0;
    let cursorY = 0;
    let latestEdges = [];

    const positionAttribute = geometry.getAttribute("position");
    const opacityAttribute = geometry.getAttribute("aOpacity");
    const emphasisAttribute = geometry.getAttribute("aEmphasis");
    const linePositionAttribute = lineGeometry.getAttribute("position");
    const lineOpacityAttribute = lineGeometry.getAttribute("aLineOpacity");

    const updateParticles = (pageProgress, elapsed) => {
      const positions = positionAttribute.array;
      const opacities = opacityAttribute.array;
      const emphases = emphasisAttribute.array;
      const stageOne = Math.min(pageProgress / 0.2, 1);
      const stageTwo = Math.max(0, Math.min(1, (pageProgress - 0.2) / 0.2));
      const stageThree = Math.max(0, Math.min(1, (pageProgress - 0.4) / 0.2));
      const stageFour = Math.max(0, Math.min(1, (pageProgress - 0.6) / 0.2));
      const stageFive = Math.max(0, Math.min(1, (pageProgress - 0.8) / 0.2));

      for (let i = 0; i < data.count; i += 1) {
        const start = data.start[i];
        const network = data.network[i];
        const face = data.face[i];
        const source = data.anchors[data.sourceAnchor[i]];
        let x = start.x;
        let y = start.y;
        let z = start.z;
        let opacity = 1;
        let emphasis = 0;

        if (pageProgress < 0.2) {
          opacity = mix(0.85, 1, stageOne);
        } else if (pageProgress < 0.4) {
          const separation = easeInOutCubic(Math.min(stageTwo / 0.3, 1));
          if (i < 3) {
            x = mix(start.x, network.x, separation);
            y = mix(start.y, network.y, separation);
            z = mix(start.z, network.z, separation);
            opacity = mix(1, 1.25, separation);
            emphasis = separation;
          } else {
            opacity = mix(0.65, 0.12, separation);
          }
        } else if (pageProgress < 0.6) {
          if (i < NETWORK_NODE_COUNT) {
            const delay = i < 3 ? 0 : ((i - 3) % 20) * 0.018;
            const spawn = i < 3 ? 1 : easeInOutCubic(Math.max(0, Math.min(1, (stageThree - delay) / 0.58)));
            x = mix(source.x, network.x, spawn);
            y = mix(source.y, network.y, spawn) + Math.sin(spawn * Math.PI) * (0.22 + (i % 5) * 0.03);
            z = mix(source.z, network.z, spawn);
            opacity = i < 3 ? 1.22 : mix(0, 0.82, spawn);
            emphasis = i < 3 ? 0.9 : 0.18 * spawn;
          } else {
            opacity = 0.1;
          }
        } else {
          const migration = easeInOutCubic(stageFour);
          const holding = stageFive > 0 ? 1 : migration;
          if (i < data.faceTargetCount) {
            const from = i < NETWORK_NODE_COUNT ? network : start;
            const arc = Math.sin(holding * Math.PI) * (0.52 + (i % 7) * 0.035);
            x = mix(from.x, face.x, holding);
            y = mix(from.y, face.y, holding) + arc;
            z = mix(from.z, face.z, holding);
            opacity = mix(0.78, 1.05, holding);
            emphasis = data.eye[i] ? mix(0.22, 0.82, stageFive) : 0.18;
          } else {
            const drift = Math.sin(elapsed * 0.04 + i) * 0.1;
            x = start.x * 0.9 + drift;
            y = start.y * 0.9;
            z = start.z - 0.5;
            opacity = mix(0.08, 0.04, stageFive);
          }
        }

        const breathe = pageProgress >= 0.6 && pageProgress < 0.8 ? Math.sin(elapsed * 1.57079632679 + i * 0.17) * 0.018 : 0;
        x += Math.sin(elapsed * 0.07 + i) * 0.018 * material.uniforms.uBreathStrength.value;
        y += breathe;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        opacities[i] = opacity;
        emphases[i] = emphasis;
        livePositions[i].set(x, y, z);
      }

      material.uniforms.uEyeGlow.value = Math.pow(smoothRange(0.15, 0.35, stageFive), 2.1);
      material.uniforms.uBreathStrength.value = pageProgress > 0.8 ? mix(0, 0.12, smoothRange(0.62, 1, stageFive)) : 1;
      positionAttribute.needsUpdate = true;
      opacityAttribute.needsUpdate = true;
      emphasisAttribute.needsUpdate = true;
    };

    const updateLines = (pageProgress) => {
      const linePositions = linePositionAttribute.array;
      const lineOpacity = lineOpacityAttribute.array;
      let lineIndex = 0;
      const stageThree = Math.max(0, Math.min(1, (pageProgress - 0.4) / 0.2));
      const stageFour = Math.max(0, Math.min(1, (pageProgress - 0.6) / 0.2));
      const stageFive = Math.max(0, Math.min(1, (pageProgress - 0.8) / 0.2));

      if (pageProgress >= 0.4 && pageProgress < 0.6) {
        latestEdges = collectNearestEdges(livePositions, NETWORK_NODE_COUNT, isMobile ? 2 : 3);
        latestEdges.forEach(([a, b], edgeIndex) => {
          const draw = Math.max(0, Math.min(1, stageThree * 1.35 - edgeIndex * 0.006));
          const alpha = mix(0.15, 0.25, (edgeIndex % 5) / 5) * draw;
          writeLine(lineIndex, linePositions, lineOpacity, livePositions[a], livePositions[b], draw, alpha);
          lineIndex += 1;
        });
      } else if (pageProgress >= 0.6) {
        const perParticle = isMobile ? 2 : 3;
        latestEdges = collectNearestEdges(livePositions, data.faceTargetCount, perParticle);
        latestEdges.forEach(([a, b], edgeIndex) => {
          const draw = pageProgress < 0.8 ? smoothRange(0, 0.25, stageFour) : 1;
          const eyeBoost = data.eye[a] || data.eye[b] ? smoothRange(0.15, 0.35, stageFive) * 0.16 : 0;
          const alpha = Math.min(0.3, mix(0.15, 0.24, (edgeIndex % 7) / 7) + eyeBoost);
          writeLine(lineIndex, linePositions, lineOpacity, livePositions[a], livePositions[b], draw, alpha);
          lineIndex += 1;
        });
      }

      clearLines(lineIndex, linePositions, lineOpacity);
      linePositionAttribute.needsUpdate = true;
      lineOpacityAttribute.needsUpdate = true;
    };

    const pointerMove = (event) => {
      if (disableParallax || isMobile) {
        return;
      }
      cursorTargetX = ((event.clientX / window.innerWidth) - 0.5) * -0.16;
      cursorTargetY = ((event.clientY / window.innerHeight) - 0.5) * -0.16;
    };

    window.addEventListener("pointermove", pointerMove);

    const render = () => {
      const currentFrameTime = performance.now() / 1000;
      const delta = Math.min(0.1, currentFrameTime - lastFrameTime);
      lastFrameTime = currentFrameTime;
      elapsedTime += delta;
      const elapsed = elapsedTime;
      if (delta > 1 / 45) {
        lowFrameCount += 1;
        if (lowFrameCount > 30) {
          disableParallax = true;
        }
      }

      const pageProgress = progressRef.current;
      const stageFour = Math.max(0, Math.min(1, (pageProgress - 0.6) / 0.2));
      const stageFive = Math.max(0, Math.min(1, (pageProgress - 0.8) / 0.2));
      material.uniforms.uTime.value = elapsed;
      lineMaterial.uniforms.uTime.value = elapsed;
      if (pulseRef.current !== lastPulse) {
        surge = 1;
        lastPulse = pulseRef.current;
      }
      surge = Math.max(0, surge - delta * 0.7);
      lineMaterial.uniforms.uSurge.value = surge;
      updateParticles(pageProgress, elapsed);
      if (frameCount % (isMobile ? 3 : 2) === 0) {
        updateLines(pageProgress);
      }

      cursorX += (cursorTargetX - cursorX) * 0.05;
      cursorY += (cursorTargetY - cursorY) * 0.05;
      particles.position.set(cursorX * 5.5, cursorY * 3.2, 0);
      lines.position.copy(particles.position);
      glow.position.x = particles.position.x * 0.28;
      glow.position.y = particles.position.y * 0.28;
      particles.rotation.y = Math.sin(elapsed * 0.05) * 0.06 + THREE.MathUtils.degToRad(mix(0, 8, stageFour));
      particles.rotation.z = Math.sin(elapsed * 0.04) * 0.025;
      lines.rotation.copy(particles.rotation);
      camera.position.z = mix(8.6, 9.05, stageFive);
      glow.material.opacity = 0.48 + Math.sin(elapsed * 0.28) * 0.05;
      renderer.render(scene, camera);
      frameCount += 1;
      animationFrame = window.requestAnimationFrame(render);
    };

    const resize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      material.uniforms.uPixelRatio.value = pixelRatio;
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", resize);
    render();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", pointerMove);
      mount.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      glowMaterial.dispose();
      glowTexture.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="fixed inset-0" aria-hidden="true" />;
}

function TextBlock({ children, className = "" }) {
  return (
    <motion.div
      key={String(children)}
      initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -14, filter: "blur(8px)" }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      className={`mx-auto max-w-4xl text-center ${className}`}
    >
      {children}
    </motion.div>
  );
}

function QuestionForm({ question, index, value, onChange, onSubmit }) {
  return (
    <motion.form
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.55 }}
      className="mx-auto w-full max-w-3xl"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(index);
      }}
      onWheel={(event) => event.preventDefault()}
    >
      <label className="block font-[var(--font-barlow-condensed)] text-sm uppercase leading-relaxed tracking-[0.32em] text-[#f5f0e6]/70 md:text-base">
        {question}
      </label>
      <div className="mt-5 flex items-end gap-4 border-b border-[#c9922a] pb-2">
        <input
          autoFocus
          value={value}
          onChange={(event) => onChange(index, event.target.value)}
          className="w-full bg-transparent font-[var(--font-fraunces)] text-xl italic text-[#f5f0e6] caret-[#f5f0e6] outline-none placeholder:text-[#f5f0e6]/25 md:text-3xl"
          placeholder="Tell me."
        />
        <button
          type="submit"
          aria-label="Submit answer"
          className="pb-1 font-[var(--font-barlow-condensed)] text-3xl leading-none text-[#c9922a] transition hover:text-[#e5b660]"
        >
          →
        </button>
      </div>
    </motion.form>
  );
}

function CapabilityCards({ capabilities, loading }) {
  const cards = capabilities?.length ? capabilities : fallbackCapabilities;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3"
    >
      {cards.map((card, index) => (
        <div
          key={`${card.headline}-${index}`}
          className={`border-t border-[#c9922a] bg-[#0f1d33]/88 p-5 text-left shadow-[0_0_40px_rgba(201,146,42,0.08)] ${loading ? "animate-pulse" : ""}`}
        >
          <h3 className="font-[var(--font-barlow-condensed)] text-sm uppercase tracking-[0.28em] text-[#c9922a]">
            {card.headline}
          </h3>
          <p className="mt-4 font-[var(--font-fraunces)] text-lg italic leading-relaxed text-[#f5f0e6]">
            {card.body}
          </p>
        </div>
      ))}
    </motion.div>
  );
}

function OnboardingOverlay({
  ui,
  answers,
  submittedAnswers,
  capabilities,
  loadingCapabilities,
  onAnswerChange,
  onSubmitAnswer,
}) {
  const prompts = [
    "WHAT ARE YOU BUILDING OR RUNNING? DON'T OVERSIMPLIFY IT. TELL ME WHAT IT ACTUALLY IS.",
    "WHO DEPENDS ON WHAT YOU DO? THE ACTUAL HUMANS WHOSE LIVES CHANGE WHEN YOU GET IT RIGHT.",
    "WHERE ARE YOU STUCK RIGHT NOW? THE THING THAT SLOWS EVERYTHING ELSE DOWN. BE SPECIFIC.",
    "IF I WORKED EXACTLY THE WAY YOU NEEDED ME TO, WHAT WOULD BE DIFFERENT IN YOUR LIFE SIX MONTHS FROM NOW?",
  ];

  const content = useMemo(() => {
    const p = ui.progress;
    const stage = ui.stage;
    const gatedQuestion = getQuestionGateIndex(p, submittedAnswers);
    if (gatedQuestion !== -1) {
      return { kind: "question", key: `q${gatedQuestion + 1}`, index: gatedQuestion };
    }
    if (p >= 0.99) {
      return { kind: "button", key: "enter" };
    }
    if (p >= 0.96) {
      return { kind: "cards", key: "cards" };
    }
    if (p >= 0.955) {
      return { kind: "text", key: "begin", text: "Built for you. Let's begin.", tone: "cream" };
    }
    if (p >= 0.94) {
      return { kind: "text", key: "agent", text: "I'm your Aisymetry agent.", tone: "gold" };
    }
    if (p >= 0.93) {
      return { kind: "text", key: "know", text: "I know what I am now.", tone: "gold" };
    }
    if (((submittedAnswers[2] && p >= 0.54) || p >= 0.7) && p < 0.76) {
      return { kind: "text", key: "friction", text: "I know that friction. It's where I'll focus first.", tone: "gold" };
    }
    if (((submittedAnswers[1] && p >= 0.3) || p >= 0.48) && p < 0.54) {
      return { kind: "text", key: "matters", text: "That matters. It changes what I need to be for you.", tone: "gold" };
    }
    if (((submittedAnswers[0] && p >= 0.18) || p >= 0.25) && p < 0.3) {
      return { kind: "text", key: "shape", text: "Good. I have a shape now. Not complete. But something.", tone: "gold" };
    }
    if (p >= 0.15 && p < QUESTION_GATES[0]) {
      return { kind: "text", key: "you", text: "I take shape around the person in front of me. That's you.", tone: "cream" };
    }
    if (p >= 0.1 && p < 0.15) {
      return { kind: "text", key: "here", text: "I'm not fully here yet.", tone: "cream" };
    }
    return { kind: "hint", key: "hint", stage };
  }, [submittedAnswers, ui.progress, ui.stage]);

  const enterAisymetry = () => {
    if (typeof window === "undefined") {
      return;
    }
    window.sessionStorage.setItem(
      "aisymetryOnboarding",
      JSON.stringify({ answers, capabilities: capabilities?.length ? capabilities : fallbackCapabilities }),
    );
    window.location.href = "/dashboard";
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center px-6">
      <div className="absolute inset-x-4 top-8 flex items-center justify-between font-[var(--font-barlow-condensed)] text-xs uppercase tracking-[0.35em] text-[#f5f0e6]/45">
        <span>Aisymetry</span>
        <span>Stage {ui.stage + 1}/5</span>
      </div>
      <div className="absolute left-1/2 top-8 h-px w-44 -translate-x-1/2 bg-[#f5f0e6]/10">
        <div className="h-full bg-[#c9922a]" style={{ width: `${Math.round(ui.progress * 100)}%` }} />
      </div>
      <div className="pointer-events-auto relative w-full py-12">
        <div className="absolute left-1/2 top-1/2 -z-10 h-[32rem] w-[min(54rem,95vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(10,22,40,0.45)_0%,rgba(10,22,40,0.36)_42%,rgba(10,22,40,0)_72%)]" />
        <AnimatePresence mode="wait">
          {content.kind === "hint" && (
            <TextBlock key="hint" className="translate-y-48">
              <p className="font-[var(--font-barlow-condensed)] text-xs uppercase tracking-[0.48em] text-[#f5f0e6]/45">
                Scroll to move through the living map
              </p>
            </TextBlock>
          )}
          {content.kind === "text" && (
            <TextBlock
              key={content.key}
              className={`font-[var(--font-fraunces)] text-3xl italic leading-tight md:text-6xl ${
                content.tone === "gold" ? "text-[#c9922a]" : "text-[#f5f0e6]"
              }`}
            >
              {content.text}
            </TextBlock>
          )}
          {content.kind === "question" && (
            <QuestionForm
              key={content.key}
              question={prompts[content.index]}
              index={content.index}
              value={answers[content.index] || ""}
              onChange={onAnswerChange}
              onSubmit={onSubmitAnswer}
            />
          )}
          {content.kind === "cards" && (
            <CapabilityCards key="cards" capabilities={capabilities} loading={loadingCapabilities} />
          )}
          {content.kind === "button" && (
            <motion.button
              key="enter"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={enterAisymetry}
              className="mx-auto block border border-[#c9922a] px-8 py-4 font-[var(--font-barlow-condensed)] text-base uppercase tracking-[0.32em] text-[#f5f0e6] transition hover:shadow-[0_0_34px_rgba(201,146,42,0.45)]"
            >
              Enter Aisymetry
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <div className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 font-[var(--font-barlow-condensed)] text-[0.65rem] uppercase tracking-[0.48em] text-[#f5f0e6]/35">
        Scroll position is the playhead
      </div>
    </div>
  );
}

export default function OnboardingV2() {
  const scrollRef = useRef(null);
  const progressRef = useRef(0);
  const pulseRef = useRef(0);
  const submittedAnswersRef = useRef([false, false, false, false]);
  const lenisRef = useRef(null);
  const activeQuestionRef = useRef(-1);
  const [ui, setUi] = useState({ progress: 0, stage: 0 });
  const [answers, setAnswers] = useState(["", "", "", ""]);
  const [submittedAnswers, setSubmittedAnswers] = useState([false, false, false, false]);
  const [capabilities, setCapabilities] = useState(null);
  const [loadingCapabilities, setLoadingCapabilities] = useState(false);

  useEffect(() => {
    submittedAnswersRef.current = submittedAnswers;
    if (activeQuestionRef.current > -1 && submittedAnswers[activeQuestionRef.current]) {
      activeQuestionRef.current = -1;
      lenisRef.current?.start();
      ScrollTrigger.update();
    }
  }, [submittedAnswers]);

  useIsomorphicLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    progressRef.current = 0;
    setUi({ progress: 0, stage: 0 });

    const lenis = new Lenis({
      duration: window.matchMedia("(max-width: 767px)").matches ? 1.05 : 1.35,
      lerp: 0.075,
      smoothWheel: true,
      wheelMultiplier: 0.78,
      touchMultiplier: 1.15,
    });
    lenisRef.current = lenis;

    const update = (time) => {
      lenis.raf(time * 1000);
    };

    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    lenis.scrollTo(0, { immediate: true, force: true });

    const trigger = ScrollTrigger.create({
      trigger: scrollRef.current,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => {
        const rawProgress = self.progress;
        const gateIndex = getQuestionGateIndex(rawProgress, submittedAnswersRef.current);
        const progress = gateIndex > -1 ? QUESTION_GATES[gateIndex] : rawProgress;
        progressRef.current = progress;
        setUi({ progress, stage: Math.min(4, Math.floor(progress * 5)) });
        if (gateIndex > -1) {
          const targetScroll = self.start + (self.end - self.start) * QUESTION_GATES[gateIndex];
          if (activeQuestionRef.current !== gateIndex) {
            activeQuestionRef.current = gateIndex;
            window.requestAnimationFrame(() => {
              lenis.scrollTo(targetScroll, { immediate: true, force: true });
              window.scrollTo(0, targetScroll);
            });
          }
          lenis.stop();
        } else if (activeQuestionRef.current === -1) {
          lenis.start();
        }
      },
    });

    const resetFrame = window.requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      lenis.scrollTo(0, { immediate: true, force: true });
      progressRef.current = 0;
      setUi({ progress: 0, stage: 0 });
      ScrollTrigger.refresh();
    });

    return () => {
      window.cancelAnimationFrame(resetFrame);
      window.history.scrollRestoration = previousScrollRestoration;
      lenisRef.current = null;
      trigger.kill();
      gsap.ticker.remove(update);
      lenis.destroy();
      ScrollTrigger.getAll().forEach((item) => item.kill());
    };
  }, []);

  const fetchCapabilities = useCallback(async (nextAnswers) => {
    setLoadingCapabilities(true);
    try {
      const response = await fetch("/api/aisymetry-capabilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: nextAnswers }),
      });
      const payload = await response.json();
      setCapabilities(Array.isArray(payload.capabilities) ? payload.capabilities : fallbackCapabilities);
    } catch {
      setCapabilities(fallbackCapabilities);
    } finally {
      setLoadingCapabilities(false);
    }
  }, []);

  const handleAnswerChange = (index, value) => {
    setAnswers((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const handleSubmitAnswer = (index) => {
    setAnswers((current) => {
      const next = [...current];
      if (!next[index]?.trim()) {
        next[index] = "I need Aisymetry to understand the real work.";
      }
      pulseRef.current += 1.2;
      if (index === 3) {
        fetchCapabilities(next);
      }
      return next;
    });
    setSubmittedAnswers((current) => {
      const next = [...current];
      next[index] = true;
      return next;
    });
  };

  return (
    <>
      <Head>
        <title>Aisymetry Onboarding V2</title>
        <meta
          name="description"
          content="A scroll-driven cinematic onboarding experience for Aisymetry."
        />
      </Head>
      <main
        className={`${barlowCondensed.variable} ${fraunces.variable} relative bg-[#0a1628] text-[#f5f0e6]`}
      >
        <NebulaCanvas progressRef={progressRef} pulseRef={pulseRef} />
        <div className="pointer-events-none fixed inset-0 z-10 bg-[radial-gradient(circle_at_center,rgba(201,146,42,0.05)_0%,rgba(10,22,40,0)_52%)]" />
        <div className="pointer-events-none fixed inset-0 z-10 bg-[radial-gradient(circle_at_center,rgba(10,22,40,0)_58%,rgba(2,8,18,0.6)_100%)]" />
        <div className="pointer-events-none fixed inset-0 z-10 opacity-[0.03] [background-image:radial-gradient(circle_at_30%_20%,#f5f0e6_0_1px,transparent_1px)] [background-size:3px_3px]" />
        <OnboardingOverlay
          ui={ui}
          answers={answers}
          submittedAnswers={submittedAnswers}
          capabilities={capabilities}
          loadingCapabilities={loadingCapabilities}
          onAnswerChange={handleAnswerChange}
          onSubmitAnswer={handleSubmitAnswer}
        />
        <div ref={scrollRef} className="relative z-0 h-[600vh]" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, index) => (
            <section key={index} className="h-[120vh]" data-stage={index + 1} />
          ))}
        </div>
      </main>
    </>
  );
}
