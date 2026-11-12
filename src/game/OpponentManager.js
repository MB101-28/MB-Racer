import * as THREE from 'three';
import { buildMicroKart } from '../scene/MicroKartBuilder.js';
import { POWERUP_TYPES } from './PowerupManager.js';

/**
 * 3 AI Rival Racers with distinct personalities, racing numbers, and vibrant helmet colors 🏎️💨
 * - Red kart bodies across all 4 racers (as requested)
 * - Helmets individually colored:
 *   - Player: Pearl White with Crimson Stripe (#4) 🔴
 *   - Rival 1 (Volt): Electric Neon Cyan (#7) ⚡
 *   - Rival 2 (Blaze): Radiant Gold / Amber (#12) 🔥
 *   - Rival 3 (Shadow): Royal Purple / Violet (#23) 👾
 */
export const OPPONENT_ROSTER = [
  {
    id: 'volt',
    name: 'VOLT',
    emoji: '⚡',
    number: 7,
    helmetColor: 0x00e5ff, // Electric Neon Cyan
    accentHex: '#00e5ff',
    startStagger: -0.026, // Front-Right
    startLateral: 0.0035,
    baseCruisingSpeed: 0.178, // ~35 km/h
    lanePreference: 0.0028,
    aggression: 1.15,
    reactionTime: 0.14,
  },
  {
    id: 'blaze',
    name: 'BLAZE',
    emoji: '🔥',
    number: 12,
    helmetColor: 0xffbb00, // Radiant Gold / Amber
    accentHex: '#ffbb00',
    startStagger: -0.040, // Rear-Left
    startLateral: -0.0038,
    baseCruisingSpeed: 0.174, // ~34 km/h
    lanePreference: -0.0030,
    aggression: 1.0,
    reactionTime: 0.20,
  },
  {
    id: 'shadow',
    name: 'SHADOW',
    emoji: '👾',
    number: 23,
    helmetColor: 0x9933ff, // Royal Purple / Violet
    accentHex: '#9933ff',
    startStagger: -0.052, // Rear-Right
    startLateral: 0.0038,
    baseCruisingSpeed: 0.170, // ~33 km/h
    lanePreference: 0.0008,
    aggression: 0.92,
    reactionTime: 0.25,
  },
];

/**
 * Creates and orchestrates the AI Opponents system:
 * - 3 procedural / GLB micro-karts on track with distinct helmet colors
 * - Staggered 2x2 grid start
 * - 60FPS physics kinematic integration
 * - Overtaking, drafting, apex tracking, and soft bumper collisions
 * - Independent powerup mystery box collection and usage
 * - Live ranking (P1-P4) & minimap radar blips
 */
