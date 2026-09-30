
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
  fuel = 1.0;
  engineTemp = 0.28;

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
  lastEngineForce = 0;
  lastBrakeForce = 0;
  climbingStalled = false;

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
  solvePrismaticSuspension(terrain = null) {
    const vCfg = this.archetype;
    let cPos = this.chassis.position;
    let cVel = this.chassis.velocity;
    const theta = this.chassis.angle;
    const omega = this.chassis.angularVelocity;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    // Anti-tunneling guard for chassis center against continuous terrain spline
    if (terrain && Number.isFinite(cPos.x) && Number.isFinite(cPos.y)) {
      const cGroundY = terrain.heightAt(cPos.x);
      const minChassisSurfaceY = cGroundY - 10;
      if (cPos.y > minChassisSurfaceY) {
        Matter.Body.setPosition(this.chassis, { x: cPos.x, y: minChassisSurfaceY });
        if (cVel.y > 0) {
          Matter.Body.setVelocity(this.chassis, { x: cVel.x, y: 0 });
        }
        cPos = this.chassis.position;
        cVel = this.chassis.velocity;
      }
    }

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
        let newWorldX = cPos.x + targetX * tHat.x + clampedY * nHat.x;
        let newWorldY = cPos.y + targetX * tHat.y + clampedY * nHat.y;

        // Prevent bump-stop projection from pushing wheel below terrain spline
        if (terrain && Number.isFinite(newWorldX) && Number.isFinite(newWorldY)) {
          const wheelFloorY = terrain.heightAt(newWorldX) - vCfg.wheelRadius + 2.5;
          if (newWorldY > wheelFloorY) {
            const penY = newWorldY - wheelFloorY;
            newWorldY = wheelFloorY;
            if (cos > 0.15 && penY > 0.5) {
              Matter.Body.setPosition(this.chassis, { x: cPos.x, y: cPos.y - penY * 0.65 });
              cPos = this.chassis.position;
            }
          }
        }

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
    this.solvePrismaticSuspension(terrain);

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

    // Dynamic Normal Load Distribution & Center of Mass (Sections 11, 12):
    const theta = normalizeAngle(this.chassis.angle);
    const ax = b((this.forwardSpeed - (this.lastForwardSpeed ?? this.forwardSpeed)) / dtSec, -45, 45);
    const m = this.chassis.mass;
    const g = 9.81 * 8.0;
    const W = m * g;
    const L = vCfg.wheelBase;
    const b_dist = L / 2;
    const a_dist = L / 2;
    const h = vCfg.centerOfMassOffsetY ?? 6.0;

    const nFront = Math.max(0.10, (W * (b_dist * Math.cos(theta) - h * Math.sin(theta)) - m * h * ax * 0.32) / L);
    const nRear = Math.max(0.10, (W * (a_dist * Math.cos(theta) + h * Math.sin(theta)) + m * h * ax * 0.32) / L);
    this.normalLoads = { front: nFront, rear: nRear };

    // Local terrain slope & curvature under chassis
    const groundSlope = terrain ? terrain.slopeAt(this.chassis.position.x) : 0;
    const groundCurv = (terrain && terrain.curvatureAt) ? terrain.curvatureAt(this.chassis.position.x) : 0;

    this.lastEngineForce = 0;
    this.lastBrakeForce = 0;

    // Momentum-Based Climbing Curve (Sections 3, 14, 23):
    // Steep uphill climbs (groundSlope < -0.44 rad / > 25 deg) require entering with momentum!
    // Low momentum causes engine lugging and wheel slip; insufficient momentum stalls & rolls backward!
    const uphillSteepness = Math.max(0, -groundSlope); // positive when climbing uphill
    const fwdSpd = this.forwardSpeed;
    let momentumClimbFactor = 1.0;
    if (uphillSteepness > 0.44) {
      // Above 25 deg uphill: reward high entry speed (> 6.5), penalize dead-stop crawling (< 3.5)
      const speedCarry = b((fwdSpd - 1.2) / 6.5, 0.0, 1.35);
      const steepPenalty = b((uphillSteepness - 0.44) / 0.36, 0, 1);
      momentumClimbFactor = b(0.32 + speedCarry * 0.88 - steepPenalty * 0.38, 0.22, 1.32);
    }

    // Active Disc Braking Mechanic (Section 4):
    // Pressing Brake (A) while moving forward (> 0.8) applies high-authority braking force & front weight transfer!
    const isBrakingForward = input.brake > 0.05 && input.throttle < 0.1 && fwdSpd > 0.8;
    // Pressing Brake (A) while rolling backward on a steep climb arrests the rollback!
    const isHoldingHillBrake = input.brake > 0.05 && input.throttle < 0.1 && fwdSpd < -0.2 && uphillSteepness > 0.32;

    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      const isRear = i === 0;
      const torqueShare = isRear ? 0.56 : 0.44;
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
          ? vCfg.engineTorque * (0.25 + 0.75 * speedRatio) * throttleBrake * momentumClimbFactor
          : vCfg.brakeTorque * throttleBrake;

        const targetSpinDelta = torque * torqueShare * 0.32 * (dt / 8.333);
        const nextSpin = b(spin + targetSpinDelta, -vCfg.maxWheelSpeed, vCfg.maxWheelSpeed);
        d.default.Body.setAngularVelocity(w.body, nextSpin);

        // True Surface-Tangent Rolling Traction & Disc Braking (only when wheel is on ground & car is upright!)
        if (w.contact && Math.cos(theta) > 0.20) {
          const mat = MATERIALS[w.material] ?? MATERIALS.dirt;
          const wheelSlope = terrain ? terrain.slopeAt(w.body.position.x) : theta;
          const tangentDir = {
            x: Math.cos(wheelSlope),
            y: Math.sin(wheelSlope),
          };

          if (isBrakingForward) {
            // Dedicated Mechanical Disc Brake Force opposing forward motion along the slope
            const loadShare = isRear ? (nRear / (nFront + nRear)) : (nFront / (nFront + nRear)) * 1.35;
            const brakeMag = input.brake * vCfg.brakeTorque * loadShare * mat.friction * 0.34;
            this.lastBrakeForce += brakeMag * 1000;
            Matter.Body.applyForce(this.chassis, this.chassis.position, {
              x: -tangentDir.x * brakeMag,
              y: -tangentDir.y * brakeMag,
            });
          } else if (isHoldingHillBrake && fwdSpd > -3.2) {
            // Holding brake on a failed climb arrests backward rollback before reversing
            const holdMag = input.brake * vCfg.brakeTorque * torqueShare * mat.friction * 0.26;
            this.lastBrakeForce += holdMag * 1000;
            Matter.Body.applyForce(this.chassis, this.chassis.position, {
              x: tangentDir.x * holdMag,
              y: tangentDir.y * holdMag,
            });
          } else {
            const topSpeedLimiter = b(1 - Math.abs(this.forwardSpeed) / 17.5, 0.08, 1.0);
            const tractiveMag = torque * torqueShare * mat.friction * 0.185 * topSpeedLimiter;
            this.lastEngineForce += Math.abs(tractiveMag) * 1000;

            // Pure surface-tangent propulsion (NO downward suction on convex crests so car launches naturally into the air!)
            Matter.Body.applyForce(this.chassis, this.chassis.position, {
              x: tangentDir.x * tractiveMag,
              y: tangentDir.y * tractiveMag,
            });
          }
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

    // Extra gravitational slope drag on steep climbs (> 28 deg) so insufficient momentum stalls & rolls backward (Sections 3 & 14)
    if (!this.airborne && uphillSteepness > 0.48 && Math.cos(theta) > 0.25) {
      const tangentX = Math.cos(groundSlope);
      const tangentY = Math.sin(groundSlope);
      const extraSlopeGravity = (uphillSteepness - 0.44) * 0.0042 * this.chassis.mass * (1.15 - momentumClimbFactor * 0.45);
      if (extraSlopeGravity > 0) {
        Matter.Body.applyForce(this.chassis, this.chassis.position, {
          x: -tangentX * extraSlopeGravity,
          y: -tangentY * extraSlopeGravity,
        });
      }
      this.climbingStalled = fwdSpd < 0.4 && uphillSteepness > 0.52;
    } else {
      this.climbingStalled = false;
    }

    // Natural Ballistic Crest Launch Impulse (Sections 6 & 7):
    // When cresting a convex peak (groundCurv > 0.0020) at speed, release ground stickiness so vehicle becomes genuinely airborne!
    if (!this.airborne && groundCurv > 0.0020 && Math.abs(fwdSpd) > 5.2) {
      const launchPop = b((groundCurv - 0.0018) * 180, 0.1, 1.0) * b((Math.abs(fwdSpd) - 4.5) / 8.0, 0.15, 1.2);
      Matter.Body.applyForce(this.chassis, this.chassis.position, {
        x: 0,
        y: -0.0038 * this.chassis.mass * launchPop,
      });
      if (groundCurv > 0.0032 && Math.abs(fwdSpd) > 7.2) {
        this.wheels.forEach((w) => {
          w.contact = false;
          w.contactGrace = 0;
        });
      }
    }

    // -------------------------------------------------------------------------
    // PHYSICAL CENTER-OF-MASS PITCH, WHEELIE & ROLLOVER DYNAMICS (Sections 10 & 11)
    // -------------------------------------------------------------------------
    const relPitch = normalizeAngle(theta - groundSlope);
    const comHeightFactor = (vCfg.centerOfMassOffsetY ?? 6.0) / 6.0;

    if (!this.airborne) {
      // ON GROUND: Physical weight transfer & rollover risk!
      // 1. Throttle Wheelie Torque: Stronger on steep climbs where rear load is heavy; can flip backward if you don't feather throttle or brake!
      if (input.throttle > 0.1 && Math.cos(theta) > 0.1) {
        const slopeWheelieBoost = 1.0 + uphillSteepness * 2.1;
        this.chassis.torque += -0.00165 * this.chassis.mass * comHeightFactor * slopeWheelieBoost * input.throttle;
      }
      // 2. Braking Nose-Dive / Stoppie Torque: Strong forward pitch when braking on descents or before crests!
      if (input.brake > 0.1 && Math.cos(theta) > 0.1) {
        const downhillSteepness = Math.max(0, groundSlope);
        const brakeDiveBoost = 1.0 + downhillSteepness * 1.9;
        this.chassis.torque += 0.00185 * this.chassis.mass * comHeightFactor * brakeDiveBoost * input.brake;
      }

      // 3. Suspension pitch restoring spring ONLY within normal suspension travel (+-28 deg / 0.49 rad).
      //    Beyond +-34 deg (0.60 rad), Center of Mass passes the tire pivot and gravity pulls the vehicle into a real physical rollover!
      if (Math.cos(theta) > 0.15) {
        if (Math.abs(relPitch) < 0.52) {
          this.chassis.torque += -relPitch * 0.011 * this.chassis.mass;
          this.chassis.torque += -this.chassis.angularVelocity * 0.024 * this.chassis.mass;
        } else {
          // Past the CoM balance point: gravity tips the vehicle over unless the player counter-steers with brake/throttle!
          const tipDir = Math.sign(relPitch);
          this.chassis.torque += tipDir * 0.0018 * this.chassis.mass * comHeightFactor;
        }
      }
    } else {
      // IN MID-AIR (Section 8: Skill-Based Air Control on all jumps!):
      const canRotateInAir = this.groundClearance > 10 || this.airborneTimer >= 55;
      if (canRotateInAir && throttleBrake !== 0) {
        // D (Throttle > 0) -> Counter-clockwise (dir = -1 -> pitch nose UP / BACKFLIP)
        // A (Brake > 0)    -> Clockwise         (dir = +1 -> pitch nose DOWN / FRONTFLIP / LEVEL FOR DOWNHILL)
        const dir = -Math.sign(throttleBrake);
        const angVel = this.chassis.angularVelocity;
        const maxFlipRate = 0.122;
        const spinLimit = b(1 - Math.abs(angVel) / maxFlipRate, 0, 1);
        const opposing = Math.sign(dir) !== Math.sign(angVel) ? 1.35 : spinLimit;
        const airTorque = dir * Math.abs(throttleBrake) * vCfg.airControl * opposing * this.chassis.mass * 36.0;
        this.chassis.torque += airTorque;
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

    // Angular velocity damping & realistic rollover cap
    const damping = this.airborne ? vCfg.angularDamping * 0.55 : vCfg.angularDamping * 1.8;
    const factor = 1 - Math.min(damping * (dt / 16.666), 0.38);
    const maxAllowedAngVel = this.airborne ? 0.130 : 0.085;
    const clampedAngVel = b(this.chassis.angularVelocity * factor, -maxAllowedAngVel, maxAllowedAngVel);
    d.default.Body.setAngularVelocity(this.chassis, clampedAngVel);

    // Expedition Fuel / Energy Reserve & Engine Thermal Telemetry
    const fuelDtSec = Math.min(0.033, Math.max(0.001, dt / 1000));
    const climbLoad = Math.max(0, -Math.sin(groundSlope));
    const throttleAbs = Math.abs(throttleBrake);
    if (throttleAbs > 0.05) {
      this.fuel = Math.max(0.08, this.fuel - (0.0022 + climbLoad * 0.0035) * throttleAbs * fuelDtSec);
    } else if (this.forwardSpeed > 2.0 && Math.sin(groundSlope) > 0.05) {
      // Regenerative downhill kinetic recovery
      this.fuel = Math.min(1.0, this.fuel + 0.004 * fuelDtSec);
    }
    const targetTemp = b(0.24 + this.rpm * 0.52 + climbLoad * throttleAbs * 0.32, 0.20, 0.98);
    this.engineTemp += (targetTemp - this.engineTemp) * Math.min(1, fuelDtSec * 1.8);

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
            w.contactGrace = 45;
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

    // Spline proximity & grace hysteresis (reduced on convex crests so vehicle launches cleanly into the air!)
    const vCfg = this.archetype;
    const upright = Math.cos(this.chassis.angle) > 0.15;
    const curv = (terrain && terrain.curvatureAt) ? terrain.curvatureAt(this.chassis.position.x) : 0;
    const onSharpCrest = curv > 0.0022 && Math.abs(this.forwardSpeed) > 5.0;

    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      if (pairHit[i]) continue;

      let nearSpline = false;
      if (terrain && upright && !onSharpCrest && w.body.velocity.y >= -1.8) {
        const ty = terrain.heightAt(w.body.position.x);
        const tireBottom = w.body.position.y + vCfg.wheelRadius;
        if (Math.abs(ty - tireBottom) <= 4.0) {
          nearSpline = true;
          w.material = terrain.materialAt(w.body.position.x)?.name ?? "grass";
        }
      }

      if (nearSpline) {
        w.contact = true;
        w.contactGrace = 35;
      } else {
        w.contactGrace = onSharpCrest ? 0 : Math.max(0, (w.contactGrace ?? 0) - dt);
        if (w.contactGrace > 0 && terrain) {
          const ty = terrain.heightAt(w.body.position.x);
          const tireBottom = w.body.position.y + vCfg.wheelRadius;
          w.contact = (ty - tireBottom) < 7.5;
        } else {
          w.contact = false;
        }
      }
    }
  }
}

// ----------------------------------------------------------------------------
// Stunt Director & Combo System (Sections 7, 8, 9, 21)
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
  lastLandingQuality = "NONE";

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
    this.lastLandingQuality = "NONE";
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
      if (this.groundedTime >= 110 || (this.airtime === 0 && this.cumulativeAngle === 0)) {
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
        const score = this.backflips * 500;
        this.awardStunt(name, score, 2);
        vehicle.driver.triggerVictory();
      } else if (this.cumulativeAngle >= Math.PI * 2 * (this.frontflips + 1) - 0.4) {
        // Positive cumulative angle = clockwise = FRONTFLIP
        this.frontflips++;
        const name = this.frontflips === 1 ? "FRONTFLIP" : this.frontflips === 2 ? "DOUBLE FRONTFLIP" : `TRIPLE FRONTFLIP`;
        const score = this.frontflips * 500;
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
    if (rear.contact && !front.contact && speed > 2.2) {
      if (this.wheelieTime === 0) this.wheelieStartX = vehicle.chassis.position.x;
      this.wheelieTime += dtSec;
      this.wheelieDistance = Math.abs(vehicle.chassis.position.x - (this.wheelieStartX || vehicle.chassis.position.x)) / 40;

      if (this.wheelieTime >= 1.0 && Math.floor((this.wheelieTime - dtSec) / 1.0) < Math.floor(this.wheelieTime / 1.0)) {
        const pts = Math.round(100 + this.wheelieDistance * 10);
        this.awardStunt(`WHEELIE ${Math.round(this.wheelieDistance)}m`, pts, 1);
      }
    } else {
      this.wheelieTime = 0;
      this.wheelieDistance = 0;
    }

    // Stoppie / Nose Manual: Front wheel in contact, rear wheel lifted
    if (front.contact && !rear.contact && speed > 1.8) {
      if (this.stoppieTime === 0) this.stoppieStartX = vehicle.chassis.position.x;
      this.stoppieTime += dtSec;
      this.stoppieDistance = Math.abs(vehicle.chassis.position.x - (this.stoppieStartX || vehicle.chassis.position.x)) / 40;

      if (this.stoppieTime >= 0.8 && Math.floor((this.stoppieTime - dtSec) / 0.8) < Math.floor(this.stoppieTime / 0.8)) {
        this.awardStunt(`NOSE BALANCE`, 150, 2);
      }
    } else {
      this.stoppieTime = 0;
      this.stoppieDistance = 0;
    }
  }

  // Consequential Landing Physics (Section 9: PERFECT, FRONT, REAR, SIDE, HARD LANDING)
  onLanding(vehicle, terrain) {
    if (this.airtime < 220) {
      this.airtime = 0;
      return;
    }

    const chassis = vehicle.chassis;
    const slope = terrain.slopeAt(chassis.position.x);
    const relAngle = normalizeAngle(chassis.angle - slope);
    const angleDiff = Math.abs(relAngle);
    const vy = Math.abs(chassis.velocity.y);
    const heightMeters = Math.max(0, (this.launchY - this.airApexY) / 40);
    const airSec = this.airtime / 1000;

    // 1. Airtime & Distance Rewards (Section 21)
    if (this.airDistance >= 14) {
      const jumpScore = Math.round(this.airDistance * 15);
      this.awardStunt(`LONG JUMP ${this.airDistance.toFixed(0)}m`, jumpScore, 2);
    } else if (heightMeters >= 2.6 || this.airtime >= 650) {
      const airPts = Math.round(airSec * 100);
      this.awardStunt(`${airSec.toFixed(1)}s AIRTIME`, Math.max(100, airPts), 1);
    }

    // 2. Evaluate Physical Landing Alignment & Apply Real Mechanical Consequences (Section 9)
    if (angleDiff < 0.24 && !vehicle.roofContact) {
      // PERFECT LANDING: Both wheels contact smoothly aligned with terrain slope -> speed retention + bonus!
      this.lastLandingQuality = "PERFECT";
      Matter.Body.setVelocity(chassis, {
        x: chassis.velocity.x * 1.06,
        y: chassis.velocity.y * 0.85,
      });
      if (this.airtime >= 500 || this.backflips > 0 || this.frontflips > 0) {
        this.awardStunt("PERFECT LANDING", 300, 3);
        this.camera.pulseZoom(0.035);
        vehicle.driver.triggerVictory();
      }
    } else if (angleDiff > 0.82 || vehicle.roofContact) {
      // SIDE / INVERTED LANDING: High crash & rollover probability!
      this.lastLandingQuality = "SIDE_CRASH";
      Matter.Body.setVelocity(chassis, {
        x: chassis.velocity.x * 0.58,
        y: -Math.min(4.5, vy * 0.32),
      });
      Matter.Body.setAngularVelocity(chassis, chassis.angularVelocity + Math.sign(relAngle) * 0.048);
      this.showToast("BAD LANDING — ROLLOVER RISK!", 1);
    } else if (relAngle > 0.26) {
      // FRONT LANDING (Nose-First): Front suspension compresses, vehicle nose-dives & risks rolling forward!
      this.lastLandingQuality = "FRONT_HEAVY";
      if (vehicle.wheels[1]) vehicle.wheels[1].compression = 0.92;
      Matter.Body.setVelocity(chassis, {
        x: chassis.velocity.x * 0.78,
        y: chassis.velocity.y * 0.7,
      });
      Matter.Body.setAngularVelocity(chassis, chassis.angularVelocity + 0.032);
      if (this.airtime >= 600) this.showToast("NOSE-HEAVY LANDING!", 1);
    } else if (relAngle < -0.26) {
      // REAR LANDING (Tail-First): Rear suspension compresses, vehicle bucks into a wheelie / flips backward!
      this.lastLandingQuality = "REAR_HEAVY";
      if (vehicle.wheels[0]) vehicle.wheels[0].compression = 0.92;
      Matter.Body.setVelocity(chassis, {
        x: chassis.velocity.x * 0.82,
        y: chassis.velocity.y * 0.75,
      });
      Matter.Body.setAngularVelocity(chassis, chassis.angularVelocity - 0.032);
      if (this.airtime >= 600) this.showToast("TAIL-HEAVY WHEELIE!", 1);
    } else if (vy > 9.0) {
      // HARD LANDING: Suspension bottoms out, speed drops
      this.lastLandingQuality = "HARD";
      Matter.Body.setVelocity(chassis, {
        x: chassis.velocity.x * 0.74,
        y: chassis.velocity.y * 0.5,
      });
      this.showToast("HARD SLAM!", 1);
    }

    vehicle.lastLandingQuality = this.lastLandingQuality;
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
