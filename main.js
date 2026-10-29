import * as THREE from 'three';
import './style.css';
import { STAGES } from './stages.js';

// ───────── 기본 설정 ─────────
const ROOM = 16;          // 방 길이
const HW = 7;             // 방 절반 너비
const GAP = 1.7;          // 문 절반 너비
const R = 0.45;           // 캐릭터 반경
const N = STAGES.length;
const GOLD = '#fbbf24';
const $ = (id) => document.getElementById(id);

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

// ───────── 렌더러 / 씬 ─────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f1424);
scene.fog = new THREE.Fog(0x0f1424, 20, 50);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);

scene.add(new THREE.HemisphereLight(0xc8d8ff, 0x251c3a, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.7);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
scene.add(sun, sun.target);

const crystalLight = new THREE.PointLight(0xffffff, 18, 9, 1.6);
scene.add(crystalLight);

// ───────── 텍스처 헬퍼 ─────────
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const floorTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(14, 14, w - 28, h - 28);
  g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 5; g.strokeRect(0, 0, w, h);
});
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
floorTex.repeat.set(HW, ROOM / 2);

const stripeTex = canvasTex(64, 64, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,1)';
  for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 5);
});
stripeTex.wrapS = stripeTex.wrapT = THREE.RepeatWrapping;
stripeTex.repeat.set(1, 4);

function signTex(top, title, color) {
  return canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = 'rgba(14,18,34,0.92)';
    g.beginPath(); g.roundRect(8, 8, w - 16, h - 16, 40); g.fill();
    g.lineWidth = 8; g.strokeStyle = color; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = color; g.font = '800 52px Paperlogy, sans-serif';
    g.fillText(top, w / 2, 78);
    g.fillStyle = '#ffffff'; g.font = '800 84px Paperlogy, sans-serif';
    g.fillText(title, w / 2, 168);
  });
}

// ───────── 월드 생성 ─────────
const wallMat = new THREE.MeshStandardMaterial({ color: 0x2b3253, roughness: 0.85 });
const doors = [];      // { wz, field, posts, sign, open, t }
const pedestals = [];  // { group, crystal, ring, pos }
let trophy;

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
  return m;
}

