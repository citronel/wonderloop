const root = document.documentElement;
const canvas = document.getElementById("artboard");
const ctx = canvas.getContext("2d");

const speedInput = document.getElementById("speed");
const speedValue = document.getElementById("speedValue");
const downloadBtn = document.getElementById("downloadBtn");
const themeButtons = document.querySelectorAll(".theme-btn");

const themes = {
  cyan: {
    "--bg-1": "#050b16",
    "--bg-2": "#0c1220",
    "--panel": "rgba(9, 15, 28, 0.5)",
    "--panel-border": "rgba(123, 246, 255, 0.22)",
    "--text": "#eafcff",
    "--muted": "rgba(234, 252, 255, 0.72)",
    "--accent": "#59f3ff",
    "--accent-2": "#b283ff",
    "--shadow-glow": "rgba(89, 243, 255, 0.42)",
    "--button-bg": "rgba(15, 24, 40, 0.7)",
    "--button-border": "rgba(189, 238, 255, 0.22)",
    "--button-active": "rgba(89, 243, 255, 0.18)"
  },
  violet: {
    "--bg-1": "#070612",
    "--bg-2": "#150d25",
    "--panel": "rgba(16, 11, 26, 0.5)",
    "--panel-border": "rgba(197, 157, 255, 0.25)",
    "--text": "#f2ebff",
    "--muted": "rgba(242, 235, 255, 0.74)",
    "--accent": "#b28bff",
    "--accent-2": "#71d3ff",
    "--shadow-glow": "rgba(178, 139, 255, 0.38)",
    "--button-bg": "rgba(25, 20, 35, 0.72)",
    "--button-border": "rgba(197, 157, 255, 0.22)",
    "--button-active": "rgba(178, 139, 255, 0.18)"
  },
  aurora: {
    "--bg-1": "#051611",
    "--bg-2": "#091d1f",
    "--panel": "rgba(7, 22, 21, 0.5)",
    "--panel-border": "rgba(122, 255, 216, 0.24)",
    "--text": "#e8fff9",
    "--muted": "rgba(232, 255, 249, 0.7)",
    "--accent": "#6ef5d6",
    "--accent-2": "#67b9ff",
    "--shadow-glow": "rgba(110, 245, 214, 0.34)",
    "--button-bg": "rgba(10, 26, 24, 0.7)",
    "--button-border": "rgba(110, 245, 214, 0.2)",
    "--button-active": "rgba(110, 245, 214, 0.16)"
  },
  sunset: {
    "--bg-1": "#150d0d",
    "--bg-2": "#2a1716",
    "--panel": "rgba(32, 15, 15, 0.5)",
    "--panel-border": "rgba(255, 169, 113, 0.25)",
    "--text": "#fff3ec",
    "--muted": "rgba(255, 243, 236, 0.72)",
    "--accent": "#ff9a54",
    "--accent-2": "#ff5ec4",
    "--shadow-glow": "rgba(255, 154, 84, 0.34)",
    "--button-bg": "rgba(34, 18, 18, 0.72)",
    "--button-border": "rgba(255, 169, 113, 0.22)",
    "--button-active": "rgba(255, 154, 84, 0.18)"
  }
};

const pointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  active: false,
  radius: 200
};

let animationSpeed = Number(speedInput.value);
let particles = [];
let width = window.innerWidth;
let height = window.innerHeight;
let lastFrame = 0;

function setTheme(themeName) {
  const theme = themes[themeName];
  Object.entries(theme).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  themeButtons.forEach((btn) => {
    const isActive = btn.dataset.theme === themeName;
    btn.classList.toggle("active", isActive);
  });
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;

  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  buildParticles();
}

function buildParticles() {
  const targetCount = Math.min(120, Math.max(62, Math.round((width * height) / 18)));

  particles = Array.from({ length: targetCount }, () => {
    const angle = Math.random() * Math.PI * 2;
    const orbitRadius = 10 + Math.random() * 40;
    const driftSpeed = 0.2 + Math.random() * 0.8;

    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.7,
      vy: (Math.random() - 0.5) * 0.7,
      size: 1.5 + Math.random() * 2.6,
      alpha: 0.32 + Math.random() * 0.68,
      orbitAngle: angle,
      orbitRadius,
      driftSpeed,
      pulse: Math.random() * Math.PI * 2
    };
  });
}

function updateSpeed(value) {
  animationSpeed = Number(value);
  speedValue.textContent = `${animationSpeed.toFixed(1)}x`;
}

