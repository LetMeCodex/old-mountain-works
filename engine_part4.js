
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
// Expedition Vehicle (f0) - Vehicle Physics Rebirth: Force-Driven Spring-Damper Core
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
  centerOfMassOffset = { x: 0, y: -3.5 };
  bottomOutCooldown = 0;
  lastLandingQuality = "GROUND";
  landingPrediction = "LEVEL";

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
        friction: 0.10,
        frictionAir: 0.0016,
        restitution: 0.06,
        chamfer: { radius: [6, 6, 12, 12] },
      }
    );

    // Section 05: Responsive polar moment of inertia (~1.0x instead of over-heavy 2.4x)
    const defInertia = (vCfg.chassisMass * (vCfg.chassisWidth * vCfg.chassisWidth + vCfg.chassisHeight * vCfg.chassisHeight)) / 12;
    const inertiaMult = vCfg.inertiaMultiplier ?? 1.05;
    Matter.Body.setInertia(this.chassis, defInertia * inertiaMult);

    // Section 06: Realistic Center of Mass offset (stable climbing, natural wheelies/stoppies/rollover)
    const comY = vCfg.centerOfMassOffsetY ?? 3.5;
    this.centerOfMassOffset = { x: 0, y: -comY };
    Matter.Body.setCentre(this.chassis, { x: 0, y: comY }, true);

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
          frictionStatic: vCfg.tireGrip * 1.25,
          frictionAir: 0.0012,
          restitution: 0.02,
          slop: 0.01,
        }
      );

      // Symmetric Wishbone + Primary Coilover Strut (Matter.js native spring-damper authority)
      const springStrut = d.default.Constraint.create({
        bodyA: this.chassis,
        pointA: { x: off.x, y: 0 },
        bodyB: wheel,
        length: vCfg.wheelOffsetY,
        stiffness: vCfg.suspensionStiffness,
        damping: vCfg.suspensionDamping,
      });

      const guideSpread = 28;
      const guideLen = Math.hypot(guideSpread, vCfg.wheelOffsetY);
      const guideLeft = d.default.Constraint.create({
        bodyA: this.chassis,
        pointA: { x: off.x - guideSpread, y: 0 },
        bodyB: wheel,
        length: guideLen,
        stiffness: vCfg.suspensionStiffness * 0.72,
        damping: vCfg.suspensionDamping * 0.75,
      });
      const guideRight = d.default.Constraint.create({
        bodyA: this.chassis,
        pointA: { x: off.x + guideSpread, y: 0 },
        bodyB: wheel,
        length: guideLen,
        stiffness: vCfg.suspensionStiffness * 0.72,
        damping: vCfg.suspensionDamping * 0.75,
      });

      this.constraints.push(springStrut, guideLeft, guideRight);

      this.wheels.push({
        body: wheel,
        restOffset: off,
        compression: 0,
        compressionVelocity: 0,
        lastCompression: 0,
        contact: true,
        contactGrace: 30,
        slip: 0,
        slipRatio: 0,
        rpm: 0,
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

  get wheelRpm() {
    const maxSpin = Math.max(...this.wheels.map((w) => Math.abs(w.body.angularVelocity)));
    return Math.round((maxSpin * 60 * 60) / (Math.PI * 2));
  }

  get airborne() {
    return !this.wheels.some((w) => w.contact);
  }

  // --------------------------------------------------------------------------
  // TELESCOPIC STRUT AXIS & BUMP-STOP SOLVER (Sections 03, 09, 10, 11, 12, 13)
  // Keeps wheel aligned on the axle's longitudinal strut axis (localX = targetX)
  // while leaving vertical suspension travel (localY & axialVel) 100% free
  // inside the generous [minAxialY, maxAxialY] window so Matter.js springs
  // compress, rebound, and unload naturally over crests without any terrain glue!
  // --------------------------------------------------------------------------
  solvePrismaticSuspension(terrain = null, dt = 8.333) {
    const vCfg = this.archetype;
    let cPos = this.chassis.position;
    let cVel = this.chassis.velocity;
    const theta = this.chassis.angle;
    const omega = this.chassis.angularVelocity;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    if (this.bottomOutCooldown > 0) {
      this.bottomOutCooldown = Math.max(0, this.bottomOutCooldown - dt);
    }

    // Catastrophic anti-tunneling guard ONLY if chassis center penetrates deep below terrain surface
    if (terrain && Number.isFinite(cPos.x) && Number.isFinite(cPos.y)) {
      const cGroundY = terrain.heightAt(cPos.x);
      if (cPos.y > cGroundY + 18) {
        Matter.Body.setPosition(this.chassis, { x: cPos.x, y: cGroundY - 10 });
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

    const travel = vCfg.suspensionTravel; // 35 - 42 px generous suspension travel
    const minAxialY = Math.max(12, vCfg.wheelOffsetY - travel * 0.82);
    const maxAxialY = vCfg.wheelOffsetY + travel * 0.58;

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

      // Mount velocity in world space: v_mount = v_c + omega x r_mount
      const mountVx = cVel.x - omega * (targetX * sin + clampedY * cos);
      const mountVy = cVel.y + omega * (targetX * cos - clampedY * sin);
      const relVx = wVel.x - mountVx;
      const relVy = wVel.y - mountVy;
      let axialVel = relVx * nHat.x + relVy * nHat.y;
      const compressionVel = -axialVel;

      // Active spring-damper assist force F = -k*x - c*v within safe Matter.js force scale
      const compressionPx = vCfg.wheelOffsetY - clampedY;
      w.compression = b(compressionPx / travel, -1.0, 1.25);
      w.compressionVelocity = compressionVel;

      // Rebound unloading boost: when compressed spring extends over a crest, push chassis up naturally (Section 12)
      const springPush = (compressionPx * vCfg.suspensionStiffness * 0.00018 - axialVel * vCfg.suspensionDamping * 0.00045) * this.chassis.mass;
      if (Math.abs(springPush) > 0.00001 && Number.isFinite(springPush)) {
        const mountWorld = {
          x: cPos.x + targetX * tHat.x,
          y: cPos.y + targetX * tHat.y,
        };
        Matter.Body.applyForce(this.chassis, mountWorld, {
          x: -nHat.x * springPush,
          y: -nHat.y * springPush,
        });
      }

      // Only correct longitudinal axle drift (errX) or hard bump/droop stop limits (errY)
      if (Math.abs(errX) > 0.35 || Math.abs(errY) > 0.15) {
        const newWorldX = cPos.x + targetX * tHat.x + clampedY * nHat.x;
        const newWorldY = cPos.y + targetX * tHat.y + clampedY * nHat.y;

        // Section 11: Bottom-out rebound & impact feedback instead of dead clamping
        if (localY <= minAxialY && axialVel < 0) {
          if (compressionVel > 3.5 && this.bottomOutCooldown <= 0) {
            this.bottomOutCooldown = 180;
            if (this.audio) this.audio.impact(0.55, "metal", true);
          }
          axialVel = -axialVel * 0.32; // Physical rubber bump-stop rebound!
        }
        if (localY >= maxAxialY && axialVel > 0) {
          axialVel = 0;
        }

        const lateralVel = (relVx * tHat.x + relVy * tHat.y) * 0.12;
        const nextVx = mountVx + tHat.x * lateralVel + nHat.x * axialVel;
        const nextVy = mountVy + tHat.y * lateralVel + nHat.y * axialVel;

        Matter.Body.setPosition(w.body, { x: newWorldX, y: newWorldY });
        Matter.Body.setVelocity(w.body, { x: nextVx, y: nextVy });
      }
    }
  }

  update(input, dt, terrain = null) {
    const vCfg = this.archetype;
    const throttleBrake = input.throttle - input.brake;
    const dtSec = Math.max(0.001, dt / 1000);

    // 1. Update telescopic strut axis & genuine spring-damper forces
    this.solvePrismaticSuspension(terrain, dt);

    if (this.airborne) {
      if (this.airborneTimer === 0) {
        this.airRotation = 0;
        this.lastAirAngle = this.chassis.angle;
      } else {
        const dAng = normalizeAngle(this.chassis.angle - (this.lastAirAngle ?? this.chassis.angle));
        this.airRotation += dAng;
        this.lastAirAngle = this.chassis.angle;
      }
      this.airborneTimer += dt;
    } else {
      this.airborneTimer = 0;
      this.airRotation = 0;
      this.lastAirAngle = this.chassis.angle;
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

    // Dynamic Normal Load Distribution & Center of Mass (Sections 06, 20, 22, 23):
    const theta = normalizeAngle(this.chassis.angle);
    const fwdSpd = this.forwardSpeed;
    const ax = b((fwdSpd - (this.lastForwardSpeed ?? fwdSpd)) / dtSec, -55, 55);
    this.lastForwardSpeed = fwdSpd;
    const m = this.chassis.mass;
    const g = 9.81 * 8.0;
    const W = m * g;
    const L = vCfg.wheelBase;
    const b_dist = L / 2;
    const a_dist = L / 2;
    const h = (vCfg.centerOfMassOffsetY ?? 3.5) + 12.0;

    const nFront = Math.max(0.10, (W * (b_dist * Math.cos(theta) - h * Math.sin(theta)) - m * h * ax * 0.38) / L);
    const nRear = Math.max(0.10, (W * (a_dist * Math.cos(theta) + h * Math.sin(theta)) + m * h * ax * 0.38) / L);
    this.normalLoads = { front: nFront, rear: nRear };

    // Local terrain slope & curvature under chassis
    const groundSlope = terrain ? terrain.slopeAt(this.chassis.position.x) : 0;
    const groundCurv = (terrain && terrain.curvatureAt) ? terrain.curvatureAt(this.chassis.position.x) : 0;

    this.lastEngineForce = 0;
    this.lastBrakeForce = 0;

    // -------------------------------------------------------------------------
    // MOMENTUM vs. STEEP CLIMB TUNING ZONES (Sections 18 & 19):
    // 15° (0.26 rad): climbs comfortably
    // 25° (0.44 rad): momentum starts mattering (faster entry = much faster climb)
    // 30° (0.52 rad): driver must manage speed
    // 35° (0.61 rad): serious challenge (low gear crawl at low speed, fast with momentum)
    // 38°–42°+ (0.665+ rad): extreme climb — starting without momentum (< 2.3 m/s) stalls & rolls backward!
    // -------------------------------------------------------------------------
    const uphillSteepness = Math.max(0, -groundSlope);
    let momentumClimbFactor = 1.0;
    if (uphillSteepness > 0.665) {
      // Extreme 38°–42°+ wall: requires entry momentum (> 2.3 m/s) or tires break loose & roll backward
      const speedCarry = b((fwdSpd - 2.3) / 3.2, 0.0, 1.45);
      const steepnessZone = b((uphillSteepness - 0.665) / 0.16, 0, 1.0);
      momentumClimbFactor = b(0.08 + speedCarry * 1.18 - steepnessZone * 0.16, 0.06, 1.38);
    } else if (uphillSteepness > 0.40) {
      // 23°–38° mountain climb: low-RPM torque always climbs (0.78x), high momentum flies up (1.38x)
      const speedCarry = b((fwdSpd - 1.0) / 8.0, 0.0, 1.0);
      const slopeLoad = b((uphillSteepness - 0.40) / 0.265, 0.0, 1.0);
      momentumClimbFactor = b(0.96 - slopeLoad * 0.18 + speedCarry * 0.54, 0.78, 1.38);
    }

    // Active Mechanical Disc Braking & Hill-Hold Assist (Sections 20 & 21):
    // Holds vehicle on steep uphill for 650ms when braking to a stop, then allows reversing down the slope
    if (input.brake > 0.05 && input.throttle < 0.1 && fwdSpd < 0.5 && uphillSteepness > 0.30) {
      this.hillHoldTimer = (this.hillHoldTimer ?? 0) + dt;
    } else {
      this.hillHoldTimer = 0;
    }
    const isBrakingForward = input.brake > 0.05 && input.throttle < 0.1 && fwdSpd > 0.65;
    const isHoldingHillBrake = input.brake > 0.05 && input.throttle < 0.1 && fwdSpd < -0.18 && uphillSteepness > 0.30 && (this.hillHoldTimer ?? 0) < 650;

    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      const isRear = i === 0;
      const torqueShare = isRear ? 0.58 : 0.42;
      const spin = w.body.angularVelocity;
      const rpmRatio = b(Math.abs(spin) / vCfg.maxWheelSpeed, 0, 1.25);
      w.rpm = Math.round((Math.abs(spin) * 60 * 60) / (Math.PI * 2));

      // Section 16: 3-Band Engine Torque Character (LOW RPM strong torque, MID RPM peak powerband, HIGH RPM taper)
      let engineBand = 1.0;
      if (rpmRatio < 0.30) {
        engineBand = 0.92 + (rpmRatio / 0.30) * 0.14;
      } else if (rpmRatio <= 0.72) {
        engineBand = 1.06 + Math.sin(((rpmRatio - 0.30) / 0.42) * Math.PI) * 0.12;
      } else {
        engineBand = Math.max(0.16, 1.06 * (1 - (rpmRatio - 0.72) / 0.52));
      }

      // Section 15: Controllable Traction & Wheelspin Model
      const R = vCfg.wheelRadius;
      const rw = spin * R;
      const vx = fwdSpd;
      const denom = Math.max(Math.abs(rw), Math.abs(vx), 0.5);
      w.slipRatio = b((rw - vx) / denom, -1.5, 1.5);
      const wheelspinPenalty = Math.abs(w.slipRatio) > 0.36
        ? 1.0 - b((Math.abs(w.slipRatio) - 0.36) * 0.28, 0, 0.24)
        : 1.0;

      if (throttleBrake !== 0) {
        const isDriving = Math.sign(throttleBrake) === Math.sign(spin) || Math.abs(spin) < 0.04;
        const torque = isDriving
          ? vCfg.engineTorque * engineBand * throttleBrake * momentumClimbFactor
          : vCfg.brakeTorque * throttleBrake;

        const targetSpinDelta = torque * torqueShare * 0.38 * (dt / 8.333);
        const nextSpin = b(spin + targetSpinDelta, -vCfg.maxWheelSpeed, vCfg.maxWheelSpeed);
        d.default.Body.setAngularVelocity(w.body, nextSpin);

        if (w.contact && Math.cos(theta) > 0.18) {
          const mat = MATERIALS[w.material] ?? MATERIALS.dirt;
          const wheelSlope = terrain ? terrain.slopeAt(w.body.position.x) : theta;
          const tangentDir = {
            x: Math.cos(wheelSlope),
            y: Math.sin(wheelSlope),
          };

          if (isBrakingForward) {
            const loadShare = isRear ? (nRear / (nFront + nRear)) * 0.75 : (nFront / (nFront + nRear)) * 1.45;
            const brakeMag = input.brake * vCfg.brakeTorque * loadShare * mat.friction * 0.38;
            this.lastBrakeForce += brakeMag * 1000;
            Matter.Body.applyForce(this.chassis, this.chassis.position, {
              x: -tangentDir.x * brakeMag,
              y: -tangentDir.y * brakeMag,
            });
          } else if (isHoldingHillBrake && fwdSpd > -4.0) {
            const holdMag = input.brake * vCfg.brakeTorque * torqueShare * mat.friction * 0.30;
            this.lastBrakeForce += holdMag * 1000;
            Matter.Body.applyForce(this.chassis, this.chassis.position, {
              x: tangentDir.x * holdMag,
              y: tangentDir.y * holdMag,
            });
          } else {
            const topSpd = vCfg.topSpeed ?? 29.0;
            const topSpeedLimiter = b(1 - Math.abs(fwdSpd) / topSpd, 0.06, 1.0);
            const tractiveMag = torque * torqueShare * mat.friction * wheelspinPenalty * 0.215 * topSpeedLimiter;
            this.lastEngineForce += Math.abs(tractiveMag) * 1000;

            Matter.Body.applyForce(this.chassis, this.chassis.position, {
              x: tangentDir.x * tractiveMag,
              y: tangentDir.y * tractiveMag,
            });
          }
        }
      } else {
        d.default.Body.setAngularVelocity(w.body, spin * 0.993);
      }

      const deltaComp = w.compression - w.lastCompression;
      if (deltaComp > 0.24 && w.compression > 0.32 && this.audio) {
        this.audio.creak(deltaComp);
      }
      w.lastCompression = w.compression;
      w.slip = Math.abs(spin * vCfg.wheelRadius - fwdSpd);
    }

    // Section 18 & 19: Steep Hill Gravity vs. Momentum (no artificial stop — let gravity & low momentum stall & roll back on 38°+ walls)
    if (!this.airborne && uphillSteepness > 0.665 && Math.cos(theta) > 0.22) {
      const tangentX = Math.cos(groundSlope);
      const tangentY = Math.sin(groundSlope);
      const extraSlopeGravity = (uphillSteepness - 0.58) * 0.0115 * this.chassis.mass * (1.25 - momentumClimbFactor * 0.65);
      if (extraSlopeGravity > 0) {
        Matter.Body.applyForce(this.chassis, this.chassis.position, {
          x: -tangentX * extraSlopeGravity,
          y: -tangentY * extraSlopeGravity,
        });
      }
      this.climbingStalled = fwdSpd < 0.8 && uphillSteepness > 0.665;
    } else {
      this.climbingStalled = false;
    }

    // -------------------------------------------------------------------------
    // WHEELIE, STOPPIE & PURE PROJECTILE AIRBORNE DYNAMICS (Sections 22-28, 47-48)
    // -------------------------------------------------------------------------
    const relPitch = normalizeAngle(theta - groundSlope);
    const comHeightFactor = (vCfg.centerOfMassOffsetY ?? 3.5) / 3.5;

    if (!this.airborne) {
      // Section 22: Physical Wheelie Torque (depend on COM, torque, rear contact, and slope)
      if (input.throttle > 0.1 && this.wheels[0].contact && Math.cos(theta) > 0.15) {
        const slopeWheelie = Math.max(0, uphillSteepness - 0.10) * 1.95;
        const launchBurst = b(1.0 - Math.abs(fwdSpd) / 11.0, 0.15, 0.85);
        const wheelieLimit = b(1.0 - Math.max(0, -relPitch - 0.20) / 0.30, 0.05, 1.0);
        const wheelieTorque = -0.00092 * this.chassis.mass * comHeightFactor * (launchBurst * 0.42 + slopeWheelie) * wheelieLimit * input.throttle;
        this.chassis.torque += wheelieTorque;
      }

      // Section 23: Physical Stoppie / Nose-Dive Torque when braking hard at speed or downhill
      if (input.brake > 0.1 && this.wheels[1].contact && fwdSpd > 1.2 && Math.cos(theta) > 0.15) {
        const downhillFactor = 1.0 + Math.max(0, groundSlope) * 1.90;
        const speedFactor = b(fwdSpd / 11.0, 0.25, 1.35);
        const stoppieTorque = 0.00125 * this.chassis.mass * comHeightFactor * downhillFactor * speedFactor * input.brake;
        this.chassis.torque += stoppieTorque;
      }

      // Dual-wheel suspension pitch coupling (active ONLY when both wheels are on the ground and within balance point)
      if (this.wheels[0].contact && this.wheels[1].contact && Math.cos(theta) > 0.20 && Math.abs(relPitch) < 0.48) {
        this.chassis.torque += -relPitch * 0.0045 * this.chassis.mass;
        this.chassis.torque += -this.chassis.angularVelocity * 0.012 * this.chassis.mass;
      } else if (Math.abs(relPitch) > 0.56 && Math.cos(theta) > 0.10) {
        // Past the CoM balance point: gravity tips the vehicle into a rollover unless saved!
        this.chassis.torque += Math.sign(relPitch) * 0.0014 * this.chassis.mass * comHeightFactor;
      }

      const gndFactor = 1 - Math.min(vCfg.angularDamping * 0.65 * (dt / 16.666), 0.12);
      d.default.Body.setAngularVelocity(
        this.chassis,
        b(this.chassis.angularVelocity * gndFactor, -0.16, 0.16)
      );
      this.landingPrediction = "GROUNDED";
    } else {
      // Sections 24, 25, 26, 27, 28: PURE PROJECTILE AIRBORNE PHYSICS + RESPONSIVE AIR CONTROL
      const canRotateInAir = this.groundClearance > 6 || this.airborneTimer >= 32;
      const absAirRot = Math.abs(this.airRotation ?? 0);
      const completedFlipNearGround = absAirRot >= 5.75 && this.groundClearance < 36 && this.chassis.velocity.y > 1.2 && Math.abs(relPitch) < 0.34;

      if (completedFlipNearGround) {
        // Player completed a full 360° flip and is touching down aligned with the slope:
        // feather rotation into the landing slope so holding D for throttle doesn't over-rotate onto the roof!
        d.default.Body.setAngularVelocity(
          this.chassis,
          b(this.chassis.angularVelocity * 0.76 - relPitch * 0.08, -0.10, 0.10)
        );
      } else if (canRotateInAir && throttleBrake !== 0) {
        const dir = -Math.sign(throttleBrake);
        const angVel = this.chassis.angularVelocity;
        const maxFlipRate = 0.172;
        const spinHeadroom = b(1 - Math.abs(angVel) / maxFlipRate, 0.05, 1);
        let counterAuthority = Math.sign(dir) !== Math.sign(angVel) ? 1.45 : spinHeadroom;
        // If committed past 145° into a flip and descending toward ground, give slight tuck authority to finish the flip
        if (absAirRot > 2.5 && absAirRot < 5.75 && this.chassis.velocity.y > 0.5 && this.groundClearance < 65) {
          counterAuthority = Math.max(counterAuthority, 0.68);
        }
        const airTorque = dir * Math.abs(throttleBrake) * vCfg.airControl * counterAuthority * this.chassis.mass * 23.5;
        this.chassis.torque += airTorque;
      }

      const airFactor = 1 - Math.min(vCfg.angularDamping * 0.22 * (dt / 16.666), 0.04);
      d.default.Body.setAngularVelocity(
        this.chassis,
        b(this.chassis.angularVelocity * airFactor, -0.22, 0.22)
      );

      // Real-Time Landing Prediction Telemetry (Section 49)
      const lookX = this.chassis.position.x + this.chassis.velocity.x * 18;
      const predSlope = terrain ? terrain.slopeAt(lookX) : groundSlope;
      const predRelAngle = normalizeAngle(this.chassis.angle + this.chassis.angularVelocity * 10 - predSlope);
      const absPred = Math.abs(predRelAngle);
      if (absPred < 0.24) this.landingPrediction = "PERFECT";
      else if (absPred < 0.42) this.landingPrediction = "SOFT";
      else if (absPred > 0.95) this.landingPrediction = "CRASH_RISK";
      else if (predRelAngle > 0) this.landingPrediction = "FRONT_HEAVY";
      else this.landingPrediction = "REAR_HEAVY";
    }

    // Section 39: Physical Self-Righting Roll Recovery (rock the vehicle using throttle/brake when inverted near ground)
    const distToGround = terrain ? (terrain.heightAt(this.chassis.position.x) - this.chassis.position.y) : 999;
    const isInvertedOnGround = (this.roofContact || distToGround < 52) && (Math.abs(theta) > 1.42 || this.roofContact);
    if (isInvertedOnGround && throttleBrake !== 0) {
      const rollDir = Math.sign(throttleBrake);
      this.chassis.torque += rollDir * this.chassis.mass * 4.8;
      d.default.Body.setAngularVelocity(
        this.chassis,
        b(this.chassis.angularVelocity + rollDir * 0.028 * (dt / 8.333), -0.18, 0.18)
      );
      Matter.Body.applyForce(this.chassis, this.chassis.position, {
        x: rollDir * 0.014 * this.chassis.mass,
        y: -0.024 * this.chassis.mass,
      });
    }

    // Expedition Fuel / Energy Reserve & Engine Thermal Telemetry
    const fuelDtSec = Math.min(0.033, Math.max(0.001, dt / 1000));
    const climbLoad = Math.max(0, -Math.sin(groundSlope));
    const throttleAbs = Math.abs(throttleBrake);
    if (throttleAbs > 0.05) {
      this.fuel = Math.max(0.08, this.fuel - (0.0022 + climbLoad * 0.0035) * throttleAbs * fuelDtSec);
    } else if (fwdSpd > 2.0 && Math.sin(groundSlope) > 0.05) {
      this.fuel = Math.min(1.0, this.fuel + 0.004 * fuelDtSec);
    }
    const targetTemp = b(0.24 + this.rpm * 0.52 + climbLoad * throttleAbs * 0.32, 0.20, 0.98);
    this.engineTemp += (targetTemp - this.engineTemp) * Math.min(1, fuelDtSec * 1.8);

    this.driver.update(this, input, dt);
  }

  // --------------------------------------------------------------------------
  // PHYSICAL CONTACT vs. GAMEPLAY AIRBORNE STATE (Section 14)
  // --------------------------------------------------------------------------
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
            w.contactGrace = 18;
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

    // Clean unloading over crests: if wheel is separating from terrain or cresting a peak, release contact immediately!
    const vCfg = this.archetype;
    const upright = Math.cos(this.chassis.angle) > 0.15;
    const curv = (terrain && terrain.curvatureAt) ? terrain.curvatureAt(this.chassis.position.x) : 0;
    const unloadingAtCrest = curv > 0.0015 && Math.abs(this.forwardSpeed) > 3.8;

    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      if (pairHit[i]) {
        if (unloadingAtCrest && w.compression < -0.15 && this.chassis.velocity.y < -1.0) {
          w.contact = false;
          w.contactGrace = 0;
        }
        continue;
      }

      let nearRollingSeam = false;
      if (terrain && upright && !unloadingAtCrest && w.body.velocity.y >= -0.8) {
        const ty = terrain.heightAt(w.body.position.x);
        const tireBottom = w.body.position.y + vCfg.wheelRadius;
        // Tight 2.2px seam bridge ONLY for flat/concave polygon seams when not moving upward
        if (Math.abs(ty - tireBottom) <= 2.2) {
          nearRollingSeam = true;
          w.material = terrain.materialAt(w.body.position.x)?.name ?? "grass";
        }
      }

      if (nearRollingSeam) {
        w.contact = true;
        w.contactGrace = 14;
      } else {
        w.contactGrace = unloadingAtCrest ? 0 : Math.max(0, (w.contactGrace ?? 0) - dt);
        if (w.contactGrace > 0 && terrain && w.body.velocity.y >= -1.0) {
          const ty = terrain.heightAt(w.body.position.x);
          const tireBottom = w.body.position.y + vCfg.wheelRadius;
          w.contact = (ty - tireBottom) < 3.2;
        } else {
          w.contact = false;
        }
      }
    }
  }
}

