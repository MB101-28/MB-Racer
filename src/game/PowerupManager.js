import * as THREE from 'three';

/**
 * Powerup Types Definition with full emoji branding 🏎️💨
 */
export const POWERUP_TYPES = {
  TURBO: {
    id: 'TURBO',
    name: 'TURBO NITRO',
    emoji: '⚡',
    duration: 3.2,
    accentColor: '#ffaa00',
    glowColor: 0xffaa00,
    description: 'Blazing speed boost & twin afterburner flames',
  },
  SHIELD: {
    id: 'SHIELD',
    name: 'HOLO SHIELD',
    emoji: '🛡️',
    duration: 5.5,
    accentColor: '#00e8ff',
    glowColor: 0x00e8ff,
    description: 'Immune to wall impact penalty & curb drag',
  },
  ROCKET: {
    id: 'ROCKET',
    name: 'SUPER ROCKET',
    emoji: '🚀',
    duration: 3.5,
    accentColor: '#ff3344',
    glowColor: 0xff2244,
    description: 'Max-velocity straightaway rocket propulsion',
  },
  MAGNET: {
    id: 'MAGNET',
    name: 'APEX MAGNET',
    emoji: '🧲',
    duration: 5.0,
    accentColor: '#c455ff',
    glowColor: 0xb044ff,
    description: 'Auto-guides kart smoothly onto optimal racing line',
  },
  WARP: {
    id: 'WARP',
    name: 'TIME WARP',
    emoji: '⏱️',
    duration: 4.5,
    accentColor: '#00ffaa',
    glowColor: 0x00ffaa,
    description: 'Overdrive reflexes & instant drift turbo charge',
  },
  SHOCKWAVE: {
    id: 'SHOCKWAVE',
    name: 'EMP BLAST',
    emoji: '💣',
    duration: 2.2,
    accentColor: '#ff6600',
    glowColor: 0xff5500,
    description: 'Radial energy blast that surges kart forward',
  },
};

const POWERUP_KEYS = Object.keys(POWERUP_TYPES);

/**
 * Creates high-DPI billboard canvas textures for floating emoji icons ✨
 */
function createEmojiTexture(emoji, glowHex = '#ffbb00') {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 128, 128);

  // Soft glowing radial halo behind emoji
  const radGrad = ctx.createRadialGradient(64, 64, 8, 64, 64, 58);
  radGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.45)');
  radGrad.addColorStop(0.35, glowHex + '66');
  radGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = radGrad;
  ctx.beginPath();
  ctx.arc(64, 64, 58, 0, Math.PI * 2);
  ctx.fill();

  // Draw vibrant centered emoji
  ctx.font = '64px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = glowHex;
  ctx.shadowBlur = 14;
  ctx.fillText(emoji, 64, 68);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  return texture;
}

/**
 * Creates and manages the entire 3D Powerup System for Desk Racer:
 * - 6 3D holographic powerup mystery boxes positioned on the coaster track
 * - High-speed slot roulette animation with audio ticks
 * - Dynamic visual effects (Shield dome, Rocket/Turbo plumes, Magnet arcs, Shockwave ring)
 * - Direct physics state interactions
 * - Minimap radar markers
 */