function pointerMove(event) {
  const point = event.touches ? event.touches[0] : event;
  pointer.x = point.clientX;
  pointer.y = point.clientY;
  pointer.active = true;
}

function pointerLeave() {
  pointer.active = false;
}

function drawBackground() {
  const centerX = width * 0.5;
  const centerY = height * 0.35;
  const gradient = ctx.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    Math.max(width, height) * 0.9
  );

  gradient.addColorStop(0, "rgba(255,255,255,0.06)");
  gradient.addColorStop(0.18, "rgba(89,243,255,0.09)");
  gradient.addColorStop(0.5, "rgba(178,131,255,0.06)");
  gradient.addColorStop(1, "rgba(5,11,22,0.06)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawConnections() {
  const connectionDistance = 120;

  for (let i = 0; i < particles.length; i += 1) {
    const p1 = particles[i];

    for (let j = i + 1; j < particles.length; j += 1) {
      const p2 = particles[j];
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < connectionDistance * connectionDistance) {
        const dist = Math.sqrt(distSq) || 1;
        const alpha = (1 - dist / connectionDistance) * 0.28;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(120, 220, 255, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }
}

function animateParticles() {
  const accent = getComputedStyle(root).getPropertyValue("--accent").trim();
  const accent2 = getComputedStyle(root).getPropertyValue("--accent-2").trim();

  for (let i = 0; i < particles.length; i += 1) {
    const p = particles[i];

    p.orbitAngle += 0.004 * animationSpeed;
    p.pulse += 0.02 * animationSpeed;

    const orbitX = Math.cos(p.orbitAngle) * p.orbitRadius;
    const orbitY = Math.sin(p.orbitAngle * 1.7) * p.orbitRadius * 0.75;

    p.vx += (Math.random() - 0.5) * 0.02;
    p.vy += (Math.random() - 0.5) * 0.02;

    const dx = p.x - pointer.x;
    const dy = p.y - pointer.y;
    const distSq = dx * dx + dy * dy;

    if (pointer.active && distSq < pointer.radius * pointer.radius) {
      const dist = Math.sqrt(distSq) || 1;
      const force = (1 - dist / pointer.radius) * 0.9;
      p.vx += (dx / dist) * force * 0.8;
      p.vy += (dy / dist) * force * 0.8;
    }

    p.x += (p.vx + orbitX * 0.015 + Math.sin(p.pulse) * 0.06) * animationSpeed * 2.2;
    p.y += (p.vy + orbitY * 0.015 + Math.cos(p.pulse * 1.4) * 0.06) * animationSpeed * 2.2;

    if (p.x < -40) p.x = width + 40;
    if (p.x > width + 40) p.x = -40;
    if (p.y < -40) p.y = height + 40;
    if (p.y > height + 40) p.y = -40;

    const pulseAlpha = p.alpha + Math.sin(p.pulse) * 0.2;
    const isEven = i % 2 === 0;

    ctx.beginPath();
    ctx.fillStyle = isEven ? accent : accent2;
    ctx.globalAlpha = clamp(pulseAlpha, 0.2, 1);
    ctx.shadowBlur = 18;
    ctx.shadowColor = isEven ? accent : accent2;
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.globalAlpha = 0.5;
    ctx.arc(p.x + p.size * 0.2, p.y - p.size * 0.2, p.size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function render(timestamp) {
  const delta = timestamp - lastFrame || 16.67;
  lastFrame = timestamp;

  ctx.clearRect(0, 0, width, height);
  drawBackground();

  drawConnections();
  animateParticles();

  const flicker = Math.sin(timestamp * 0.0017) * 0.04 + 0.06;
  ctx.fillStyle = `rgba(255,255,255,${flicker})`;
  ctx.fillRect(0, 0, width, height);

  requestAnimationFrame(render);
}

speedInput.addEventListener("input", (event) => {
  updateSpeed(event.target.value);
});

downloadBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "wonderloop-artwork.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

themeButtons.forEach((button) => {
  button.addEventListener("click", () => setTheme(button.dataset.theme));
});

window.addEventListener("resize", resizeCanvas);
window.addEventListener("pointermove", pointerMove);
window.addEventListener("pointerdown", pointerMove);
window.addEventListener("pointerleave", pointerLeave);
window.addEventListener("touchmove", pointerMove, { passive: true });
window.addEventListener("touchstart", pointerMove, { passive: true });
window.addEventListener("touchend", pointerLeave);

setTheme("cyan");
updateSpeed(speedInput.value);
resizeCanvas();
requestAnimationFrame(render);
