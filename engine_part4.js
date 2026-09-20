
// ----------------------------------------------------------------------------
// Articulated Procedural Driver
// ----------------------------------------------------------------------------
class Driver {
  lean = 0;
  targetLean = 0;
  leanVel = 0;
  jolt = 0;
  joltVel = 0;
  helmetAngle = 0;
  victory = 0;
  tuck = 0;

  update(vehicle, input, dt) {
    const dtSec = dt / 1000;
    const accel = vehicle.forwardSpeed - (vehicle.lastForwardSpeed ?? vehicle.forwardSpeed);
    vehicle.lastForwardSpeed = vehicle.forwardSpeed;

    const throttleLean = -input.throttle * 0.24;
    const brakeLean = input.brake * 0.28;
    const accelLean = -b(accel * 0.38, -0.32, 0.32);
    const slopeLean = -b(vehicle.chassis.angle * 0.25, -0.25, 0.25);
    const airLean = vehicle.airborne ? -0.12 : 0;

    // Rollover protection tuck reaction
    const isInverted = Math.abs(Math.sin(vehicle.chassis.angle)) > 0.82;
    if (isInverted) {
      this.tuck = G0(this.tuck, 1.0, 14, dt);
    } else {
      this.tuck = G0(this.tuck, 0.0, 8, dt);
    }

    this.targetLean = (throttleLean + brakeLean + accelLean + slopeLean + airLean) * (1 - this.tuck * 0.5);

    const springK = 20.0;
    const damping = 0.70;
    const force = (this.targetLean - this.lean) * springK;
    this.leanVel = (this.leanVel + force * dtSec) * Math.pow(damping, dtSec * 60);
    this.lean += this.leanVel * dtSec;
    this.lean = b(this.lean, -0.45, 0.45);

    const joltForce = -this.jolt * 28.0;
    this.joltVel = (this.joltVel + joltForce * dtSec) * Math.pow(0.62, dtSec * 60);
    this.jolt += this.joltVel * dtSec;

    const targetHelmet = this.lean * 0.72 + vehicle.chassis.angularVelocity * 0.35 + (this.tuck * 0.4);
    this.helmetAngle = G0(this.helmetAngle, targetHelmet, 14, dt);

    this.victory = Math.max(0, this.victory - dtSec * 0.45);
  }

  applyShock(energy) {
    this.jolt += b(energy * 3.8, 0.9, 5.0);
    this.lean += (Math.random() - 0.5) * 0.30;
  }

  triggerVictory() {
    this.victory = 1.2;
  }
}