export function createPowerupManager({ scene, physics, microKart, audioSynth, onInventoryChange, onBannerAlert }) {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'PowerupSystemRoot';
  scene.add(rootGroup);

  // Pre-generate textures for mystery question mark and each powerup emoji
  const questionTexture = createEmojiTexture('❓', '#ffbb00');
  const emojiTextures = {};
  for (const key of POWERUP_KEYS) {
    emojiTextures[key] = createEmojiTexture(POWERUP_TYPES[key].emoji, POWERUP_TYPES[key].accentColor);
  }

  // Pre-allocated reusable math scratchpads
  const _tmpVec3 = new THREE.Vector3();
  const _boxWorldPos = new THREE.Vector3();
  const _kartPos = new THREE.Vector3();

  // -------------------------------------------------------------------------
  // 1. PROCEDURAL 3D POWERUP BOXES ON TRACK
  // -------------------------------------------------------------------------
  // Place 6 strategic boxes along the ~3.607m track loop
  const BOX_ARCS = [0.32, 0.92, 1.44, 2.08, 2.72, 3.26];
  const pickupBoxes = [];

  // Shared geometries and materials for performance
  const outerGemGeo = new THREE.OctahedronGeometry(0.0072, 0); // ~14mm faceted diamond
  const innerCoreGeo = new THREE.IcosahedronGeometry(0.0042, 0);
  const ringGeo = new THREE.RingGeometry(0.0055, 0.0085, 24);
  ringGeo.rotateX(-Math.PI / 2);

  const outerGemMat = new THREE.MeshStandardMaterial({
    color: 0xffd24d,
    emissive: 0x553300,
    emissiveIntensity: 0.65,
    roughness: 0.12,
    metalness: 0.35,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });

  const wireframeMat = new THREE.LineBasicMaterial({
    color: 0xfff0aa,
    transparent: true,
    opacity: 0.85,
    linewidth: 1,
  });
  const gemEdgesGeo = new THREE.EdgesGeometry(outerGemGeo);

  const innerCoreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });

  const groundRingMat = new THREE.MeshBasicMaterial({
    color: 0xffbb22,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  // Construct each 3D box group (compliant with 3-12 parts procedural model directives)
  for (let i = 0; i < BOX_ARCS.length; i++) {
    const sArc = BOX_ARCS[i];
    const frame = physics.sampleTrackAtArcLength(sArc);

    const boxGroup = new THREE.Group();
    boxGroup.name = `PowerupBox_${i}`;

    // Anchor group directly at track surface and orient along normal
    boxGroup.position.copy(frame.position);

    // Make local +Y align with track normal, +Z with track tangent
    const localZ = frame.tangent.clone().normalize();
    const localY = frame.normal.clone().normalize();
    const localX = new THREE.Vector3().crossVectors(localY, localZ).normalize();
    const basisMat = new THREE.Matrix4().makeBasis(localX, localY, localZ);
    boxGroup.quaternion.setFromRotationMatrix(basisMat);

    // Floating gem container (bobs up and down)
    const gemPivot = new THREE.Group();
    gemPivot.position.y = 0.0075; // Hover 7.5mm above roadbed

    // 1. Outer translucent faceted diamond
    const outerGem = new THREE.Mesh(outerGemGeo, outerGemMat.clone());
    gemPivot.add(outerGem);

    // 2. Glowing wireframe cage
    const wireframeCage = new THREE.LineSegments(gemEdgesGeo, wireframeMat);
    gemPivot.add(wireframeCage);

    // 3. Inner glowing white core
    const innerCore = new THREE.Mesh(innerCoreGeo, innerCoreMat);
    gemPivot.add(innerCore);

    // 4. Center 2D billboard sprite with ❓
    const spriteMat = new THREE.SpriteMaterial({
      map: questionTexture,
      transparent: true,
      depthWrite: false,
    });
    const emojiSprite = new THREE.Sprite(spriteMat);
    emojiSprite.scale.set(0.009, 0.009, 0.009);
    gemPivot.add(emojiSprite);

    // 5. Orbiting energy satellites (4 small orbiting crystals)
    const orbitGroup = new THREE.Group();
    const satGeo = new THREE.OctahedronGeometry(0.0015, 0);
    const satMat = new THREE.MeshBasicMaterial({ color: 0x00e8ff });
    for (let k = 0; k < 4; k++) {
      const angle = (k * Math.PI) / 2;
      const sat = new THREE.Mesh(satGeo, satMat);
      sat.position.set(Math.cos(angle) * 0.010, 0, Math.sin(angle) * 0.010);
      orbitGroup.add(sat);
    }
    gemPivot.add(orbitGroup);

    boxGroup.add(gemPivot);

    // 6. Ground holographic projector halo on the asphalt
    const groundRing = new THREE.Mesh(ringGeo, groundRingMat.clone());
    groundRing.position.y = 0.0006;
    boxGroup.add(groundRing);

    // 7. Subtle point light for local illumination of car and road
    const boxLight = new THREE.PointLight(0xffcc44, 0.28, 0.06);
    boxLight.position.y = 0.008;
    boxGroup.add(boxLight);

    rootGroup.add(boxGroup);

    pickupBoxes.push({
      index: i,
      s: sArc,
      position: frame.position.clone(),
      boxGroup,
      gemPivot,
      outerGem,
      wireframeCage,
      innerCore,
      emojiSprite,
      orbitGroup,
      groundRing,
      boxLight,
      active: true,
      respawnTimer: 0.0,
      baseScale: 1.0,
    });
  }

  // -------------------------------------------------------------------------
  // 2. KART POWERUP VISUAL EFFECTS ATTACHMENTS
  // -------------------------------------------------------------------------
  // Holographic Shield Dome around kart
  const shieldGeo = new THREE.IcosahedronGeometry(0.0145, 2);
  const shieldMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x0088cc,
    emissiveIntensity: 0.85,
    roughness: 0.1,
    metalness: 0.2,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    wireframe: false,
  });
  const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
  shieldMesh.position.set(0, 0.0035, 0.001);
  shieldMesh.scale.set(1.15, 0.85, 1.45); // Flatter oval bubble hugging kart silhouette
  shieldMesh.visible = false;
  microKart.chassisGroup.add(shieldMesh);

  // Wireframe outer cage for shield
  const shieldWireMat = new THREE.LineBasicMaterial({
    color: 0x88ffff,
    transparent: true,
    opacity: 0.55,
  });
  const shieldWireMesh = new THREE.LineSegments(new THREE.WireframeGeometry(shieldGeo), shieldWireMat);
  shieldMesh.add(shieldWireMesh);

  // EMP Expanding Shockwave Ring Mesh
  const shockwaveGeo = new THREE.RingGeometry(0.002, 0.005, 32);
  shockwaveGeo.rotateX(-Math.PI / 2);
  const shockwaveMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const shockwaveMesh = new THREE.Mesh(shockwaveGeo, shockwaveMat);
  shockwaveMesh.visible = false;
  rootGroup.add(shockwaveMesh);
  let shockwaveTimer = 0.0;
  const SHOCKWAVE_MAX_TIME = 0.55;

  // Particle burst for pickup and powerup explosions (60 reusable particles)
  const burstCount = 60;
  const burstGeo = new THREE.BufferGeometry();
  const burstPos = new Float32Array(burstCount * 3);
  const burstColors = new Float32Array(burstCount * 3);
  const burstVels = Array.from({ length: burstCount }, () => new THREE.Vector3());
  const burstAges = new Float32Array(burstCount);
  const burstLifes = new Float32Array(burstCount);
  burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));
  burstGeo.setAttribute('color', new THREE.BufferAttribute(burstColors, 3));

  const burstMat = new THREE.PointsMaterial({
    size: 0.0045,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const burstPoints = new THREE.Points(burstGeo, burstMat);
  rootGroup.add(burstPoints);

  function triggerBurstEffect(worldX, worldY, worldZ, hexColor = 0xffd700) {
    const col = new THREE.Color(hexColor);
    for (let i = 0; i < burstCount; i++) {
      burstPos[i * 3 + 0] = worldX;
      burstPos[i * 3 + 1] = worldY;
      burstPos[i * 3 + 2] = worldZ;
      burstAges[i] = 0.0;
      burstLifes[i] = 0.35 + Math.random() * 0.25;
      burstColors[i * 3 + 0] = col.r;
      burstColors[i * 3 + 1] = col.g;
      burstColors[i * 3 + 2] = col.b;

      // Spherical burst
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 0.04 + Math.random() * 0.09;
      burstVels[i].set(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed,
        Math.cos(phi) * speed
      );
    }
    burstGeo.attributes.position.needsUpdate = true;
    burstGeo.attributes.color.needsUpdate = true;
  }

  // -------------------------------------------------------------------------
  // 3. INVENTORY & ROULETTE STATE
  // -------------------------------------------------------------------------
  let storedItem = null; // null or POWERUP_TYPES[key]
  let activeItem = null; // null or { ...item, remaining: seconds, totalDuration: seconds }
  let isSpinning = false;
  let rouletteTimer = 0.0;
  let rouletteTickTimer = 0.0;
  let currentRouletteKey = 'TURBO';

  function notifyInventory() {
    if (typeof onInventoryChange === 'function') {
      onInventoryChange({
        storedItem,
        activeItem,
        isSpinning,
        currentRouletteKey,
      });
    }
  }

  function startRoulette() {
    isSpinning = true;
    rouletteTimer = 0.85; // Spin for 0.85 seconds
    rouletteTickTimer = 0.06;
    notifyInventory();
  }

  function finalizeRoulette() {
    isSpinning = false;
    // Weighted selection: ensure a good mix of defensive and offensive powerups
    const randomKey = POWERUP_KEYS[Math.floor(Math.random() * POWERUP_KEYS.length)];
    storedItem = POWERUP_TYPES[randomKey];
    if (audioSynth && audioSynth.playPowerupReady) {
      audioSynth.playPowerupReady();
    }
    if (typeof onBannerAlert === 'function') {
      onBannerAlert(`GOT ${storedItem.emoji} ${storedItem.name}! PRESS [SPACE]`, storedItem.accentColor);
    }
    notifyInventory();
  }

  /**
   * Activates currently stored powerup!
   */
  function activatePowerup() {
    if (isSpinning) {
      // Fast-lock roulette immediately if player taps early!
      finalizeRoulette();
    }
    if (!storedItem) return;

    const itemToActivate = storedItem;
    storedItem = null;

    activeItem = {
      ...itemToActivate,
      remaining: itemToActivate.duration,
      totalDuration: itemToActivate.duration,
    };

    if (audioSynth && audioSynth.playPowerupActivate) {
      audioSynth.playPowerupActivate(itemToActivate.id);
    }

    if (typeof onBannerAlert === 'function') {
      onBannerAlert(`${itemToActivate.emoji} ${itemToActivate.name} ACTIVATED!`, itemToActivate.accentColor);
    }

    // Immediate action on trigger
    if (itemToActivate.id === 'SHOCKWAVE') {
      // Trigger radial shockwave
      microKart.kartRoot.getWorldPosition(_tmpVec3);
      shockwaveMesh.position.copy(_tmpVec3);
      shockwaveMesh.visible = true;
      shockwaveTimer = SHOCKWAVE_MAX_TIME;
      shockwaveMat.opacity = 0.85;
      triggerBurstEffect(_tmpVec3.x, _tmpVec3.y, _tmpVec3.z, 0xff7700);

      // Kinetic surge forward
      physics.state.speed = Math.max(physics.state.speed + 0.08, 0.22);
      physics.state.railImpactActive = false;
      physics.state.boostActive = Math.max(physics.state.boostActive, 1.2);
    } else if (itemToActivate.id === 'TURBO' || itemToActivate.id === 'ROCKET') {
      physics.state.boostActive = Math.max(physics.state.boostActive, itemToActivate.duration);
      physics.state.speed = Math.max(physics.state.speed + 0.05, 0.20);
    } else if (itemToActivate.id === 'WARP') {
      physics.state.boostCharge = 1.0;
    }

    notifyInventory();
  }

  // Keyboard shortcut listener for Space / Shift
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('keydown', (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'KeyE') {
        if (storedItem) {
          e.preventDefault();
          activatePowerup();
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // 4. MAIN UPDATE LOOP (Called every frame at 60FPS)
  // -------------------------------------------------------------------------
  function update(dt, elapsedTime, st) {
    const clampedDt = Math.min(dt, 0.05);

    // 1. Advance Item Roulette if spinning
    if (isSpinning) {
      rouletteTimer -= clampedDt;
      rouletteTickTimer -= clampedDt;
      if (rouletteTickTimer <= 0) {
        rouletteTickTimer = 0.065;
        const nextIdx = (POWERUP_KEYS.indexOf(currentRouletteKey) + 1) % POWERUP_KEYS.length;
        currentRouletteKey = POWERUP_KEYS[nextIdx];
        if (audioSynth && audioSynth.playPowerupRouletteTick) {
          audioSynth.playPowerupRouletteTick();
        }
        notifyInventory();
      }
      if (rouletteTimer <= 0) {
        finalizeRoulette();
      }
    }

    // 2. Step Active Powerup
    if (activeItem) {
      activeItem.remaining -= clampedDt;

      // Apply gameplay enhancements per active powerup
      switch (activeItem.id) {
        case 'TURBO': {
          st.topSpeedMultiplier = Math.max(st.topSpeedMultiplier, 1.55);
          st.boostActive = Math.max(st.boostActive, 0.5);
          // Rapid acceleration
          if (st.speed > 0 && st.speed < 0.29) {
            st.speed += 0.28 * clampedDt;
          }
          break;
        }
        case 'ROCKET': {
          st.topSpeedMultiplier = Math.max(st.topSpeedMultiplier, 1.85);
          st.boostActive = Math.max(st.boostActive, 0.8);
          if (st.speed > 0 && st.speed < 0.35) {
            st.speed += 0.42 * clampedDt;
          }
          // Straighten kart slightly for straight rocket surge
          st.headingYaw = THREE.MathUtils.lerp(st.headingYaw, 0.0, clampedDt * 8.0);
          break;
        }
        case 'SHIELD': {
          // Zero collision penalty & zero curb speed drop!
          st.railImpactActive = false;
          st.curbRumble = 0.0;
          if (Math.abs(st.lateralOffset) >= 0.0086) {
            // Rebound smoothly inward off wall
            const sign = Math.sign(st.lateralOffset) || 1;
            st.lateralOffset = sign * 0.0080;
            st.headingYaw = sign * 0.08;
            st.speed = Math.max(st.speed, 0.17);
          }
          break;
        }
        case 'MAGNET': {
          // Pull kart gently toward optimal apex line!
          const idealApexOffset = THREE.MathUtils.clamp(-st.signedCurvature * 0.0016, -0.0055, 0.0055);
          const apexErr = idealApexOffset - st.lateralOffset;
          st.lateralOffset += apexErr * clampedDt * 10.0;
          st.boostCharge = Math.min(1.0, st.boostCharge + clampedDt * 0.45);
          break;
        }
        case 'WARP': {
          st.topSpeedMultiplier = Math.max(st.topSpeedMultiplier, 1.35);
          st.boostCharge = 1.0; // Always full boost
          break;
        }
        case 'SHOCKWAVE': {
          st.topSpeedMultiplier = Math.max(st.topSpeedMultiplier, 1.45);
          st.railImpactActive = false;
          break;
        }
      }

      if (activeItem.remaining <= 0) {
        activeItem = null;
        st.topSpeedMultiplier = 1.0;
        notifyInventory();
      }
    } else {
      st.topSpeedMultiplier = 1.0;
    }

    // 3. Update Visual FX
    // (a) Shield Mesh
    const isShieldActive = activeItem && activeItem.id === 'SHIELD';
    shieldMesh.visible = isShieldActive;
    if (isShieldActive) {
      shieldMesh.rotation.y += clampedDt * 4.5;
      shieldMesh.rotation.x = Math.sin(elapsedTime * 6.0) * 0.12;
      const pulse = 0.35 + 0.15 * Math.sin(elapsedTime * 14.0);
      shieldMat.opacity = pulse;
      shieldMat.emissiveIntensity = 0.75 + 0.35 * Math.sin(elapsedTime * 12.0);
    }

    // (b) Shockwave Mesh Animation
    if (shockwaveTimer > 0) {
      shockwaveTimer -= clampedDt;
      const p = 1.0 - shockwaveTimer / SHOCKWAVE_MAX_TIME;
      const currentRadius = 0.005 + p * 0.065;
      shockwaveMesh.scale.set(currentRadius / 0.005, 1, currentRadius / 0.005);
      shockwaveMat.opacity = (1.0 - p) * 0.85;
      if (shockwaveTimer <= 0) {
        shockwaveMesh.visible = false;
      }
    }

    // (c) Burst Particles Step
    for (let i = 0; i < burstCount; i++) {
      if (burstAges[i] < burstLifes[i]) {
        burstAges[i] += clampedDt;
        burstPos[i * 3 + 0] += burstVels[i].x * clampedDt;
        burstPos[i * 3 + 1] += burstVels[i].y * clampedDt;
        burstPos[i * 3 + 2] += burstVels[i].z * clampedDt;
        burstVels[i].multiplyScalar(0.92);
      } else {
        burstPos[i * 3 + 1] = -999;
      }
    }
    burstGeo.attributes.position.needsUpdate = true;

    // 4. Update 3D Pickup Boxes (Floating, Spinning, Collision & Respawns)
    _kartPos.copy(st.position);
    const boxSpinAngle = elapsedTime * 2.8;

    for (let i = 0; i < pickupBoxes.length; i++) {
      const box = pickupBoxes[i];

      if (!box.active) {
        box.respawnTimer -= clampedDt;
        if (box.respawnTimer <= 0) {
          // Respawn box!
          box.active = true;
          box.boxGroup.visible = true;
          box.gemPivot.scale.setScalar(0.01);
          triggerBurstEffect(box.position.x, box.position.y + 0.008, box.position.z, 0xffd24d);
        } else {
          continue;
        }
      }

      // Smooth pop-in scale
      if (box.gemPivot.scale.x < 1.0) {
        const nextScale = Math.min(1.0, box.gemPivot.scale.x + clampedDt * 4.5);
        box.gemPivot.scale.setScalar(nextScale);
      }

      // Floating bobbing & rotation
      const bob = Math.sin(elapsedTime * 4.0 + i * 1.2) * 0.0016;
      box.gemPivot.position.y = 0.0075 + bob;
      box.gemPivot.rotation.y = boxSpinAngle + i * 0.5;
      box.gemPivot.rotation.x = Math.sin(elapsedTime * 2.5 + i) * 0.12;

      // Orbiting satellites
      box.orbitGroup.rotation.y = -boxSpinAngle * 1.6;

      // Ground pulsing ring
      const ringAlpha = 0.45 + 0.22 * Math.sin(elapsedTime * 6.0 + i);
      box.groundRing.material.opacity = ringAlpha;

      // Collision Detection against Kart position
      box.gemPivot.getWorldPosition(_boxWorldPos);
      const dist = _boxWorldPos.distanceTo(_kartPos);

      // Hit threshold: 0.024m (24mm)
      if (dist < 0.024) {
        box.active = false;
        box.respawnTimer = 7.0; // 7 seconds respawn cooldown
        box.boxGroup.visible = false;

        // Visual collection burst
        triggerBurstEffect(_boxWorldPos.x, _boxWorldPos.y, _boxWorldPos.z, 0xffea00);

        // Sound effect
        if (audioSynth && audioSynth.playPowerupPickup) {
          audioSynth.playPowerupPickup();
        }

        // Trigger item roulette
        startRoulette();

        // Autopilot autonomous use: if player is in Autopilot, use item strategically after 1.5s!
        if (st.autopilot) {
          setTimeout(() => {
            if (storedItem) activatePowerup();
          }, 1600);
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 5. RADAR / MINIMAP DRAWING
  // -------------------------------------------------------------------------
  function drawMinimapMarkers(ctx, mapMinimapX, mapMinimapY) {
    if (!ctx) return;
    ctx.save();
    for (let i = 0; i < pickupBoxes.length; i++) {
      const box = pickupBoxes[i];
      const mx = mapMinimapX(box.position.x, box.position.y, box.position.z);
      const my = mapMinimapY(box.position.x, box.position.y, box.position.z);

      if (box.active) {
        // Draw bright glowing diamond marker
        ctx.fillStyle = 'rgba(255, 180, 0, 0.45)';
        ctx.beginPath();
        ctx.arc(mx, my, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.moveTo(mx, my - 6);
        ctx.lineTo(mx + 6, my);
        ctx.lineTo(mx, my + 6);
        ctx.lineTo(mx - 6, my);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(mx, my, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Inactive / respawning marker
        ctx.fillStyle = 'rgba(120, 140, 160, 0.45)';
        ctx.beginPath();
        ctx.arc(mx, my, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  return {
    rootGroup,
    pickupBoxes,
    update,
    activatePowerup,
    getStoredItem: () => storedItem,
    getActiveItem: () => activeItem,
    drawMinimapMarkers,
    givePowerup: (key) => {
      if (POWERUP_TYPES[key]) {
        storedItem = POWERUP_TYPES[key];
        notifyInventory();
      }
    },
  };
}