function buildWorld() {
  for (let i = 0; i <= N; i++) {
    const hex = i < N ? STAGES[i].color : GOLD;
    const color = new THREE.Color(hex);
    const z0 = -i * ROOM;
    const zc = z0 - ROOM / 2;

    // 바닥
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(HW * 2, ROOM),
      new THREE.MeshStandardMaterial({ map: floorTex, color: color.clone().lerp(new THREE.Color(0x171c30), 0.74), roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, zc);
    floor.receiveShadow = true;
    scene.add(floor);

    // 옆벽 + 네온 라인
    const neon = new THREE.MeshBasicMaterial({ color });
    for (const s of [-1, 1]) {
      box(0.5, 1.3, ROOM, wallMat, s * (HW + 0.25), 0.65, zc);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, ROOM), neon);
      strip.position.set(s * (HW + 0.02), 1.3, zc);
      scene.add(strip);
    }
    if (i === 0) box(HW * 2 + 1, 1.3, 0.5, wallMat, 0, 0.65, 0.25);
    if (i === N) box(HW * 2 + 1, 1.3, 0.5, wallMat, 0, 0.65, -(N + 1) * ROOM - 0.25);

    // 받침대
    const g = new THREE.Group();
    g.position.set(0, 0, z0 - ROOM * 0.5);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 0.9, 24), new THREE.MeshStandardMaterial({ color: 0x3a4266, roughness: 0.6 }));
    base.position.y = 0.45; base.castShadow = base.receiveShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 8, 48), new THREE.MeshBasicMaterial({ color }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.92;
    g.add(base, ring);
    scene.add(g);

    if (i < N) {
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.42),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.1, flatShading: true })
      );
      crystal.position.y = 1.7; crystal.castShadow = true;
      g.add(crystal);
      pedestals.push({ group: g, crystal, ring, pos: g.position });
    } else {
      // 트로피
      const gold = new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.35, metalness: 0.8, roughness: 0.25 });
      const t = new THREE.Group();
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.18, 0.55, 24, 1, true), gold);
      cup.position.y = 0.5;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 12), gold); stem.position.y = 0.12;
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.1, 24), gold); foot.position.y = -0.05;
      for (const s of [-1, 1]) {
        const h = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 8, 24, Math.PI), gold);
        h.position.set(s * 0.43, 0.55, 0); h.rotation.z = s * -Math.PI / 2;
        t.add(h);
      }
      t.add(cup, stem, foot);
      t.traverse((m) => (m.castShadow = true));
      t.position.y = 1.15;
      g.add(t);
      trophy = { group: g, cup: t, pos: g.position };
    }

    // 문 (스테이지 방 끝)
    if (i < N) {
      const wz = -(i + 1) * ROOM;
      const segW = HW - GAP;
      box(segW, 1.3, 0.5, wallMat, -(GAP + segW / 2), 0.65, wz);
      box(segW, 1.3, 0.5, wallMat, GAP + segW / 2, 0.65, wz);
      const postMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7 });
      const posts = [-1, 1].map((s) => box(0.36, 3.2, 0.5, postMat, s * (GAP + 0.18), 1.6, wz));
      const field = new THREE.Mesh(
        new THREE.PlaneGeometry(GAP * 2, 3),
        new THREE.MeshBasicMaterial({ color, map: stripeTex, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
      );
      field.position.set(0, 1.5, wz);
      scene.add(field);

      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(4.4, 1.1),
        new THREE.MeshBasicMaterial({ map: signTex(`STAGE ${i + 1}`, STAGES[i].name, STAGES[i].color), transparent: true })
      );
      sign.position.set(0, 3.9, wz + 0.05 + ROOM); // 방 입구 쪽 위가 아니라, 이 방 안쪽 문 위
      sign.position.z = wz + 0.3;
      scene.add(sign);
      doors.push({ wz, field, posts, postMat, sign, open: false, t: 0 });
    }
  }

  // 마지막 방 간판
  const endSign = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 1.1),
    new THREE.MeshBasicMaterial({ map: signTex('FINAL', '트로피를 잡아라!', GOLD), transparent: true })
  );
  endSign.position.set(0, 3.2, -(N + 1) * ROOM + 0.3);
  scene.add(endSign);

  // 떠다니는 먼지
  const COUNT = 500;
  const pos = new Float32Array(COUNT * 3);
  for (let k = 0; k < COUNT; k++) {
    pos[k * 3] = (Math.random() * 2 - 1) * HW;
    pos[k * 3 + 1] = Math.random() * 5;
    pos[k * 3 + 2] = -Math.random() * (N + 1) * ROOM;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dust = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xbfd0ff, size: 0.06, transparent: true, opacity: 0.6, depthWrite: false }));
  scene.add(dust);
}
let dust;

// ───────── 캐릭터 ─────────
function buildPlayer() {
  const p = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffb347, roughness: 0.5 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1b1f33, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.5, 6, 16), bodyMat);
  body.position.y = 0.72;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 24, 16), bodyMat);
  head.position.y = 1.5;
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 12, -Math.PI * 0.35, Math.PI * 0.7, Math.PI * 0.3, Math.PI * 0.35), darkMat);
  visor.position.y = 1.5; visor.scale.set(1.08, 1.08, 1.08);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x7df9ff });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
    eye.position.set(s * 0.11, 1.55, 0.33);
    p.add(eye);
  }
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3), darkMat);
  ant.position.y = 1.95;
  const tipBall = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff5e5e }));
  tipBall.position.y = 2.12;
  p.add(body, head, visor, ant, tipBall);
  p.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  scene.add(p);
  return p;
}