// ----------------------------------------------------------------------------
// Stunt Director & Combo System (Sections 33-37: Expanded Stunts & True Physical Landings)
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
  launchSpeed = 0;
  launchCurvature = 0;
  cumulativeAngle = 0;
  prevAngle = 0;
  backflips = 0;
  frontflips = 0;
  maxNoseDownAngle = 0;
  minTailDownAngle = 0;
  airDirectionChanges = 0;
  lastAirSpinSign = 0;
  wheelieTime = 0;
  wheelieDistance = 0;
  maxWheeliePitch = 0;
  stoppieTime = 0;
  stoppieDistance = 0;
  comboMultiplier = 1;
  comboScore = 0;
  comboTimer = 0;
  jumpStuntCount = 0;
  activeStuntName = "";
  lastLandingQuality = "NONE";

  constructor(bus, audio, camera) {
    this.bus = bus;
    this.audio = audio;
    this.camera = camera;
  }

  get flipProgress() {
    return (Math.abs(this.cumulativeAngle) % (Math.PI * 2)) / (Math.PI * 2);
  }

  reset() {
    this.airtime = 0;
    this.groundedTime = 200;
    this.airDistance = 0;
    this.airApexY = Infinity;
    this.launchX = 0;
    this.launchY = 0;
    this.launchSpeed = 0;
    this.launchCurvature = 0;
    this.cumulativeAngle = 0;
    this.prevAngle = 0;
    this.backflips = 0;
    this.frontflips = 0;
    this.maxNoseDownAngle = 0;
    this.minTailDownAngle = 0;
    this.airDirectionChanges = 0;
    this.lastAirSpinSign = 0;
    this.wheelieTime = 0;
    this.wheelieDistance = 0;
    this.maxWheeliePitch = 0;
    this.stoppieTime = 0;
    this.stoppieDistance = 0;
    this.comboMultiplier = 1;
    this.comboScore = 0;
    this.comboTimer = 0;
    this.jumpStuntCount = 0;
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
      if (this.groundedTime >= 90 || (this.airtime === 0 && this.cumulativeAngle === 0)) {
        this.launchX = chassis.position.x;
        this.launchY = chassis.position.y;
        this.launchSpeed = Math.abs(vehicle.forwardSpeed);
        this.launchCurvature = (terrain && terrain.curvatureAt) ? terrain.curvatureAt(chassis.position.x) : 0;
        this.prevAngle = chassis.angle;
        this.airApexY = chassis.position.y;
        this.cumulativeAngle = 0;
        this.backflips = 0;
        this.frontflips = 0;
        this.maxNoseDownAngle = 0;
        this.minTailDownAngle = 0;
        this.airDirectionChanges = 0;
        this.lastAirSpinSign = 0;
        this.jumpStuntCount = 0;
      }
      this.groundedTime = 0;

      this.airtime += dt;
      this.airDistance = Math.abs(chassis.position.x - this.launchX) / 40;
      this.airApexY = Math.min(this.airApexY, chassis.position.y);

      const slope = terrain ? terrain.slopeAt(chassis.position.x) : 0;
      const relPitch = normalizeAngle(chassis.angle - slope);
      if (relPitch > this.maxNoseDownAngle) this.maxNoseDownAngle = relPitch;
      if (relPitch < this.minTailDownAngle) this.minTailDownAngle = relPitch;

      const spinSign = Math.abs(chassis.angularVelocity) > 0.018 ? Math.sign(chassis.angularVelocity) : 0;
      if (spinSign !== 0 && this.lastAirSpinSign !== 0 && spinSign !== this.lastAirSpinSign) {
        this.airDirectionChanges++;
      }
      if (spinSign !== 0) this.lastAirSpinSign = spinSign;

      let deltaAngle = chassis.angle - this.prevAngle;
      while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
      while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
      this.cumulativeAngle += deltaAngle;
      this.prevAngle = chassis.angle;

      // Negative cumulative angle = counter-clockwise = BACKFLIP
      if (this.cumulativeAngle <= -(Math.PI * 2 * (this.backflips + 1) - 0.38)) {
        this.backflips++;
        this.jumpStuntCount++;
        const name = this.backflips === 1 ? "BACKFLIP" : this.backflips === 2 ? "DOUBLE BACKFLIP" : "TRIPLE BACKFLIP";
        const score = this.backflips * 500;
        this.awardStunt(name, score, 2);
        vehicle.driver.triggerVictory();
      } else if (this.cumulativeAngle >= Math.PI * 2 * (this.frontflips + 1) - 0.38) {
        // Positive cumulative angle = clockwise = FRONTFLIP
        this.frontflips++;
        this.jumpStuntCount++;
        const name = this.frontflips === 1 ? "FRONTFLIP" : this.frontflips === 2 ? "DOUBLE FRONTFLIP" : "TRIPLE FRONTFLIP";
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
    const slope = terrain ? terrain.slopeAt(vehicle.chassis.position.x) : 0;
    const relPitch = normalizeAngle(vehicle.chassis.angle - slope);

    // Wheelie: Rear wheel in contact, front wheel lifted
    if (rear.contact && !front.contact && speed > 2.0) {
      if (this.wheelieTime === 0) {
        this.wheelieStartX = vehicle.chassis.position.x;
        this.maxWheeliePitch = 0;
      }
      this.wheelieTime += dtSec;
      this.wheelieDistance = Math.abs(vehicle.chassis.position.x - (this.wheelieStartX || vehicle.chassis.position.x)) / 40;
      if (relPitch < this.maxWheeliePitch) this.maxWheeliePitch = relPitch;

      if (this.wheelieTime >= 0.85 && Math.floor((this.wheelieTime - dtSec) / 0.85) < Math.floor(this.wheelieTime / 0.85)) {
        const pts = Math.round(100 + this.wheelieDistance * 12);
        this.awardStunt(`WHEELIE ${Math.max(1, Math.round(this.wheelieDistance))}m`, pts, 1);
      }
    } else {
      // Check REAR SAVE if player saved an extreme backward wheelie (> 32 deg) back onto both wheels!
      if (this.maxWheeliePitch < -0.56 && rear.contact && front.contact && !vehicle.roofContact) {
        this.awardStunt("REAR SAVE", 250, 2);
      }
      this.wheelieTime = 0;
      this.wheelieDistance = 0;
      this.maxWheeliePitch = 0;
    }

    // Stoppie / Nose Manual: Front wheel in contact, rear wheel lifted
    if (front.contact && !rear.contact && speed > 1.8) {
      if (this.stoppieTime === 0) this.stoppieStartX = vehicle.chassis.position.x;
      this.stoppieTime += dtSec;
      this.stoppieDistance = Math.abs(vehicle.chassis.position.x - (this.stoppieStartX || vehicle.chassis.position.x)) / 40;

      if (this.stoppieTime >= 0.65 && Math.floor((this.stoppieTime - dtSec) / 0.65) < Math.floor(this.stoppieTime / 0.65)) {
        this.awardStunt("STOPPIE", 160, 2);
      }
    } else {
      this.stoppieTime = 0;
      this.stoppieDistance = 0;
    }
  }

  // --------------------------------------------------------------------------
  // LANDING EVALUATION & STUNT RECOGNITION (Sections 33, 34, 35, 36, 37)
  // Does NOT fake landings with velocity overwrites; lets Matter.js suspension react!
  // --------------------------------------------------------------------------
  onLanding(vehicle, terrain) {
    if (this.airtime < 160) {
      this.airtime = 0;
      return;
    }

    const chassis = vehicle.chassis;
    const slope = terrain.slopeAt(chassis.position.x);
    const relAngle = normalizeAngle(chassis.angle - slope);
    const angleDiff = Math.abs(relAngle);
    const vy = Math.abs(chassis.velocity.y);
    const heightMeters = Math.max(0, (this.launchY - this.airApexY) / 40);
    const dropMeters = Math.max(0, (chassis.position.y - this.launchY) / 40);
    const airSec = this.airtime / 1000;
    const totalFlips = this.backflips + this.frontflips;

    // 1. Evaluate New & Classic Airborne Stunts (Sections 35 & 36)
    if (dropMeters >= 7.5) {
      this.jumpStuntCount++;
      this.awardStunt(`CLIFF LAUNCH ${dropMeters.toFixed(0)}m`, Math.round(dropMeters * 30), 2);
    }
    if (this.airtime >= 1450 && this.airDistance >= 20) {
      this.jumpStuntCount++;
      this.awardStunt(`LONG FLIGHT ${this.airDistance.toFixed(0)}m`, Math.round(this.airDistance * 22), 2);
    } else if (this.airDistance >= 13) {
      this.jumpStuntCount++;
      this.awardStunt(`LONG JUMP ${this.airDistance.toFixed(0)}m`, Math.round(this.airDistance * 15), 2);
    } else if (heightMeters >= 2.4 || this.airtime >= 600) {
      this.jumpStuntCount++;
      this.awardStunt(`${airSec.toFixed(1)}s AIRTIME`, Math.max(100, Math.round(airSec * 110)), 1);
    }

    if (this.airDirectionChanges >= 1 && this.airtime >= 800 && angleDiff < 0.35) {
      this.jumpStuntCount++;
      this.awardStunt("AIR ROLL", 280, 2);
    }

    // 2. Classify Physical Landing State (Section 33: PERFECT, SOFT, FRONT_HEAVY, REAR_HEAVY, SIDE_CRASH, HARD)
    if (angleDiff < 0.24 && !vehicle.roofContact) {
      this.lastLandingQuality = "PERFECT";
      // Subtle roll-out efficiency reward without overwriting natural vertical suspension bounce (Section 34)
      Matter.Body.setVelocity(chassis, {
        x: chassis.velocity.x * 1.03,
        y: chassis.velocity.y,
      });

      if (totalFlips >= 2) {
        this.awardStunt("DOUBLE FLIP", 750, 3);
      } else if (totalFlips === 1) {
        this.awardStunt("CLEAN FLIP", 450, 3);
      }

      if (this.maxNoseDownAngle > 0.62 && totalFlips === 0) {
        this.awardStunt("NOSE DIVE RECOVERY", 320, 2);
      } else if (this.minTailDownAngle < -0.62 && totalFlips === 0) {
        this.awardStunt("REAR SAVE", 320, 2);
      }

      if (this.launchSpeed >= 13.5 && this.launchCurvature > 0.0018 && this.airtime >= 350) {
        this.awardStunt("PERFECT CREST", 350, 2);
      } else if (this.airtime >= 450 || totalFlips > 0) {
        this.awardStunt("PERFECT LANDING", 300, 3);
      }

      if (this.jumpStuntCount >= 2 && (totalFlips >= 1 || this.airtime >= 900)) {
        this.awardStunt(`MOUNTAIN COMBO x${this.comboMultiplier}`, 400, 3);
      }

      if (this.airtime >= 450 || totalFlips > 0) {
        this.camera.pulseZoom(0.03);
        vehicle.driver.triggerVictory();
      }
    } else if (angleDiff > 0.82 || vehicle.roofContact) {
      // SIDE / INVERTED LANDING: High rollover risk, let Matter.js bounce & tumble play out!
      this.lastLandingQuality = "SIDE_CRASH";
      this.showToast("BAD LANDING — ROLLOVER RISK!", 1);
    } else if (relAngle > 0.26) {
      // FRONT HEAVY (Nose-First): Front suspension compresses, natural forward rotation
      this.lastLandingQuality = "FRONT_HEAVY";
      if (vehicle.wheels[1]) vehicle.wheels[1].compression = Math.max(vehicle.wheels[1].compression, 0.88);
      if (this.airtime >= 550) this.showToast("FRONT-HEAVY LANDING!", 1);
    } else if (relAngle < -0.26) {
      // REAR HEAVY (Tail-First): Rear suspension compresses, natural wheelie/bounce
      this.lastLandingQuality = "REAR_HEAVY";
      if (vehicle.wheels[0]) vehicle.wheels[0].compression = Math.max(vehicle.wheels[0].compression, 0.88);
      if (this.airtime >= 550) this.showToast("REAR-HEAVY LANDING!", 1);
    } else if (vy > 9.0) {
      // HARD LANDING: Major suspension compression
      this.lastLandingQuality = "HARD";
      this.showToast("HARD LANDING!", 1);
    } else {
      // SOFT LANDING: Minor mismatch, continue normally
      this.lastLandingQuality = "SOFT";
      if (this.maxNoseDownAngle > 0.65 && totalFlips === 0) {
        this.awardStunt("NOSE DIVE RECOVERY", 260, 2);
      } else if (this.minTailDownAngle < -0.65 && totalFlips === 0) {
        this.awardStunt("REAR SAVE", 260, 2);
      }
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