// ----------------------------------------------------------------------------
// Expedition Vehicle (f0)
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
    const posY = yPos ?? this.chassis?.position.y ?? x.world.groundBase - 58;

    this.chassis = d.default.Bodies.rectangle(
      posX,
      posY,
      vCfg.chassisWidth,
      vCfg.chassisHeight,
      {
        label: "chassis",
        collisionFilter: { group: -3 },
        density: vCfg.chassisMass / (vCfg.chassisWidth * vCfg.chassisHeight),
        friction: 0.4,
        frictionAir: 0.004,
        restitution: 0.04,
        chamfer: { radius: 8 },
      }
    );

    const wheelOffsets = [
      { x: -vCfg.wheelBase / 2, y: vCfg.wheelOffsetY }, // Rear wheel
      { x: vCfg.wheelBase / 2, y: vCfg.wheelOffsetY },  // Front wheel
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
          frictionStatic: vCfg.tireGrip * 1.35,
          frictionAir: 0.0035,
          restitution: 0.10,
          slop: 0.02,
        }
      );

      const armSpread = 18;
      const restLen = Math.hypot(armSpread, vCfg.wheelOffsetY - 2);
      const makeLink = (spreadX) =>
        d.default.Constraint.create({
          bodyA: this.chassis,
          pointA: { x: off.x + spreadX, y: 2 },
          bodyB: wheel,
          length: restLen,
          stiffness: vCfg.suspensionStiffness,
          damping: vCfg.suspensionDamping,
        });

      const linkA = makeLink(armSpread);
      const linkB = makeLink(-armSpread);
      this.constraints.push(linkA, linkB);

      this.wheels.push({
        body: wheel,
        restOffset: off,
        compression: 0,
        lastCompression: 0,
        contact: true, // start grounded
        slip: 0,
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

  update(input, dt) {
    const vCfg = this.archetype;
    const throttleBrake = input.throttle - input.brake;
    const dtSec = Math.max(0.001, dt / 1000);

    if (this.airborne) {
      this.airborneTimer += dt;
    } else {
      this.airborneTimer = 0;
    }

    // Dynamic Normal Load Distribution (Spec #03):
    // N_front = [mg(b cos theta - h sin theta) - m h a_x] / L
    // N_rear  = [mg(a cos theta + h sin theta) + m h a_x] / L
    const theta = this.chassis.angle;
    const ax = (this.forwardSpeed - (this.lastForwardSpeed ?? this.forwardSpeed)) / dtSec;
    const m = this.chassis.mass;
    const g = 9.81 * 8.0;
    const W = m * g;
    const L = vCfg.wheelBase;
    const b_dist = L / 2;
    const a_dist = L / 2;
    const h = vCfg.centerOfMassOffsetY ?? 12.0;

    const nFront = Math.max(0.1, (W * (b_dist * Math.cos(theta) - h * Math.sin(theta)) - m * h * ax) / L);
    const nRear = Math.max(0.1, (W * (a_dist * Math.cos(theta) + h * Math.sin(theta)) + m * h * ax) / L);
    this.normalLoads = { front: nFront, rear: nRear };

    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      const isRear = i === 0;
      const torqueShare = isRear ? 0.70 : 0.30;
      const normalLoad = isRear ? nRear : nFront;
      const spin = w.body.angularVelocity;
      const speedRatio = b(1 - Math.abs(spin) / vCfg.maxWheelSpeed, 0, 1);

      // Wheel Slip Ratio & Saturating Traction Curve S(kappa)
      const R = vCfg.wheelRadius;
      const rw = spin * R;
      const vx = this.forwardSpeed;
      const denom = Math.max(Math.abs(rw), Math.abs(vx), 0.1);
      w.slipRatio = b((rw - vx) / denom, -1.5, 1.5);

      let sKappa = 0;
      const absK = Math.abs(w.slipRatio);
      if (absK < 0.18) {
        sKappa = (absK / 0.18) * Math.sign(w.slipRatio);
      } else {
        sKappa = (1.0 - 0.22 * Math.min(1.0, (absK - 0.18) / 0.82)) * Math.sign(w.slipRatio);
      }

      if (throttleBrake !== 0) {
        const isDriving = Math.sign(throttleBrake) === Math.sign(spin) || Math.abs(spin) < 0.03;
        const torque = isDriving
          ? vCfg.engineTorque * speedRatio * throttleBrake
          : vCfg.brakeTorque * throttleBrake;

        w.body.torque += torque * torqueShare * w.body.mass * 13;

        // Longitudinal traction force evaluated with saturating friction
        if (w.contact) {
          const mat = MATERIALS[w.material] ?? MATERIALS.dirt;
          const forwardDir = {
            x: Math.cos(this.chassis.angle),
            y: Math.sin(this.chassis.angle),
          };
          const tractiveMag = torque * torqueShare * mat.friction * (0.12 + 0.04 * Math.abs(sKappa));
          Matter.Body.applyForce(w.body, w.body.position, {
            x: forwardDir.x * tractiveMag,
            y: forwardDir.y * tractiveMag,
          });
        }
      } else {
        d.default.Body.setAngularVelocity(w.body, spin * 0.994);
      }

      // Suspension travel & Hooke spring-damper compression: F_s = -k*x - c*v
      const mountWorld = d.default.Vector.add(
        this.chassis.position,
        d.default.Vector.rotate(
          { x: w.restOffset.x, y: 2 },
          this.chassis.angle
        )
      );
      const curDist = d.default.Vector.magnitude(
        d.default.Vector.sub(w.body.position, mountWorld)
      );
      w.compression = b(
        (vCfg.wheelOffsetY - curDist) / vCfg.suspensionTravel,
        -1,
        1
      );

      // Detect rapid suspension compression and play metallic spring creak
      const deltaComp = w.compression - w.lastCompression;
      if (deltaComp > 0.26 && w.compression > 0.35 && this.audio) {
        this.audio.creak(deltaComp);
      }
      w.lastCompression = w.compression;

      w.slip = Math.abs(spin * vCfg.wheelRadius - this.forwardSpeed);
    }

    // Subtle Grounded Anti-Jitter Assist (Spec #02, #03):
    // Apply stabilization torque tau_assist = -k_theta * theta - c_omega * omega
    // ONLY when both wheels maintain firm ground contact, preventing numerical jitter
    // while leaving airborne physics completely free!
    if (this.wheels[0].contact && this.wheels[1].contact) {
      const wR = this.wheels[0].body.position;
      const wF = this.wheels[1].body.position;
      const groundAngle = Math.atan2(wF.y - wR.y, wF.x - wR.x);
      const angleDiff = normalizeAngle(this.chassis.angle - groundAngle);
      const kTheta = 0.0035 * this.chassis.mass;
      const cOmega = 0.0020 * this.chassis.mass;
      const assistTorque = -kTheta * angleDiff - cOmega * this.chassis.angularVelocity;
      this.chassis.torque += assistTorque;
    }

    // Mid-air pitch rotation authority:
    // Only activates when airborne for > 150ms to prevent accidental spin during spawn drops or tiny hops!
    // Throttle pitches nose UP (counter-clockwise -> BACKFLIP)
    // Brake pitches nose DOWN (clockwise -> FRONTFLIP)
    if (this.airborne && this.airborneTimer > 150 && throttleBrake !== 0) {
      const angVel = this.chassis.angularVelocity;
      const dir = -Math.sign(throttleBrake); // throttle = -1 (CCW/Backflip), brake = +1 (CW/Frontflip)
      const spinLimit = b(1 - Math.abs(angVel) / 5.2, 0, 1);
      const opposing = Math.sign(dir) !== Math.sign(angVel) ? 1.0 : spinLimit;
      const airTorque = dir * Math.abs(throttleBrake) * vCfg.airControl * opposing * this.chassis.mass * 36;
      this.chassis.torque += airTorque;
    }

    const damping = this.airborne ? vCfg.angularDamping : vCfg.angularDamping * 5.0;
    const factor = 1 - Math.min(damping * (dt / 16.666), 0.5);
    d.default.Body.setAngularVelocity(this.chassis, this.chassis.angularVelocity * factor);

    this.driver.update(this, input, dt);
  }

  markContacts(terrainSet, activePairs) {
    for (const w of this.wheels) w.contact = false;
    this.roofContact = false;

    for (const pair of activePairs) {
      const { bodyA, bodyB } = pair;
      const w = this.wheels.find((wheel) => wheel.body === bodyA || wheel.body === bodyB);
      if (w) {
        const other = bodyA === w.body ? bodyB : bodyA;
        if (terrainSet.has(other)) {
          w.contact = true;
          w.material = other.materialKind ?? "grass";
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
      if (this.airtime === 0) {
        this.launchX = chassis.position.x;
        this.launchY = chassis.position.y;
        this.prevAngle = chassis.angle;
        this.airApexY = chassis.position.y;
        this.cumulativeAngle = 0;
        this.backflips = 0;
        this.frontflips = 0;
      }

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
      this.checkGroundStunts(vehicle, terrain, dt);
    }
  }

  checkGroundStunts(vehicle, terrain, dt) {
    const rear = vehicle.wheels[0];
    const front = vehicle.wheels[1];
    const slope = terrain.slopeAt(vehicle.chassis.position.x);
    const relAngle = vehicle.chassis.angle - slope;

    // Wheelie: rear wheel contacts, front wheel elevated, nose pitched up (relAngle < -0.22)
    if (rear.contact && !front.contact && relAngle < -0.22 && vehicle.forwardSpeed > 3.0) {
      this.wheelieTime += dt;
      this.wheelieDistance += (vehicle.forwardSpeed * dt) / 1000;
      if (this.wheelieTime > 400) {
        const step = Math.floor((this.wheelieTime - 400) / 350);
        const prevStep = Math.floor((this.wheelieTime - dt - 400) / 350);
        if (step > prevStep) {
          const score = 80 + step * 40;
          this.awardStunt(`WHEELIE (${(this.wheelieDistance / 2).toFixed(0)}m)`, score, 1);
        }
      }
    } else {
      this.wheelieTime = 0;
      this.wheelieDistance = 0;
    }

    // Stoppie: front wheel contacts, rear elevated, nose pitched down (relAngle > 0.22)
    if (front.contact && !rear.contact && relAngle > 0.22 && vehicle.forwardSpeed > 2.5) {
      this.stoppieTime += dt;
      this.stoppieDistance += (vehicle.forwardSpeed * dt) / 1000;
      if (this.stoppieTime > 400) {
        const step = Math.floor((this.wheelieTime - 400) / 350);
        const prevStep = Math.floor((this.wheelieTime - dt - 400) / 350);
        if (step > prevStep) {
          const score = 100 + step * 50;
          this.awardStunt(`STOPPIE (${(this.stoppieDistance / 2).toFixed(0)}m)`, score, 1);
        }
      }
    } else {
      this.stoppieTime = 0;
      this.stoppieDistance = 0;
    }
  }

  onLanding(vehicle, terrain) {
    if (this.airtime < 220) {
      this.airtime = 0;
      return;
    }

    const chassis = vehicle.chassis;
    const slope = terrain.slopeAt(chassis.position.x);
    const angleDiff = Math.abs(normalizeAngle(chassis.angle - slope));
    const vertSpeed = Math.abs(chassis.velocity.y);
    const apexHeight = this.launchY - this.airApexY;

    if (this.airtime > 720 || apexHeight > 65) {
      this.awardStunt("BIG AIR", 180, 1);
    }
    if (this.airDistance > 26) {
      this.awardStunt("LONG JUMP", 200, 1);
    }

    // Landing quality evaluation
    if (angleDiff < 0.19 && vertSpeed < 14) {
      this.comboMultiplier = Math.min(this.comboMultiplier + 1, 8);
      this.awardStunt("PERFECT LANDING", 160 * this.comboMultiplier, 3);
      this.camera.pulseZoom(0.04);
      vehicle.driver.triggerVictory();
      // Forward momentum boost for rewarding skillful landing
      const forwardDir = { x: Math.cos(chassis.angle), y: Math.sin(chassis.angle) };
      Matter.Body.applyForce(chassis, chassis.position, {
        x: forwardDir.x * 0.08 * chassis.mass,
        y: forwardDir.y * 0.08 * chassis.mass,
      });
    } else if (angleDiff < 0.40) {
      this.awardStunt("CLEAN LANDING", 60, 1);
      this.camera.pulseZoom(0.015);
    } else if (angleDiff >= 0.72 || vertSpeed > 22) {
      this.breakCombo();
      this.camera.shake(0.30, 240);
      Matter.Body.setVelocity(chassis, {
        x: chassis.velocity.x * 0.82,
        y: chassis.velocity.y * 0.82,
      });
    }

    this.airtime = 0;
  }

  awardStunt(name, score, tier = 1) {
    this.comboScore += score;
    this.comboTimer = 4.0;
    this.activeStuntName = name;
    this.audio?.stuntChime(tier);

    this.bus.emit("stunt:awarded", {
      name: name,
      score: score,
      multiplier: this.comboMultiplier,
      tier: tier,
      totalComboScore: this.comboScore,
    });
  }

  showToast(name, tier = 1) {
    this.bus.emit("stunt:awarded", {
      name: name,
      score: 0,
      multiplier: 1,
      tier: tier,
      totalComboScore: this.comboScore,
    });
  }

  endCombo() {
    if (this.comboScore > 0) {
      const finalScore = this.comboScore * this.comboMultiplier;
      this.bus.emit("stunt:combo_complete", {
        score: finalScore,
        multiplier: this.comboMultiplier,
      });
    }
    this.comboMultiplier = 1;
    this.comboScore = 0;
    this.comboTimer = 0;
    this.activeStuntName = "";
  }

  breakCombo() {
    this.comboMultiplier = 1;
    this.comboScore = 0;
    this.comboTimer = 0;
    this.activeStuntName = "";
    this.bus.emit("stunt:combo_broken", {});
  }
}
