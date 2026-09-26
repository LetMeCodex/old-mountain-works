# PART 4: Multi-Body Articulated Ragdoll Driver, Prismatic Suspension Vehicle Physics, and Stunt Director
import os

part4 = r'''
// ----------------------------------------------------------------------------
// Multi-Segment Articulated Ragdoll Driver (Coupled Pendulum + Crash Ragdoll)
// ----------------------------------------------------------------------------
class Driver {
  lean = 0;
  targetLean = 0;
  leanVel = 0;
  jolt = 0;
  joltVel = 0;
  neckAngle = 0;
  neckVel = 0;
  helmetAngle = 0;
  armAngle = 0;
  victory = 0;
  tuck = 0;
  ragdollActive = false;
  ragdollBodies = [];
  ragdollConstraints = [];

  update(vehicle, input, dt) {
    const dtSec = Math.min(0.033, Math.max(0.001, dt / 1000));
    const accel = (vehicle.forwardSpeed - (vehicle.lastForwardSpeed ?? vehicle.forwardSpeed)) / Math.max(0.004, dtSec);
    vehicle.lastForwardSpeed = vehicle.forwardSpeed;

    const angAccel = (vehicle.chassis.angularVelocity - (vehicle.lastAngVel ?? vehicle.chassis.angularVelocity)) / Math.max(0.004, dtSec);
    vehicle.lastAngVel = vehicle.chassis.angularVelocity;

    // Rollover protection tuck reaction (cos(angle) < -0.2 means chassis is inverted upside-down)
    const isInverted = Math.cos(vehicle.chassis.angle) < -0.2;
    if (isInverted) {
      this.tuck = G0(this.tuck, 1.0, 18, dt);
    } else {
      this.tuck = G0(this.tuck, 0.0, 9, dt);
    }

    // D'Alembert inertial forces on upper torso + active driver bracing
    const throttleLean = -input.throttle * 0.22;
    const brakeLean = input.brake * 0.26;
    const inertialLean = -b(accel * 0.012, -0.38, 0.38) - b(angAccel * 0.08, -0.25, 0.25);
    const slopeLean = -b(normalizeAngle(vehicle.chassis.angle) * 0.22, -0.25, 0.25);
    const airLean = vehicle.airborne ? b(-vehicle.chassis.angularVelocity * 2.5, -0.28, 0.28) : 0;

    this.targetLean = (throttleLean + brakeLean + inertialLean + slopeLean + airLean) * (1 - this.tuck * 0.45);

    // 2nd-Order Coupled Torso Spine Spring-Damper
    const spineK = 26.0;
    const spineDamp = 0.68;
    const spineTorque = (this.targetLean - this.lean) * spineK;
    this.leanVel = (this.leanVel + spineTorque * dtSec) * Math.pow(spineDamp, dtSec * 60);
    this.lean += this.leanVel * dtSec;
    this.lean = b(this.lean, -0.52, 0.52);

    // 2nd-Order Seat Cushion Vertical Suspension Jolt
    const joltForce = -this.jolt * 32.0;
    this.joltVel = (this.joltVel + joltForce * dtSec) * Math.pow(0.60, dtSec * 60);
    this.jolt += this.joltVel * dtSec;
    this.jolt = b(this.jolt, -4.5, 4.5);

    // Secondary Articulated Neck & Helmet Whip-Lash Pendulum
    const targetNeck = this.lean * 0.85 - b(accel * 0.018, -0.45, 0.45) + vehicle.chassis.angularVelocity * 1.8 + (this.tuck * 0.45);
    const neckK = 34.0;
    const neckDamp = 0.58;
    const neckTorque = (targetNeck - this.neckAngle) * neckK;
    this.neckVel = (this.neckVel + neckTorque * dtSec) * Math.pow(neckDamp, dtSec * 60);
    this.neckAngle += this.neckVel * dtSec;
    this.neckAngle = b(this.neckAngle, -0.75, 0.75);
    this.helmetAngle = this.neckAngle;

    this.victory = Math.max(0, this.victory - dtSec * 0.5);
  }

  applyShock(energy) {
    const impulse = b(energy * 0.45, 0.4, 3.2);
    this.jolt += impulse;
    this.joltVel += impulse * 8.5;
    this.jolt = b(this.jolt, -4.5, 4.5);
    const whip = (Math.random() - 0.35) * b(energy * 0.25, 0.15, 0.65);
    this.leanVel += whip * 6.0;
    this.neckVel += whip * 12.0;
  }

  triggerVictory() {
    this.victory = 1.2;
  }

  spawnCrashRagdoll(world, chassis) {
    if (this.ragdollActive || !world || !chassis) return;
    this.ragdollActive = true;
    const cx = chassis.position.x;
    const cy = chassis.position.y;
    const ang = chassis.angle;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);

    const toWorld = (lx, ly) => ({
      x: cx + lx * cos - ly * sin,
      y: cy + lx * sin + ly * cos,
    });

    const torsoPos = toWorld(-20, -20);
    const headPos = toWorld(-20, -36);
    const armPos = toWorld(-8, -24);

    const torso = Matter.Bodies.rectangle(torsoPos.x, torsoPos.y, 10, 18, {
      label: "ragdoll_torso",
      collisionFilter: { group: -3 },
      density: 0.0008,
      friction: 0.4,
      restitution: 0.15,
      angle: ang + this.lean,
    });
    const head = Matter.Bodies.circle(headPos.x, headPos.y, 7.5, {
      label: "ragdoll_head",
      collisionFilter: { group: -3 },
      density: 0.0006,
      friction: 0.3,
      restitution: 0.25,
    });
    const arm = Matter.Bodies.rectangle(armPos.x, armPos.y, 14, 5, {
      label: "ragdoll_arm",
      collisionFilter: { group: -3 },
      density: 0.0004,
      friction: 0.3,
      restitution: 0.1,
      angle: ang,
    });

    const vx = b(chassis.velocity.x * 1.15, -18, 18);
    const vy = b(chassis.velocity.y - 3.5, -18, 12);
    Matter.Body.setVelocity(torso, { x: vx, y: vy });
    Matter.Body.setVelocity(head, { x: vx + (Math.random() - 0.5) * 2, y: vy - 1.5 });
    Matter.Body.setVelocity(arm, { x: vx, y: vy });
    Matter.Body.setAngularVelocity(torso, (Math.random() - 0.5) * 0.08);

    const seatLap = Matter.Constraint.create({
      bodyA: chassis,
      pointA: { x: -22, y: -10 },
      bodyB: torso,
      pointB: { x: 0, y: 7 },
      length: 4,
      stiffness: 0.35,
      damping: 0.1,
    });
    const neckJoint = Matter.Constraint.create({
      bodyA: torso,
      pointA: { x: 0, y: -9 },
      bodyB: head,
      pointB: { x: 0, y: 6 },
      length: 2,
      stiffness: 0.75,
      damping: 0.1,
    });
    const shoulderJoint = Matter.Constraint.create({
      bodyA: torso,
      pointA: { x: 2, y: -6 },
      bodyB: arm,
      pointB: { x: -6, y: 0 },
      length: 2,
      stiffness: 0.65,
      damping: 0.1,
    });

    this.ragdollBodies = [torso, head, arm];
    this.ragdollConstraints = [seatLap, neckJoint, shoulderJoint];
    Matter.Composite.add(world, [...this.ragdollBodies, ...this.ragdollConstraints]);
  }

  clearRagdoll(world) {
    if (!world) return;
    for (const c of this.ragdollConstraints) {
      try { Matter.Composite.remove(world, c); } catch (e) {}
    }
    for (const bBody of this.ragdollBodies) {
      try { Matter.Composite.remove(world, bBody); } catch (e) {}
    }
    this.ragdollBodies = [];
    this.ragdollConstraints = [];
    this.ragdollActive = false;
  }
}

// ----------------------------------------------------------------------------
// Expedition Vehicle (f0) - Prismatic Suspension & Surface-Tangent Traction
// ----------------------------------------------------------------------------
class f0 {
  archetype;
  chassis;
  wheels = [];
  constraints = [];
  composite;
  driver = new Driver();
  audio = null;
  airborneTimer = 0;
  groundClearance = 0;

  constructor(xPos, yPos, archetypeId = "buggy", audio = null) {
    this.audio = audio;
    this.setArchetype(archetypeId, xPos, yPos);
  }

  setArchetype(archetypeId, xPos = null, yPos = null) {
    const vCfg = VEHICLE_ARCHETYPES[archetypeId] ?? VEHICLE_ARCHETYPES.buggy;
    this.archetype = vCfg;
    x.activeArchetype = vCfg.id;
    x.vehicle = vCfg;

    const posX = xPos ?? this.chassis?.position.x ?? x.world.startX;
    const posY = yPos ?? this.chassis?.position.y ?? x.world.groundBase - (vCfg.wheelOffsetY + vCfg.wheelRadius);

    this.chassis = d.default.Bodies.rectangle(
      posX,
      posY,
      vCfg.chassisWidth,
      vCfg.chassisHeight,
      {
        label: "chassis",
        collisionFilter: { group: -3 },
        density: vCfg.chassisMass / (vCfg.chassisWidth * vCfg.chassisHeight),
        friction: 0.12,
        frictionAir: 0.004,
        restitution: 0.02,
        chamfer: { radius: [6, 6, 12, 12] },
      }
    );

    // High polar moment of inertia prevents twitchy pitching and gives weighty stability
    const defInertia = (vCfg.chassisMass * (vCfg.chassisWidth * vCfg.chassisWidth + vCfg.chassisHeight * vCfg.chassisHeight)) / 12;
    Matter.Body.setInertia(this.chassis, defInertia * 2.4);

    // Low Center of Mass for natural hill-climbing balance
    Matter.Body.setCentre(this.chassis, { x: 0, y: 4 }, true);

    const wheelOffsets = [
      { x: -vCfg.wheelBase / 2, y: vCfg.wheelOffsetY }, // Rear wheel (0)
      { x: vCfg.wheelBase / 2, y: vCfg.wheelOffsetY },  // Front wheel (1)
    ];

    this.wheels = [];
    this.constraints = [];

    for (let i = 0; i < wheelOffsets.length; i++) {
      const off = wheelOffsets[i];
      const wheel = d.default.Bodies.circle(
        posX + off.x,
        posY + off.y,
        vCfg.wheelRadius,
        {
          label: "wheel",
          collisionFilter: { group: -3 },
          density: vCfg.wheelMass / (Math.PI * vCfg.wheelRadius * vCfg.wheelRadius),
          friction: vCfg.tireGrip,
          frictionStatic: vCfg.tireGrip * 1.5,
          frictionAir: 0.003,
          restitution: 0.0, // Zero superball bounce on terrain polygon seams!
          slop: 0.01,
        }
      );

      // Symmetric Wishbone + Primary Coilover Strut (paired with exact 1D Prismatic Axis projection)
      const springStrut = d.default.Constraint.create({
        bodyA: this.chassis,
        pointA: { x: off.x, y: 0 },
        bodyB: wheel,
        length: vCfg.wheelOffsetY,
        stiffness: vCfg.suspensionStiffness,
        damping: vCfg.suspensionDamping,
      });

      const guideSpread = 22;
      const guideLen = Math.hypot(guideSpread, vCfg.wheelOffsetY);
      const guideLeft = d.default.Constraint.create({
        bodyA: this.chassis,
        pointA: { x: off.x - guideSpread, y: 0 },
        bodyB: wheel,
        length: guideLen,
        stiffness: vCfg.suspensionStiffness * 0.85,
        damping: vCfg.suspensionDamping,
      });
      const guideRight = d.default.Constraint.create({
        bodyA: this.chassis,
        pointA: { x: off.x + guideSpread, y: 0 },
        bodyB: wheel,
        length: guideLen,
        stiffness: vCfg.suspensionStiffness * 0.85,
        damping: vCfg.suspensionDamping,
      });

      this.constraints.push(springStrut, guideLeft, guideRight);

      this.wheels.push({
        body: wheel,
        restOffset: off,
        compression: 0,
        lastCompression: 0,
        contact: true,
        contactGrace: 100,
        slip: 0,
        slipRatio: 0,
        material: "grass",
      });
    }

    this.composite = d.default.Composite.create({ label: "vehicle" });
    d.default.Composite.add(this.composite, [
      this.chassis,
      ...this.wheels.map((w) => w.body),
      ...this.constraints,
    ]);
  }

  get speed() {
    return d.default.Vector.magnitude(this.chassis.velocity);
  }

  get forwardSpeed() {
    const dir = {
      x: Math.cos(this.chassis.angle),
      y: Math.sin(this.chassis.angle),
    };
    return d.default.Vector.dot(dir, this.chassis.velocity);
  }

  normalLoads = { front: 0, rear: 0 };
  roofContact = false;

  get rpm() {
    const maxSpin = Math.max(...this.wheels.map((w) => Math.abs(w.body.angularVelocity)));
    return b(maxSpin / this.archetype.maxWheelSpeed, 0, 1.4);
  }

  get airborne() {
    return !this.wheels.some((w) => w.contact);
  }

  // --------------------------------------------------------------------------
  // PRISMATIC LINE CONSTRAINT SOLVER (Inspired by AngeTheGreat line_constraint)
  // Projects wheel strictly onto the chassis local suspension strut axis (C_perp = 0)
  // and enforces physical bump-stop & droop-stop travel limits [minY, maxY].
  // --------------------------------------------------------------------------
  solvePrismaticSuspension() {
    const vCfg = this.archetype;
    const cPos = this.chassis.position;
    const cVel = this.chassis.velocity;
    const theta = this.chassis.angle;
    const omega = this.chassis.angularVelocity;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    // Local chassis basis vectors: tHat = forward, nHat = downward strut axis
    const tHat = { x: cos, y: sin };
    const nHat = { x: -sin, y: cos };

    const minAxialY = Math.max(16, vCfg.wheelOffsetY - vCfg.suspensionTravel * 0.72);
    const maxAxialY = vCfg.wheelOffsetY + vCfg.suspensionTravel * 0.42;

    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      const wPos = w.body.position;
      const wVel = w.body.velocity;

      const dx = wPos.x - cPos.x;
      const dy = wPos.y - cPos.y;

      // Wheel coordinates in chassis local frame
      const localX = dx * tHat.x + dy * tHat.y;
      const localY = dx * nHat.x + dy * nHat.y;

      const targetX = w.restOffset.x;
      const clampedY = b(localY, minAxialY, maxAxialY);

      const errX = localX - targetX;
      const errY = localY - clampedY;

      // Project position onto prismatic strut line if lateral drift or travel limit exceeded
      if (Math.abs(errX) > 0.15 || Math.abs(errY) > 0.05) {
        const newWorldX = cPos.x + targetX * tHat.x + clampedY * nHat.x;
        const newWorldY = cPos.y + targetX * tHat.y + clampedY * nHat.y;

        // Mount velocity in world space: v_mount = v_c + omega x r_mount
        const mountVx = cVel.x - omega * (targetX * sin + clampedY * cos);
        const mountVy = cVel.y + omega * (targetX * cos - clampedY * sin);

        // Preserve axial velocity along nHat while damping lateral error velocity along tHat
        const relVx = wVel.x - mountVx;
        const relVy = wVel.y - mountVy;
        let axialVel = relVx * nHat.x + relVy * nHat.y;
        if (localY <= minAxialY && axialVel < 0) axialVel = 0;
        if (localY >= maxAxialY && axialVel > 0) axialVel = 0;

        const lateralVel = (relVx * tHat.x + relVy * tHat.y) * 0.15;

        const nextVx = mountVx + tHat.x * lateralVel + nHat.x * axialVel;
        const nextVy = mountVy + tHat.y * lateralVel + nHat.y * axialVel;

        Matter.Body.setPosition(w.body, { x: newWorldX, y: newWorldY });
        Matter.Body.setVelocity(w.body, { x: nextVx, y: nextVy });
      }

      // Compute normalized suspension compression [-1, 1]
      w.compression = b(
        (vCfg.wheelOffsetY - clampedY) / vCfg.suspensionTravel,
        -1,
        1
      );
    }
  }

  update(input, dt, terrain = null) {
    const vCfg = this.archetype;
    const throttleBrake = input.throttle - input.brake;
    const dtSec = Math.max(0.001, dt / 1000);

    // 1. Enforce 1D Prismatic Strut Axis & Travel Limits before applying forces
    this.solvePrismaticSuspension();

    if (this.airborne) {
      this.airborneTimer += dt;
    } else {
      this.airborneTimer = 0;
    }

    // Compute true ground clearance under the tires
    if (terrain) {
      const groundY = terrain.heightAt(this.chassis.position.x);
      const lowestTireY = Math.max(
        this.wheels[0].body.position.y + vCfg.wheelRadius,
        this.wheels[1].body.position.y + vCfg.wheelRadius
      );
      this.groundClearance = Math.max(0, groundY - lowestTireY);
    } else {
      this.groundClearance = this.airborne ? 200 : 0;
    }

    // Dynamic Normal Load Distribution (Spec #03):
    const theta = normalizeAngle(this.chassis.angle);
    const ax = b((this.forwardSpeed - (this.lastForwardSpeed ?? this.forwardSpeed)) / dtSec, -45, 45);
    const m = this.chassis.mass;
    const g = 9.81 * 8.0;
    const W = m * g;
    const L = vCfg.wheelBase;
    const b_dist = L / 2;
    const a_dist = L / 2;
    const h = vCfg.centerOfMassOffsetY ?? 6.0;

    const nFront = Math.max(0.15, (W * (b_dist * Math.cos(theta) - h * Math.sin(theta)) - m * h * ax * 0.25) / L);
    const nRear = Math.max(0.15, (W * (a_dist * Math.cos(theta) + h * Math.sin(theta)) + m * h * ax * 0.25) / L);
    this.normalLoads = { front: nFront, rear: nRear };

    // Local terrain slope under chassis
    const groundSlope = terrain ? terrain.slopeAt(this.chassis.position.x) : 0;

    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      const isRear = i === 0;
      const torqueShare = isRear ? 0.54 : 0.46;
      const spin = w.body.angularVelocity;
      const speedRatio = b(1 - Math.abs(spin) / vCfg.maxWheelSpeed, 0, 1);

      // Wheel Slip Ratio & Saturating Traction Curve S(kappa)
      const R = vCfg.wheelRadius;
      const rw = spin * R;
      const vx = this.forwardSpeed;
      const denom = Math.max(Math.abs(rw), Math.abs(vx), 0.1);
      w.slipRatio = b((rw - vx) / denom, -1.5, 1.5);

      if (throttleBrake !== 0) {
        const isDriving = Math.sign(throttleBrake) === Math.sign(spin) || Math.abs(spin) < 0.03;
        const torque = isDriving
          ? vCfg.engineTorque * (0.25 + 0.75 * speedRatio) * throttleBrake
          : vCfg.brakeTorque * throttleBrake;

        // Spin wheel smoothly within maxWheelSpeed
        const targetSpinDelta = torque * torqueShare * 0.32 * (dt / 8.333);
        const nextSpin = b(spin + targetSpinDelta, -vCfg.maxWheelSpeed, vCfg.maxWheelSpeed);
        d.default.Body.setAngularVelocity(w.body, nextSpin);

        // True Surface-Tangent Rolling Traction (only when wheel is on ground & car is upright!)
        if (w.contact && Math.cos(theta) > 0.25) {
          const mat = MATERIALS[w.material] ?? MATERIALS.dirt;
          const wheelSlope = terrain ? terrain.slopeAt(w.body.position.x) : theta;
          const tangentDir = {
            x: Math.cos(wheelSlope),
            y: Math.sin(wheelSlope),
          };
          const normalDir = {
            x: -Math.sin(wheelSlope),
            y: Math.cos(wheelSlope),
          };

          const topSpeedLimiter = b(1 - Math.abs(this.forwardSpeed) / 16.5, 0.08, 1.0);
          const tractiveMag = torque * torqueShare * mat.friction * 0.18 * topSpeedLimiter;

          // Apply propulsion along the terrain tangent + subtle tire-ground normal grip
          Matter.Body.applyForce(this.chassis, this.chassis.position, {
            x: tangentDir.x * tractiveMag,
            y: tangentDir.y * tractiveMag + normalDir.y * Math.abs(tractiveMag) * 0.12,
          });
        }
      } else {
        d.default.Body.setAngularVelocity(w.body, spin * 0.985);
      }

      const deltaComp = w.compression - w.lastCompression;
      if (deltaComp > 0.26 && w.compression > 0.35 && this.audio) {
        this.audio.creak(deltaComp);
      }
      w.lastCompression = w.compression;
      w.slip = Math.abs(spin * vCfg.wheelRadius - this.forwardSpeed);
    }

    // -------------------------------------------------------------------------
    // GROUND STABILITY & GENUINE HILL CLIMB RACING PITCH CONTROL
    // -------------------------------------------------------------------------
    const relPitch = normalizeAngle(theta - groundSlope);

    if (!this.airborne) {
      // ON GROUND: Keep vehicle planted and stable!
      // Subtle weight-transfer pitch feel (wheelie lift on gas, nose dive on brake),
      // strictly bounded to +-16 degrees relative to the slope so it NEVER flips on the ground!
      if (throttleBrake > 0 && relPitch > -0.26 && Math.cos(theta) > 0.5) {
        this.chassis.torque += -0.0008 * this.chassis.mass * b(1 - Math.abs(relPitch) / 0.26, 0, 1);
      } else if (throttleBrake < 0 && relPitch < 0.26 && Math.cos(theta) > 0.5) {
        this.chassis.torque += 0.0008 * this.chassis.mass * b(1 - Math.abs(relPitch) / 0.26, 0, 1);
      }

      // Strong anti-flip suspension restoring torque when both or either wheel is grounded
      if (Math.cos(theta) > 0.15) {
        const pitchError = normalizeAngle(theta - groundSlope);
        if (Math.abs(pitchError) > 0.22) {
          const excess = pitchError - Math.sign(pitchError) * 0.22;
          this.chassis.torque += -excess * 0.028 * this.chassis.mass;
        }
        // Damp ground pitch oscillations strongly
        this.chassis.torque += -this.chassis.angularVelocity * 0.045 * this.chassis.mass;
      }
    } else {
      // IN MID-AIR:
      // Distinguish between small trail hops (groundClearance <= 38px) vs real high jumps!
      const isHighJump = this.groundClearance > 38 && this.airborneTimer >= 140;
      if (isHighJump && throttleBrake !== 0) {
        // Deliberate High-Air Stunt Control:
        // D (Throttle > 0) -> Counter-clockwise (dir = -1 -> BACKFLIP)
        // A (Brake > 0)    -> Clockwise         (dir = +1 -> FRONTFLIP)
        const dir = -Math.sign(throttleBrake);
        const angVel = this.chassis.angularVelocity;
        // Target flip speed for 1.0s 360-degree stunt rotation in high air
        const maxFlipRate = 0.115;
        const spinLimit = b(1 - Math.abs(angVel) / maxFlipRate, 0, 1);
        const opposing = Math.sign(dir) !== Math.sign(angVel) ? 1.25 : spinLimit;
        const airTorque = dir * Math.abs(throttleBrake) * vCfg.airControl * opposing * this.chassis.mass * 34.0;
        this.chassis.torque += airTorque;
      } else if (!isHighJump && Math.cos(theta) > 0.2) {
        // Low trail hop: gently auto-level chassis to terrain slope for smooth 4-wheel landings!
        const hopError = normalizeAngle(theta - groundSlope);
        this.chassis.torque += -hopError * 0.018 * this.chassis.mass - this.chassis.angularVelocity * 0.035 * this.chassis.mass;
      }
    }

    // Inverted Self-Righting Roll Recovery (when resting upside down on roof)
    const isUpsideDown = !this.airborne && (Math.abs(theta) > 1.65 || this.roofContact);
    if (isUpsideDown && throttleBrake !== 0) {
      const rollDir = Math.sign(throttleBrake);
      this.chassis.torque += rollDir * this.chassis.mass * 0.32;
      Matter.Body.applyForce(this.chassis, this.chassis.position, {
        x: rollDir * 0.014 * this.chassis.mass,
        y: -0.024 * this.chassis.mass,
      });
    }

    // Angular velocity damping & hard safety clamp
    const damping = this.airborne ? vCfg.angularDamping * 0.65 : vCfg.angularDamping * 3.2;
    const factor = 1 - Math.min(damping * (dt / 16.666), 0.45);
    const maxAllowedAngVel = (this.airborne && this.groundClearance > 38) ? 0.125 : 0.045;
    const clampedAngVel = b(this.chassis.angularVelocity * factor, -maxAllowedAngVel, maxAllowedAngVel);
    d.default.Body.setAngularVelocity(this.chassis, clampedAngVel);

    this.driver.update(this, input, dt);
  }

  markContacts(terrainSet, activePairs, terrain = null, dt = 8.333) {
    this.roofContact = false;
    const pairHit = [false, false];

    for (const pair of activePairs) {
      const { bodyA, bodyB } = pair;
      for (let i = 0; i < this.wheels.length; i++) {
        const w = this.wheels[i];
        if (bodyA === w.body || bodyB === w.body) {
          const other = bodyA === w.body ? bodyB : bodyA;
          if (terrainSet.has(other)) {
            pairHit[i] = true;
            w.contact = true;
            w.contactGrace = 85;
            w.material = other.materialKind ?? "grass";
          }
        }
      }

      // Check chassis roof contact
      const isChassis = bodyA === this.chassis || bodyB === this.chassis;
      if (isChassis) {
        const other = bodyA === this.chassis ? bodyB : bodyA;
        if (terrainSet.has(other)) {
          const supports = pair.collision?.supports ?? [];
          for (const pt of supports) {
            if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue;
            const relY = (pt.x - this.chassis.position.x) * -Math.sin(this.chassis.angle) +
                         (pt.y - this.chassis.position.y) * Math.cos(this.chassis.angle);
            if (relY < -this.archetype.chassisHeight * 0.2) {
              this.roofContact = true;
            }
          }
        }
      }
    }

    // Spline proximity & grace hysteresis so 18px polygon seams never cause false airborne state
    const vCfg = this.archetype;
    const upright = Math.cos(this.chassis.angle) > 0.15;

    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      if (pairHit[i]) continue;

      let nearSpline = false;
      if (terrain && upright && w.body.velocity.y >= -3.2) {
        const ty = terrain.heightAt(w.body.position.x);
        const tireBottom = w.body.position.y + vCfg.wheelRadius;
        if (Math.abs(ty - tireBottom) <= 6.5) {
          nearSpline = true;
          w.material = terrain.materialAt(w.body.position.x)?.name ?? "grass";
        }
      }

      if (nearSpline) {
        w.contact = true;
        w.contactGrace = 65;
      } else {
        w.contactGrace = Math.max(0, (w.contactGrace ?? 0) - dt);
        if (w.contactGrace > 0 && terrain) {
          const ty = terrain.heightAt(w.body.position.x);
          const tireBottom = w.body.position.y + vCfg.wheelRadius;
          w.contact = (ty - tireBottom) < 12.0;
        } else {
          w.contact = false;
        }
      }
    }
  }
}

// ----------------------------------------------------------------------------
// Stunt Director & Combo System
// ----------------------------------------------------------------------------
class StuntDirector {
  bus;
  audio;
  camera;
  airtime = 0;
  groundedTime = 200;
  airDistance = 0;
  airApexY = Infinity;
  launchX = 0;
  launchY = 0;
  cumulativeAngle = 0;
  prevAngle = 0;
  backflips = 0;
  frontflips = 0;
  wheelieTime = 0;
  wheelieDistance = 0;
  stoppieTime = 0;
  stoppieDistance = 0;
  comboMultiplier = 1;
  comboScore = 0;
  comboTimer = 0;
  activeStuntName = "";

  constructor(bus, audio, camera) {
    this.bus = bus;
    this.audio = audio;
    this.camera = camera;
  }

  reset() {
    this.airtime = 0;
    this.groundedTime = 200;
    this.airDistance = 0;
    this.airApexY = Infinity;
    this.cumulativeAngle = 0;
    this.prevAngle = 0;
    this.backflips = 0;
    this.frontflips = 0;
    this.wheelieTime = 0;
    this.wheelieDistance = 0;
    this.stoppieTime = 0;
    this.stoppieDistance = 0;
    this.comboMultiplier = 1;
    this.comboScore = 0;
    this.comboTimer = 0;
    this.activeStuntName = "";
  }

  update(vehicle, terrain, dt) {
    const isAirborne = vehicle.airborne;
    const chassis = vehicle.chassis;

    if (this.comboTimer > 0) {
      this.comboTimer -= dt / 1000;
      if (this.comboTimer <= 0) {
        this.endCombo();
      }
    }

    if (isAirborne) {
      if (this.groundedTime >= 150 || (this.airtime === 0 && this.cumulativeAngle === 0)) {
        this.launchX = chassis.position.x;
        this.launchY = chassis.position.y;
        this.prevAngle = chassis.angle;
        this.airApexY = chassis.position.y;
        this.cumulativeAngle = 0;
        this.backflips = 0;
        this.frontflips = 0;
      }
      this.groundedTime = 0;

      this.airtime += dt;
      this.airDistance = Math.abs(chassis.position.x - this.launchX) / 40;
      this.airApexY = Math.min(this.airApexY, chassis.position.y);

      let deltaAngle = chassis.angle - this.prevAngle;
      while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
      while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
      this.cumulativeAngle += deltaAngle;
      this.prevAngle = chassis.angle;

      // Negative cumulative angle = counter-clockwise = BACKFLIP
      if (this.cumulativeAngle <= -(Math.PI * 2 * (this.backflips + 1) - 0.4)) {
        this.backflips++;
        const name = this.backflips === 1 ? "BACKFLIP" : this.backflips === 2 ? "DOUBLE BACKFLIP" : `TRIPLE BACKFLIP`;
        const score = this.backflips * 260;
        this.awardStunt(name, score, 2);
        vehicle.driver.triggerVictory();
      } else if (this.cumulativeAngle >= Math.PI * 2 * (this.frontflips + 1) - 0.4) {
        // Positive cumulative angle = clockwise = FRONTFLIP
        this.frontflips++;
        const name = this.frontflips === 1 ? "FRONTFLIP" : this.frontflips === 2 ? "DOUBLE FRONTFLIP" : `TRIPLE FRONTFLIP`;
        const score = this.frontflips * 300;
        this.awardStunt(name, score, 2);
        vehicle.driver.triggerVictory();
      }
    } else {
      this.groundedTime += dt;
      this.checkGroundStunts(vehicle, terrain, dt);
    }
  }

  checkGroundStunts(vehicle, terrain, dt) {
    const rear = vehicle.wheels[0];
    const front = vehicle.wheels[1];
    const dtSec = dt / 1000;
    const speed = Math.abs(vehicle.forwardSpeed);

    // Wheelie: Rear wheel in contact, front wheel lifted
    if (rear.contact && !front.contact && speed > 2.5) {
      if (this.wheelieTime === 0) this.wheelieStartX = vehicle.chassis.position.x;
      this.wheelieTime += dtSec;
      this.wheelieDistance = Math.abs(vehicle.chassis.position.x - (this.wheelieStartX || vehicle.chassis.position.x)) / 40;

      if (this.wheelieTime >= 1.2 && Math.floor((this.wheelieTime - dtSec) / 1.2) < Math.floor(this.wheelieTime / 1.2)) {
        const pts = Math.round(80 + this.wheelieDistance * 8);
        this.awardStunt(`WHEELIE ${Math.round(this.wheelieDistance)}m`, pts, 1);
      }
    } else {
      this.wheelieTime = 0;
      this.wheelieDistance = 0;
    }

    // Stoppie / Nose Manual: Front wheel in contact, rear wheel lifted
    if (front.contact && !rear.contact && speed > 2.0) {
      if (this.stoppieTime === 0) this.stoppieStartX = vehicle.chassis.position.x;
      this.stoppieTime += dtSec;
      this.stoppieDistance = Math.abs(vehicle.chassis.position.x - (this.stoppieStartX || vehicle.chassis.position.x)) / 40;

      if (this.stoppieTime >= 0.9 && Math.floor((this.stoppieTime - dtSec) / 0.9) < Math.floor(this.stoppieTime / 0.9)) {
        this.awardStunt(`NOSE BALANCE`, 120, 2);
      }
    } else {
      this.stoppieTime = 0;
      this.stoppieDistance = 0;
    }
  }

  onLanding(vehicle, terrain) {
    if (this.airtime < 420) {
      this.airtime = 0;
      return;
    }

    const slope = terrain.slopeAt(vehicle.chassis.position.x);
    const angleDiff = Math.abs(normalizeAngle(vehicle.chassis.angle - slope));
    const vy = Math.abs(vehicle.chassis.velocity.y);
    const heightMeters = Math.max(0, (this.launchY - this.airApexY) / 40);

    // Big Air & Long Jump
    if (this.airDistance >= 14) {
      const jumpScore = Math.round(this.airDistance * 12);
      this.awardStunt(`LONG JUMP ${this.airDistance.toFixed(0)}m`, jumpScore, 2);
    } else if (heightMeters >= 3.2 || this.airtime >= 950) {
      this.awardStunt(`BIG AIR`, 180, 1);
    }

    // Clean / Perfect Landing check (chassis aligned with terrain slope)
    if (angleDiff < 0.24 && !vehicle.roofContact) {
      if (this.airtime >= 680 || this.backflips > 0 || this.frontflips > 0) {
        const bonus = (this.backflips + this.frontflips) > 0 ? 220 : 110;
        this.awardStunt("PERFECT LANDING", bonus, 3);
        this.camera.pulseZoom(0.035);
        vehicle.driver.triggerVictory();
      }
    } else if (angleDiff > 0.75 || vy > 9.5) {
      // Hard Slam Landing
      if (this.comboMultiplier > 1) {
        this.showToast("HARD SLAM!", 1);
      }
    }

    this.airtime = 0;
  }

  awardStunt(name, baseScore, tier = 1) {
    this.comboScore += baseScore * this.comboMultiplier;
    if (this.comboTimer > 0) {
      this.comboMultiplier = Math.min(8, this.comboMultiplier + 1);
    } else {
      this.comboMultiplier = 1;
    }
    this.comboTimer = 4.2;
    this.activeStuntName = name;

    this.audio.stuntChime(tier);
    this.bus.emit("stunt:awarded", {
      name,
      score: baseScore * this.comboMultiplier,
      multiplier: this.comboMultiplier,
      tier,
    });
  }

  showToast(name, tier = 1) {
    this.bus.emit("stunt:awarded", {
      name,
      score: 0,
      multiplier: 1,
      tier,
    });
  }

  endCombo() {
    this.comboMultiplier = 1;
    this.comboScore = 0;
    this.comboTimer = 0;
    this.activeStuntName = "";
  }
}
'''

with open('engine_part4.js', 'w', encoding='utf-8') as f:
    f.write(part4)

print("Part 4 updated successfully.")
