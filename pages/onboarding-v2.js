import Head from "next/head";
import { useEffect, useRef } from "react";
import * as THREE from "three";
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
  softGold: "#e5b660",
  cream: "#f5f0e6",
};

const PARTICLE_COUNT = 150;

const vertexShader = `
  attribute float aSize;
  attribute float aSeed;
  attribute float aFrequency;
  attribute float aWarmth;

  uniform float uTime;
  uniform float uPixelRatio;

  varying float vDepth;
  varying float vBreath;
  varying float vWarmth;

  void main() {
    vec3 transformed = position;

    float localDrift = sin(uTime * 0.11 + aSeed * 6.28318530718) * 0.035;
    transformed.x += localDrift * (0.35 + aWarmth);
    transformed.y += cos(uTime * 0.09 + aSeed * 4.7) * 0.025;

    vec4 modelViewPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * modelViewPosition;

    float cameraDepth = clamp((-modelViewPosition.z - 3.0) / 7.0, 0.0, 1.0);
    float depthScale = mix(1.44, 0.72, cameraDepth);
    float breath = 0.5 + 0.5 * sin(uTime * aFrequency + aSeed * 12.5663706144);
    float breathScale = 1.0 + breath * 0.12;

    gl_PointSize = aSize * depthScale * breathScale * uPixelRatio * 18.0 / -modelViewPosition.z;

    vDepth = cameraDepth;
    vBreath = breath;
    vWarmth = aWarmth;
  }
`;

const fragmentShader = `
  precision highp float;

  uniform vec3 uPrimaryGold;
  uniform vec3 uSoftGold;

  varying float vDepth;
  varying float vBreath;
  varying float vWarmth;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float radius = length(uv);
    float core = 1.0 - smoothstep(0.0, 0.18, radius);
    float glow = 1.0 - smoothstep(0.05, 0.5, radius);

    if (glow <= 0.0) {
      discard;
    }

    vec3 color = mix(uPrimaryGold, uSoftGold, vWarmth);
    float depthOpacity = mix(0.95, 0.42, vDepth);
    float breathOpacity = 0.06 + vBreath * 0.12;
    float alpha = (glow * 0.7 + core * 0.45) * (depthOpacity + breathOpacity);

    gl_FragColor = vec4(color, alpha);
  }
`;

function makeNebulaGeometry() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const seeds = new Float32Array(PARTICLE_COUNT);
  const frequencies = new Float32Array(PARTICLE_COUNT);
  const warmth = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const radius = Math.pow(Math.random(), 0.58);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const cloudX = Math.sin(phi) * Math.cos(theta);
    const cloudY = Math.sin(phi) * Math.sin(theta);
    const cloudZ = Math.cos(phi);
    const horizontalStretch = 4.9;
    const verticalStretch = 2.25;
    const depthStretch = 3.4;

    positions[i * 3] = cloudX * radius * horizontalStretch;
    positions[i * 3 + 1] = cloudY * radius * verticalStretch + Math.sin(theta * 2.0) * 0.18;
    positions[i * 3 + 2] = cloudZ * radius * depthStretch - 1.1;
    sizes[i] = 0.5 + Math.random() * 2.0;
    seeds[i] = Math.random();
    frequencies[i] = 0.35 + Math.random() * 0.75;
    warmth[i] = Math.random();
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute("aFrequency", new THREE.BufferAttribute(frequencies, 1));
  geometry.setAttribute("aWarmth", new THREE.BufferAttribute(warmth, 1));

  return geometry;
}

function NebulaCanvas() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return undefined;
    }

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

    const geometry = makeNebulaGeometry();
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uPrimaryGold: { value: new THREE.Color(COLORS.primaryGold) },
        uSoftGold: { value: new THREE.Color(COLORS.softGold) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(geometry, material);
    particles.rotation.x = THREE.MathUtils.degToRad(5);
    scene.add(particles);

    const clock = new THREE.Clock();
    let animationFrame = 0;

    const render = () => {
      const elapsed = clock.getElapsedTime();
      material.uniforms.uTime.value = elapsed;
      particles.rotation.y = Math.sin(elapsed * 0.05) * 0.06;
      particles.rotation.z = Math.sin(elapsed * 0.04) * 0.025;
      glow.material.opacity = 0.48 + Math.sin(elapsed * 0.28) * 0.05;
      renderer.render(scene, camera);
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
      mount.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      glowMaterial.dispose();
      glowTexture.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="fixed inset-0" aria-hidden="true" />;
}

export default function OnboardingV2() {
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
        className={`${barlowCondensed.variable} ${fraunces.variable} relative min-h-screen overflow-hidden bg-[#0a1628] text-[#f5f0e6]`}
      >
        <NebulaCanvas />
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_center,rgba(201,146,42,0.05)_0%,rgba(10,22,40,0)_52%)]" />
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_center,rgba(10,22,40,0)_58%,rgba(2,8,18,0.6)_100%)]" />
        <section className="relative z-10 flex min-h-screen items-end justify-center px-6 pb-14">
          <p className="font-[var(--font-barlow-condensed)] text-xs uppercase tracking-[0.48em] text-[#f5f0e6]/45">
            Aisymetry cinematic onboarding / particle foundation
          </p>
        </section>
      </main>
    </>
  );
}