// ───────── 상태 ─────────
let player, state = 'start', cleared = 0, wrongCount = 0, startTime = 0, lastRoom = -1;
const vel = new THREE.Vector2();
const keys = new Set();
const joy = { x: 0, y: 0, id: null };

// ───────── 입력: 키보드 ─────────
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (state === 'quiz') {
    if (['1', '2', '3', '4'].includes(k)) pick(+k - 1);
    if ((k === 'enter' || k === ' ') && !$('q-next').classList.contains('hidden')) { e.preventDefault(); $('q-next').click(); }
    if (k === 'escape') closeQuiz();
    return;
  }
  if (state === 'start' && (k === 'enter' || k === ' ')) { e.preventDefault(); begin(); return; }
  if (state === 'play' && (k === 'e' || k === ' ' || k === 'enter')) { e.preventDefault(); interact(); return; }
  keys.add(k);
  if (k.startsWith('arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

// ───────── 입력: 터치 조이스틱 ─────────
const joyEl = $('joy'), knob = $('knob');
const JOY_R = 46;
joyEl.addEventListener('pointerdown', (e) => {
  joy.id = e.pointerId;
  joyEl.setPointerCapture(e.pointerId);
  moveJoy(e);
});
joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) moveJoy(e); });
const endJoy = (e) => {
  if (e.pointerId !== joy.id) return;
  joy.id = null; joy.x = joy.y = 0;
  knob.style.transform = '';
};
joyEl.addEventListener('pointerup', endJoy);
joyEl.addEventListener('pointercancel', endJoy);
function moveJoy(e) {
  const r = joyEl.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2);
  let dy = e.clientY - (r.top + r.height / 2);
  const len = Math.hypot(dx, dy);
  if (len > JOY_R) { dx *= JOY_R / len; dy *= JOY_R / len; }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  joy.x = dx / JOY_R; joy.y = dy / JOY_R;
}
$('act').addEventListener('pointerdown', (e) => { e.preventDefault(); interact(); });

// ───────── UI ─────────
function updateHud() {
  const room = Math.min(Math.max(Math.floor(-player.position.z / ROOM), 0), N);
  const s = STAGES[room];
  $('hud-stage').textContent = room < N ? `STAGE ${room + 1} / ${N}` : 'FINAL';
  $('hud-name').textContent = room < N ? s.name : '트로피를 잡아라';
  $('hud-name').style.color = room < N ? s.color : GOLD;
  [...$('hud-dots').children].forEach((d, i) => {
    d.className = i < cleared ? 'done' : i === cleared ? 'now' : '';
  });
}