export function createOpponentManager({ scene, physics, audioSynth, powerupManager, onRivalAlert }) {
  const opponentsGroup = new THREE.Group();
  opponentsGroup.name = 'AIOpponentsRoot';
  scene.add(opponentsGroup);

  const totalTrackLength = physics.totalArcLength || 3.6074;
  const startFinishArc = physics.startFinishArc || 3.245;

  // Math scratchpads
  const _left = new THREE.Vector3();
  const _rotMat = new THREE.Matrix4();
  const _baseQuat = new THREE.Quaternion();
  const _yawQuat = new THREE.Quaternion();
  const _tmpVec3 = new THREE.Vector3();

  // Shared shield geometry for opponent karts
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
  });

  // Build each opponent kart
  const opponents = OPPONENT_ROSTER.map((rival) => {
    const microKart = buildMicroKart({
      helmetColor: rival.helmetColor,
      visorColor: 0x050608,
      name: `RivalKart_${rival.name}`,
    });

    opponentsGroup.add(microKart.kartRoot);

    // Attach local shield bubble mesh to opponent chassis
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat.clone());
    shieldMesh.position.set(0, 0.0035, 0.001);
    shieldMesh.scale.set(1.15, 0.85, 1.45);
    shieldMesh.visible = false;
    microKart.chassisGroup.add(shieldMesh);

    return {
      ...rival,
      microKart,
      shieldMesh,
      s: ((startFinishArc + rival.startStagger) % totalTrackLength + totalTrackLength) % totalTrackLength,
      lateralOffset: rival.startLateral,
      lateralVel: 0.0,
      headingYaw: 0.0,
      speed: 0.0,
      steerAngle: 0.0,
      steerInput: 0.0,
      driftAngle: 0.0,
      boostActive: 0.0,
      shieldActive: 0.0,
      heldItem: null,
      useItemTimer: 0.0,
      currentLap: 1,
      totalDistance: 0.0,
      raceFinished: false,
      finishTime: null,
      position: new THREE.Vector3(),
      tangent: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      right: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      hasLaunched: false,
      launchDelayTimer: rival.reactionTime,
    };
  });

  /**
   * Resets all opponents back to their staggered starting grid slots
   */
  function resetToGrid() {
    for (const opp of opponents) {
      opp.s = ((startFinishArc + opp.startStagger) % totalTrackLength + totalTrackLength) % totalTrackLength;
      opp.lateralOffset = opp.startLateral;
      opp.lateralVel = 0.0;
      opp.headingYaw = 0.0;
      opp.speed = 0.0;
      opp.steerAngle = 0.0;
      opp.steerInput = 0.0;
      opp.driftAngle = 0.0;
      opp.boostActive = 0.0;
      opp.shieldActive = 0.0;
      opp.heldItem = null;
      opp.useItemTimer = 0.0;
      opp.currentLap = 1;
      opp.totalDistance = 0.0;
      opp.raceFinished = false;
      opp.finishTime = null;
      opp.hasLaunched = false;
      opp.launchDelayTimer = opp.reactionTime;
      opp.shieldMesh.visible = false;

      // Update 3D pose
      updateOpponentPose(opp);
    }
  }

  function updateOpponentPose(opp) {
    const frame = physics.sampleTrackAtArcLength(opp.s);
    opp.tangent.copy(frame.tangent);
    opp.normal.copy(frame.normal);
    opp.right.copy(frame.right);

    opp.position
      .copy(frame.position)
      .addScaledVector(frame.right, opp.lateralOffset)
      .addScaledVector(frame.normal, 0.0003);

    _left.crossVectors(frame.normal, frame.tangent).normalize();
    _rotMat.makeBasis(_left, frame.normal, frame.tangent);
    _baseQuat.setFromRotationMatrix(_rotMat);
    _yawQuat.setFromAxisAngle(frame.normal, opp.headingYaw);
    opp.quaternion.copy(_yawQuat.multiply(_baseQuat));

    opp.microKart.kartRoot.position.copy(opp.position);
    opp.microKart.kartRoot.quaternion.copy(opp.quaternion);
  }

  // Initial grid placement
  resetToGrid();

  /**
   * Synchronizes scale of all opponent karts to match the camera mode scale
   */
  function syncKartScales(scale) {
    for (const opp of opponents) {
      opp.microKart.kartRoot.scale.setScalar(scale);
    }
  }

  /**
   * Clones and attaches the master GLB kart model to each rival kart
   */
  function attachGlbToOpponents(glbMasterScene) {
    if (!glbMasterScene) return;
    for (const opp of opponents) {
      const clonedGlb = glbMasterScene.clone(true);
      opp.microKart.attachGlbKart(clonedGlb);
    }
  }

  /**
   * Soft bumper collisions and lateral repulsion between all pairs of karts (Player + 3 Rivals)
   */
  function handleKartCollisions(playerState, dt) {
    const allKarts = [
      {
        id: 'player',
        isPlayer: true,
        s: playerState.s,
        lateralOffset: playerState.lateralOffset,
        speed: playerState.speed,
        position: playerState.position,
        stateRef: playerState,
      },
      ...opponents.map((o) => ({
        id: o.id,
        isPlayer: false,
        s: o.s,
        lateralOffset: o.lateralOffset,
        speed: o.speed,
        position: o.position,
        oppRef: o,
      })),
    ];

    for (let i = 0; i < allKarts.length; i++) {
      for (let j = i + 1; j < allKarts.length; j++) {
        const k1 = allKarts[i];
        const k2 = allKarts[j];

        // Arc length distance along track loop
        let ds = Math.abs(k1.s - k2.s);
        if (ds > totalTrackLength * 0.5) {
          ds = totalTrackLength - ds;
        }

        // Check if karts are in bumper contact zone (within 22mm longitudinally, 7.2mm laterally)
        if (ds < 0.022) {
          const dLat = k1.lateralOffset - k2.lateralOffset;
          const absDLat = Math.abs(dLat);

          if (absDLat < 0.0072) {
            const overlap = 0.0072 - absDLat;
            const repulseSign = dLat >= 0 ? 1 : -1;
            const pushStep = overlap * Math.min(1.0, dt * 12.0) * 0.5;

            // Apply soft lateral repulsion push
            if (k1.isPlayer) {
              k1.stateRef.lateralOffset = THREE.MathUtils.clamp(
                k1.stateRef.lateralOffset + repulseSign * pushStep,
                -0.0088,
                0.0088
              );
            } else {
              k1.oppRef.lateralOffset = THREE.MathUtils.clamp(
                k1.oppRef.lateralOffset + repulseSign * pushStep,
                -0.0088,
                0.0088
              );
            }

            if (k2.isPlayer) {
              k2.stateRef.lateralOffset = THREE.MathUtils.clamp(
                k2.stateRef.lateralOffset - repulseSign * pushStep,
                -0.0088,
                0.0088
              );
            } else {
              k2.oppRef.lateralOffset = THREE.MathUtils.clamp(
                k2.oppRef.lateralOffset - repulseSign * pushStep,
                -0.0088,
                0.0088
              );
            }

            // Slight momentum exchange
            if (k1.isPlayer && Math.abs(k1.speed - k2.speed) > 0.04) {
              if (audioSynth && audioSynth.playRailBumper) {
                audioSynth.playRailBumper();
              }
            }
          }
        }
      }
    }
  }

  /**
   * Main 60FPS update loop for all 3 opponents
   */
  function update(dt, elapsedTime, playerState, activePowerupManager, synth) {
    const clampedDt = Math.min(dt, 0.05);
    const raceActive = playerState.raceClockActive && !playerState.countdownLocked;

    for (const opp of opponents) {
      if (opp.raceFinished) {
        // Victory cruise after race completion
        opp.speed = THREE.MathUtils.lerp(opp.speed, 0.12, clampedDt * 2.0);
      } else if (!raceActive) {
        // Hold on starting grid while lights count down
        opp.speed = 0.0;
        opp.hasLaunched = false;
        opp.launchDelayTimer = opp.reactionTime;
      } else {
        // Launch reaction delay on lights out
        if (!opp.hasLaunched) {
          opp.launchDelayTimer -= clampedDt;
          if (opp.launchDelayTimer <= 0) {
            opp.hasLaunched = true;
            opp.speed = 0.08;
          }
        }

        if (opp.hasLaunched) {
          // Track curvature & ideal racing line calculation
          const frame = physics.sampleTrackAtArcLength(opp.s);
          const idealOffset = THREE.MathUtils.clamp(
            -frame.signedCurvature * 0.0016 + opp.lanePreference,
            -0.0068,
            0.0068
          );

          // Smoothly steer lateral offset toward ideal line
          const latDiff = idealOffset - opp.lateralOffset;
          opp.lateralVel = THREE.MathUtils.lerp(opp.lateralVel, latDiff * 3.5, clampedDt * 8.0);
          opp.lateralOffset += opp.lateralVel * clampedDt;
          opp.lateralOffset = THREE.MathUtils.clamp(opp.lateralOffset, -0.0086, 0.0086);

          // Front wheel steering visuals
          opp.steerAngle = THREE.MathUtils.clamp(latDiff * 25.0, -0.48, 0.48);
          opp.steerInput = opp.steerAngle / 0.48;
          opp.headingYaw = THREE.MathUtils.lerp(opp.headingYaw, latDiff * 6.0, clampedDt * 10.0);

          // Speed & acceleration curve
          let targetSpeed = opp.baseCruisingSpeed;

          // Curvature braking (slow down slightly on hairpin bends)
          const curveMagnitude = Math.abs(frame.signedCurvature);
          if (curveMagnitude > 8.0) {
            targetSpeed *= Math.max(0.72, 1.0 - (curveMagnitude - 8.0) * 0.025);
          }

          // Drafting boost: gain +12% speed when slipstreaming closely behind another racer
          let isDrafting = false;
          let distToPlayer = (playerState.s - opp.s + totalTrackLength) % totalTrackLength;
          if (distToPlayer > 0.015 && distToPlayer < 0.085 && Math.abs(playerState.lateralOffset - opp.lateralOffset) < 0.0045) {
            isDrafting = true;
            targetSpeed *= 1.15;
          }

          // Dynamic rubberbanding: keep field tight and fiercely competitive!
          let gapToPlayer = playerState.s - opp.s;
          if (gapToPlayer < -totalTrackLength * 0.5) gapToPlayer += totalTrackLength;
          if (gapToPlayer > totalTrackLength * 0.5) gapToPlayer -= totalTrackLength;

          if (gapToPlayer > 0.28) {
            // Trailing behind player -> catch-up surge
            targetSpeed *= 1.12;
          } else if (gapToPlayer < -0.35) {
            // Far ahead of player -> ease throttle slightly
            targetSpeed *= 0.94;
          }

          // Boost acceleration if Turbo/Rocket is active
          if (opp.boostActive > 0) {
            opp.boostActive -= clampedDt;
            targetSpeed *= 1.45;
          }

          // Accelerate toward target speed
          const accelRate = opp.speed < targetSpeed ? 0.35 * opp.aggression : 0.45;
          opp.speed = THREE.MathUtils.lerp(opp.speed, targetSpeed, clampedDt * accelRate);
        }
      }

      // Step position along track
      const prevS = opp.s;
      opp.s = (opp.s + opp.speed * clampedDt) % totalTrackLength;
      opp.totalDistance += opp.speed * clampedDt;

      // Check lap completion crossing startFinishArc
      if (prevS < startFinishArc && opp.s >= startFinishArc) {
        opp.currentLap++;
        if (opp.currentLap > 3 && !opp.raceFinished) {
          opp.raceFinished = true;
          opp.finishTime = playerState.totalRaceTime || 60.0;
        }
      }

      // Update 3D pose
      updateOpponentPose(opp);

      // Powerup Mystery Box Pickup Detection
      if (activePowerupManager && activePowerupManager.checkOpponentBoxCollision && !opp.heldItem && opp.speed > 0.05) {
        const collectedItem = activePowerupManager.checkOpponentBoxCollision(opp.position);
        if (collectedItem) {
          opp.heldItem = collectedItem;
          // AI plans to unleash item after 1.4 to 2.6 seconds
          opp.useItemTimer = 1.4 + Math.random() * 1.2;
        }
      }

      // Step Opponent Powerup Usage
      if (opp.heldItem && opp.hasLaunched) {
        opp.useItemTimer -= clampedDt;
        if (opp.useItemTimer <= 0) {
          const item = opp.heldItem;
          opp.heldItem = null;

          // Unleash powerup
          if (item.id === 'TURBO' || item.id === 'ROCKET') {
            opp.boostActive = item.duration;
            opp.speed += 0.06;
            if (typeof onRivalAlert === 'function') {
              onRivalAlert(`${opp.emoji} ${opp.name} FIRED ${item.emoji} ${item.name}!`, opp.accentHex);
            }
          } else if (item.id === 'SHIELD') {
            opp.shieldActive = item.duration;
            opp.shieldMesh.visible = true;
            if (typeof onRivalAlert === 'function') {
              onRivalAlert(`${opp.emoji} ${opp.name} ACTIVATED ${item.emoji} SHIELD!`, opp.accentHex);
            }
          } else if (item.id === 'SHOCKWAVE') {
            // Radial blast
            if (activePowerupManager.triggerBurstEffect) {
              activePowerupManager.triggerBurstEffect(opp.position.x, opp.position.y + 0.005, opp.position.z, 0xff7700);
            }
            if (typeof onRivalAlert === 'function') {
              onRivalAlert(`${opp.emoji} ${opp.name} DETONATED 💣 EMP BLAST!`, opp.accentHex);
            }
            // Check if player is nearby within 0.045m
            _tmpVec3.copy(opp.position);
            const distToPl = _tmpVec3.distanceTo(playerState.position);
            if (distToPl < 0.045 && (!playerState.shieldActive || playerState.shieldActive <= 0)) {
              playerState.speed = Math.max(0.04, playerState.speed - 0.035);
              if (synth && synth.playRailBumper) synth.playRailBumper();
            }
          }
        }
      }

      // Step Active Shield Mesh
      if (opp.shieldActive > 0) {
        opp.shieldActive -= clampedDt;
        opp.shieldMesh.visible = true;
        opp.shieldMesh.rotation.y += clampedDt * 4.0;
        if (opp.shieldActive <= 0) {
          opp.shieldMesh.visible = false;
        }
      }

      // Animate Opponent Wheels & Turbo Exhaust Plumes
      const oppVisualState = {
        speed: opp.speed,
        steerAngle: opp.steerAngle,
        steerInput: opp.steerInput,
        driftAngle: opp.driftAngle,
        boostActive: opp.boostActive,
        curbRumble: 0.0,
        hopHeight: 0.0,
        tangent: opp.tangent,
        normal: opp.normal,
        right: opp.right,
      };
      opp.microKart.updateKartVisuals(clampedDt, oppVisualState);
    }

    // Solve inter-kart collisions and bumper contact
    handleKartCollisions(playerState, clampedDt);
  }

  /**
   * Computes live race classification (P1..P4) for all 4 karts
   */
  function calculatePositions(playerState) {
    // Relative track progress measured from startFinishArc
    function getLapProgress(currentLap, s) {
      let sRel = s - startFinishArc;
      if (sRel < 0) sRel += totalTrackLength;
      return (currentLap - 1) * totalTrackLength + sRel;
    }

    const participants = [
      {
        id: 'player',
        name: 'YOU',
        emoji: '🏎️',
        number: 4,
        helmetColor: 0xffffff,
        accentHex: '#00e8ff',
        isPlayer: true,
        lapProgress: getLapProgress(playerState.lapCount || 1, playerState.s),
        currentLap: playerState.lapCount || 1,
        raceFinished: Boolean(playerState.raceFinished),
      },
      ...opponents.map((o) => ({
        id: o.id,
        name: o.name,
        emoji: o.emoji,
        number: o.number,
        helmetColor: o.helmetColor,
        accentHex: o.accentHex,
        isPlayer: false,
        lapProgress: getLapProgress(o.currentLap, o.s),
        currentLap: o.currentLap,
        raceFinished: o.raceFinished,
      })),
    ];

    // Sort descending by lap progress
    participants.sort((a, b) => b.lapProgress - a.lapProgress);

    // Assign positions 1 to 4
    return participants.map((p, idx) => ({
      ...p,
      position: idx + 1,
    }));
  }

  /**
   * Draws distinct colored blips on the 3D minimap radar for all 3 rivals
   */
  function drawMinimapOpponents(ctx, mapX, mapY) {
    if (!ctx) return;
    ctx.save();

    for (const opp of opponents) {
      const ox = mapX(opp.position.x, opp.position.y, opp.position.z);
      const oy = mapY(opp.position.x, opp.position.y, opp.position.z);

      // Radial halo
      const grad = ctx.createRadialGradient(ox, oy, 2.0, ox, oy, 16.0);
      grad.addColorStop(0.0, opp.accentHex + 'bb');
      grad.addColorStop(0.6, opp.accentHex + '44');
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ox, oy, 16.0, 0, Math.PI * 2);
      ctx.fill();

      // Outer dark border ring
      ctx.fillStyle = 'rgba(10, 14, 20, 0.85)';
      ctx.beginPath();
      ctx.arc(ox, oy, 8.5, 0, Math.PI * 2);
      ctx.fill();

      // Colored body
      ctx.fillStyle = opp.accentHex;
      ctx.beginPath();
      ctx.arc(ox, oy, 6.8, 0, Math.PI * 2);
      ctx.fill();

      // Bright white center core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ox, oy, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  return {
    opponentsGroup,
    opponents,
    resetToGrid,
    update,
    syncKartScales,
    attachGlbToOpponents,
    calculatePositions,
    drawMinimapOpponents,
  };
}