let toastTimer;
function toast(small, big, color = '#fff', ms = 2200) {
  const t = $('toast');
  t.innerHTML = `<small>${small}</small><strong style="color:${color}">${big}</strong>`;
  t.classList.remove('hidden');
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

function setAccent(hex) {
  document.documentElement.style.setProperty('--accent', hex);
}

// ───────── 퀴즈 ─────────
let quizLocked = false;
function openQuiz(i) {
  const s = STAGES[i];
  state = 'quiz';
  quizLocked = false;
  keys.clear(); joy.x = joy.y = 0; knob.style.transform = '';
  setAccent(s.color);
  $('q-badge').textContent = `STAGE ${i + 1}`;
  $('q-name').textContent = s.name;
  $('q-tip').textContent = s.tip;
  $('q-question').textContent = s.question;
  const box = $('q-options');
  box.innerHTML = '';
  s.options.forEach((opt, k) => {
    const b = document.createElement('button');
    b.innerHTML = `<span>${k + 1}</span><div></div>`;
    b.querySelector('div').textContent = opt;
    b.addEventListener('click', () => pick(k));
    box.appendChild(b);
  });
  $('q-feedback').className = 'feedback hidden';
  $('q-next').classList.add('hidden');
  $('q-close').classList.remove('hidden');
  $('quiz').classList.remove('hidden');
}

function pick(k) {
  if (quizLocked) return;
  const s = STAGES[cleared];
  const btns = [...$('q-options').children];
  if (!btns[k] || btns[k].disabled) return;
  const fb = $('q-feedback');
  if (k === s.answer) {
    quizLocked = true;
    btns.forEach((b) => (b.disabled = true));
    btns[k].classList.add('right');
    fb.className = 'feedback good';
    fb.innerHTML = `<b>정답!</b> `;
    fb.append(s.explain);
    $('q-next').classList.remove('hidden');
    $('q-close').classList.add('hidden');
    $('q-next').focus();
  } else {
    wrongCount++;
    btns[k].classList.add('wrong');
    btns[k].disabled = true;
    fb.className = 'feedback bad';
    fb.innerHTML = `<b>아쉬워요.</b> `;
    fb.append(s.hint);
    const panel = $('quiz').querySelector('.panel');
    panel.classList.remove('shake'); void panel.offsetWidth; panel.classList.add('shake');
  }
}

function closeQuiz() {
  $('quiz').classList.add('hidden');
  state = 'play';
  setAccent(cleared < N ? STAGES[cleared].color : GOLD);
}

$('q-close').addEventListener('click', closeQuiz);
$('q-next').addEventListener('click', () => {
  const i = cleared;
  closeQuiz();
  openDoor(i);
});

function openDoor(i) {
  const d = doors[i];
  d.open = true;
  cleared++;
  pedestals[i].crystal.material.color.set('#34d399');
  pedestals[i].crystal.material.emissive.set('#34d399');
  pedestals[i].ring.material.color.set('#34d399');
  d.postMat.color.set('#34d399'); d.postMat.emissive.set('#34d399');
  shake = 0.35;
  setAccent(cleared < N ? STAGES[cleared].color : GOLD);
  toast(`STAGE ${i + 1} CLEAR`, '문이 열렸어요! 앞으로 →', '#34d399');
  updateHud();
}

function interact() {
  if (state !== 'play') return;
  const t = nearTarget();
  if (t === 'quiz') openQuiz(cleared);
  else if (t === 'end') finish();
}

function nearTarget() {
  const p = player.position;
  if (cleared < N) {
    const q = pedestals[cleared].pos;
    if (Math.hypot(p.x - q.x, p.z - q.z) < 2.6) return 'quiz';
  } else if (Math.hypot(p.x - trophy.pos.x, p.z - trophy.pos.z) < 2.8) return 'end';
  return null;
}

function finish() {
  state = 'end';
  const sec = Math.round((performance.now() - startTime) / 1000);
  const mm = Math.floor(sec / 60), ss = String(sec % 60).padStart(2, '0');
  $('end-stats').textContent = `걸린 시간 ${mm}분 ${ss}초 · 오답 ${wrongCount}번. 오늘 익힌 다섯 가지 요령, 다음 작업 때 그대로 써 보세요.`;
  const list = $('end-list');
  list.innerHTML = '';
  STAGES.forEach((s, i) => {
    const li = document.createElement('li');
    li.style.setProperty('--c', s.color);
    const b = document.createElement('b');
    b.textContent = `${i + 1}. ${s.name}`;
    li.append(b, s.tip);
    list.appendChild(li);
  });
  setAccent(GOLD);
  $('hud').classList.add('hidden');
  $('prompt').classList.add('hidden');
  $('end').classList.remove('hidden');
}

function reset() {
  cleared = 0; wrongCount = 0; lastRoom = -1;
  doors.forEach((d, i) => {
    d.open = false; d.t = 0;
    d.field.material.opacity = 0.55; d.field.visible = true;
    const c = STAGES[i].color;
    d.postMat.color.set(c); d.postMat.emissive.set(c);
    pedestals[i].crystal.material.color.set(c);
    pedestals[i].crystal.material.emissive.set(c);
    pedestals[i].ring.material.color.set(c);
  });
  player.position.set(0, 0, -2.5);
  player.rotation.y = Math.PI;
  vel.set(0, 0);
}

function begin() {
  $('start').classList.add('hidden');
  $('end').classList.add('hidden');
  $('hud').classList.remove('hidden');
  if (isTouch) { $('joy').classList.remove('hidden'); $('act').classList.remove('hidden'); }
  reset();
  state = 'play';
  startTime = performance.now();
  setAccent(STAGES[0].color);
  updateHud();
}
$('start-btn').addEventListener('click', begin);
$('again-btn').addEventListener('click', begin);

// ───────── 이동 / 충돌 ─────────
function step(dt) {
  let ix = 0, iz = 0;
  if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
  if (keys.has('d') || keys.has('arrowright')) ix += 1;
  if (keys.has('w') || keys.has('arrowup')) iz -= 1;
  if (keys.has('s') || keys.has('arrowdown')) iz += 1;
  ix += joy.x; iz += joy.y;
  const len = Math.hypot(ix, iz);
  if (len > 1) { ix /= len; iz /= len; }
  if (state !== 'play') { ix = iz = 0; }

  const SPEED = 6.2;
  const a = 1 - Math.exp(-dt * 12);
  vel.x += (ix * SPEED - vel.x) * a;
  vel.y += (iz * SPEED - vel.y) * a;

  const p = player.position;
  let nx = p.x + vel.x * dt;
  let nz = p.z + vel.y * dt;

  // 바깥 벽
  nx = THREE.MathUtils.clamp(nx, -HW + R, HW - R);
  nz = THREE.MathUtils.clamp(nz, -(N + 1) * ROOM + R + 0.1, -R);

  // 문/칸막이
  for (const d of doors) {
    const near = Math.abs(nz - d.wz) < R + 0.25 || (p.z - d.wz) * (nz - d.wz) < 0;
    if (!near) continue;
    const lim = GAP - R;
    if (d.open && Math.abs(p.x) < lim + 0.001) { nx = THREE.MathUtils.clamp(nx, -lim, lim); continue; }
    nz = p.z >= d.wz ? Math.max(nz, d.wz + R + 0.25) : Math.min(nz, d.wz - R - 0.25);
  }

  // 받침대
  for (const o of [...pedestals.map((q) => q.pos), trophy.pos]) {
    const dx = nx - o.x, dz = nz - o.z, dd = Math.hypot(dx, dz), min = 0.95 + R;
    if (dd < min && dd > 0.0001) { nx = o.x + (dx / dd) * min; nz = o.z + (dz / dd) * min; }
  }

  p.x = nx; p.z = nz;

  // 회전 + 걷기 모션
  const speed = vel.length();
  if (speed > 0.3) {
    const target = Math.atan2(vel.x, vel.y);
    let diff = target - player.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    player.rotation.y += diff * Math.min(1, dt * 12);
  }
  walkPhase += dt * speed * 2.2;
  p.y = Math.abs(Math.sin(walkPhase)) * 0.12 * Math.min(1, speed / 3);
  player.rotation.z = Math.sin(walkPhase) * 0.06 * Math.min(1, speed / 3);
}
let walkPhase = 0;

// ───────── 카메라 ─────────
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
let shake = 0;
function camOffset() {
  const portrait = camera.aspect < 0.9;
  return portrait ? new THREE.Vector3(0, 11, 11.5) : new THREE.Vector3(0, 7.5, 9.5);
}
function updateCamera(dt, snap = false) {
  const p = player.position;
  const want = camOffset().add(new THREE.Vector3(p.x * 0.6, 0, p.z));
  const look = new THREE.Vector3(p.x * 0.8, 1, p.z - 2.5);
  const a = snap ? 1 : 1 - Math.exp(-dt * 5);
  camPos.lerp(want, a);
  camLook.lerp(look, a);
  camera.position.copy(camPos);
  if (shake > 0) {
    shake = Math.max(0, shake - dt);
    camera.position.x += (Math.random() - 0.5) * shake * 0.6;
    camera.position.y += (Math.random() - 0.5) * shake * 0.6;
  }
  camera.lookAt(camLook);
  sun.position.set(p.x + 6, 14, p.z + 6);
  sun.target.position.set(p.x, 0, p.z - 2);
}

// ───────── 루프 ─────────
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (player) {
    step(dt);
    updateCamera(dt);

    // 수정 애니메이션
    pedestals.forEach((q, i) => {
      q.crystal.rotation.y += dt * (i === cleared ? 1.8 : 0.6);
      q.crystal.position.y = 1.7 + Math.sin(t * 2 + i) * 0.12;
    });
    trophy.cup.rotation.y += dt * 1.2;
    trophy.cup.position.y = 1.15 + Math.sin(t * 2) * 0.08;

    // 활성 수정 조명
    const target = cleared < N ? pedestals[cleared] : trophy;
    crystalLight.color.set(cleared < N ? STAGES[cleared].color : GOLD);
    crystalLight.position.set(target.pos.x, 2.2, target.pos.z);

    // 문 애니메이션
    stripeTex.offset.y = (t * 0.6) % 1;
    for (const d of doors) {
      if (d.open && d.t < 1) {
        d.t = Math.min(1, d.t + dt * 1.6);
        d.field.material.opacity = 0.55 * (1 - d.t);
        d.field.scale.y = 1 - d.t * 0.9;
        d.field.position.y = 1.5 * (1 - d.t * 0.9);
        if (d.t >= 1) d.field.visible = false;
      }
      // 간판: 지나간 뒤엔 반투명 (캐릭터 가림 방지)
      const behind = player.position.z < d.wz + 0.5;
      const o = behind ? 0.12 : 1;
      d.sign.material.opacity += (o - d.sign.material.opacity) * Math.min(1, dt * 6);
    }

    // 먼지
    dust.rotation.y = Math.sin(t * 0.05) * 0.01;
    dust.position.y = Math.sin(t * 0.4) * 0.2;

    if (state === 'play') {
      // 방 진입 알림
      const room = Math.min(Math.max(Math.floor(-player.position.z / ROOM), 0), N);
      if (room !== lastRoom) {
        if (lastRoom !== -1 || room === 0) {
          if (room < N) toast(`STAGE ${room + 1}`, STAGES[room].name, STAGES[room].color);
          else toast('FINAL', '트로피를 잡아라!', GOLD);
        }
        lastRoom = room;
        updateHud();
      }

      // 상호작용 안내
      const near = nearTarget();
      const pr = $('prompt');
      if (near) {
        pr.textContent = near === 'quiz'
          ? (isTouch ? '오른쪽 [퀴즈] 버튼을 눌러요' : 'E 또는 Space — 퀴즈 풀기')
          : (isTouch ? '[잡기] 버튼으로 트로피 잡기!' : 'E 또는 Space — 트로피 잡기!');
        pr.classList.remove('hidden');
      } else pr.classList.add('hidden');
      const act = $('act');
      act.classList.toggle('ready', !!near);
      act.textContent = near === 'end' ? '잡기' : '퀴즈';
    } else {
      $('prompt').classList.add('hidden');
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 0.9 ? 62 : 55;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ───────── 시작 ─────────
async function init() {
  // 간판에 페이퍼로지 폰트가 들어가도록 잠깐 기다림 (최대 1.5초)
  try {
    await Promise.race([
      document.fonts.load('800 60px Paperlogy'),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch (_) { /* 폰트 실패해도 진행 */ }
  buildWorld();
  player = buildPlayer();
  $('hud-dots').innerHTML = STAGES.map(() => '<i></i>').join('');
  reset();
  dispatchEvent(new Event('resize'));
  updateCamera(0, true);
  tick();
  window.__game = { get state() { return state; }, get cleared() { return cleared; }, player, pedestals, doors, openQuiz, pick };
}
init();
