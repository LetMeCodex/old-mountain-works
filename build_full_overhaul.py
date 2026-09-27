# Full Master Engine + Master HUD 2.0 (Living Expedition Instrument System) Builder for Old Mountain Works
import os

with open('old-mountain-works.original.html', 'r', encoding='utf-8') as f:
    orig = f.read()

script_start = orig.find('<script>') + len('<script>')
matter_end = orig.find('var u=L0(z0(),1);') + len('var u=L0(z0(),1);')
matter_bundle = orig[script_start:matter_end]

html_head = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 40'%3E%3Cpolygon points='4,36 22,8 28,36' fill='%23efe7d6'/%3E%3Cpolygon points='20,36 40,3 60,36' fill='%23d4622a'/%3E%3C/svg%3E" />
<title>The Old Mountain Works — Master Physics Driving Expedition</title>
<style>
  :root {
    --ink: #1b1f1d;
    --paper: #efe7d6;
    --paper-card: rgba(239, 231, 214, 0.95);
    --hot: #d4622a;
    --hot-glow: rgba(212, 98, 42, 0.25);
    --accent: #2ea3a5;

    /* Master HUD 2.0 — Physical Material & Instrument Tokens */
    --hud-ink: #111513;
    --hud-anodized: #141917;
    --hud-charcoal: #1b211e;
    --hud-paper: #efe7d6;
    --hud-enamel: rgba(239, 231, 214, 0.86);
    --hud-muted: rgba(239, 231, 214, 0.50);
    --hud-muted-strong: rgba(239, 231, 214, 0.76);
    --hud-orange: #d4622a;
    --hud-brass: #c8a464;
    --hud-line: rgba(239, 231, 214, 0.16);
    --hud-warning: #e25822;

    /* Global Motion System Curves (Section 18 & 19) */
    --ease-out-quart: cubic-bezier(0.23, 1, 0.32, 1);
    --ease-in-out-quart: cubic-bezier(0.77, 0, 0.175, 1);
    --ease-mechanical: cubic-bezier(0.19, 1, 0.22, 1);
    --ease-tactile-press: cubic-bezier(0.12, 0.8, 0.32, 1);
    --ease-archival: cubic-bezier(0.16, 1, 0.3, 1);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    height: 100%;
    background: var(--paper);
    overflow: hidden;
    font-family: Georgia, 'Times New Roman', serif;
    color: var(--ink);
    user-select: none;
    -webkit-user-select: none;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100dvh;
    touch-action: none;
    transition: filter 0.45s var(--ease-out-quart);
  }
  body.hud-crashed canvas {
    filter: saturate(0.42) contrast(1.06);
  }
  .mono {
    font-family: 'Courier New', Courier, monospace;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  /* ==========================================================================
     MASTER HUD 2.0 — LIVING EXPEDITION INSTRUMENT SYSTEM
     ========================================================================== */
  #hud {
    position: fixed;
    inset: 0;
    pointer-events: none;
    display: none;
    z-index: 5;
    color: var(--hud-paper);
    font-family: 'Courier New', Courier, monospace;
    font-variant-numeric: tabular-nums;
    text-shadow: 0 1px 3px rgba(10, 14, 12, 0.42);
    perspective: 900px;
  }

  /* Dedicated Three.js 3D Instrument Bevel & Gimbal Canvas */
  #hud-three-canvas {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 6;
    display: none;
  }

  /* State-Driven Atmospheric Quieting (Airborne / Echo Discovery) */
  #hud.hud-state-airborne .hud-telemetry-grid,
  #hud.hud-state-airborne #hud-top-center {
    opacity: 0.68;
    transition: opacity 0.25s var(--ease-out-quart);
  }
  #hud.hud-state-echo .hud-telemetry-grid,
  #hud.hud-state-echo #hud-top-right {
    opacity: 0.56;
    transition: opacity 0.28s var(--ease-out-quart);
  }
  .hud-telemetry-grid,
  #hud-top-center,
  #hud-top-right {
    transition: opacity 0.25s var(--ease-out-quart);
  }

  /* Subtle top & bottom atmospheric instrument vignette */
  #hud::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(180deg, rgba(22, 27, 25, 0.46) 0%, rgba(22, 27, 25, 0.14) 18%, rgba(22, 27, 25, 0) 36%, rgba(12, 15, 14, 0) 64%, rgba(12, 15, 14, 0.82) 84%, rgba(10, 13, 12, 0.96) 100%);
    z-index: -1;
  }

  /* Bottom subterranean topographic contour SVG overlay */
  #hud-subterranean-contours {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 220px;
    width: 100%;
    pointer-events: none;
    opacity: 0.42;
    z-index: 0;
  }

  /* --------------------------------------------------------------------------
     A. TOP LEFT — EXPEDITION IDENTITY, GEOLOGICAL ALTIMETER & INCLINOMETER
     -------------------------------------------------------------------------- */
  #hud-top-left {
    position: absolute;
    top: 22px;
    left: 22px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    z-index: 2;
    transform-style: preserve-3d;
  }

  .hud-identity {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  #hud-emblem-svg {
    width: 44px;
    height: 28px;
    flex-shrink: 0;
    overflow: visible;
  }
  .hud-identity-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  #hud-brand-title {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 12.5px;
    font-weight: normal;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--hud-paper);
    white-space: nowrap;
  }
  #hud-brand-rule {
    width: 100%;
    height: 1px;
    background: rgba(239, 231, 214, 0.24);
    transform-origin: left center;
  }
  .hud-brand-sub {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 8.5px;
    letter-spacing: 0.26em;
    text-transform: uppercase;
    color: var(--hud-muted);
  }
  #hud-sector-label {
    color: var(--hud-muted-strong);
  }
  #hud-lottie-relic {
    width: 14px;
    height: 14px;
    display: inline-block;
    vertical-align: middle;
    opacity: 0;
  }

  /* Section 6: Vertical Geological Surveying Altimeter + Editorial Telemetry */
  .hud-telemetry-wrap {
    position: relative;
    padding-left: 22px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .hud-left-ruler {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 14px;
    overflow: hidden;
  }
  #hud-altimeter-svg {
    position: absolute;
    left: 0;
    top: 0;
    width: 14px;
    height: 100%;
    overflow: hidden;
  }
  #hud-left-indicator {
    position: absolute;
    left: 0;
    bottom: 12%;
    width: 2.5px;
    height: 26%;
    background: var(--hud-orange);
    transition: bottom 0.16s var(--ease-out-quart), height 0.16s var(--ease-out-quart);
  }

  .hud-telemetry-grid {
    display: grid;
    grid-template-columns: 64px auto;
    row-gap: 6px;
    column-gap: 14px;
    font-size: 9.5px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    line-height: 1.25;
    align-items: center;
  }
  .hud-tel-label {
    color: var(--hud-muted);
    font-weight: 400;
  }
  .hud-tel-label.bright {
    color: var(--hud-paper);
    font-weight: 600;
  }
  .hud-tel-val {
    color: var(--hud-muted-strong);
    font-weight: 600;
    letter-spacing: 0.18em;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: transform 0.11s var(--ease-mechanical), filter 0.11s var(--ease-mechanical);
  }
  .hud-tel-val.bright {
    color: var(--hud-paper);
  }
  /* Mechanical Odometer Roll Micro-Step (Sections 16 & 17) */
  .hud-tel-val.odo-step {
    transform: translateY(-1.5px);
  }

  /* Section 7: Miniature Mechanical Spirit-Level / Inclinometer */
  .hud-incline-row {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  #hud-inclinometer-svg {
    width: 46px;
    height: 13px;
    overflow: visible;
    vertical-align: middle;
  }

  /* Section 10: Archival Notebook Echo Discovery Annotation */
  #hud-echo-annotation {
    margin-top: 6px;
    display: none;
    flex-direction: column;
    gap: 4px;
    padding: 7px 10px;
    background: rgba(17, 21, 19, 0.78);
    border-left: 2px solid var(--hud-orange);
    border-top: 1px solid rgba(239, 231, 214, 0.16);
    border-bottom: 1px solid rgba(239, 231, 214, 0.16);
    max-width: 240px;
  }
  .echo-anno-header {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 8px;
    letter-spacing: 0.28em;
    color: var(--hud-orange);
  }
  .echo-anno-line {
    width: 100%;
    height: 1px;
    background: rgba(239, 231, 214, 0.22);
    transform-origin: left center;
  }
  #hud-echo-anno-name {
    font-family: Georgia, serif;
    font-size: 10px;
    letter-spacing: 0.12em;
    color: var(--hud-paper);
    text-transform: uppercase;
  }

  /* Hidden legacy RPM bar kept in DOM for automated test compatibility */
  #hud .rpm {
    width: 96px;
    height: 2px;
    background: rgba(239, 231, 214, 0.12);
    margin-top: 2px;
    overflow: hidden;
    opacity: 0.45;
  }
  #hud .rpm i {
    display: block;
    height: 100%;
    width: 0%;
    background: var(--hud-orange);
  }

  #hud-air {
    font-size: 9px;
    letter-spacing: 0.24em;
    color: var(--hud-orange);
    min-height: 12px;
    margin-top: 2px;
  }
  #hud-combo {
    font-size: 9px;
    letter-spacing: 0.22em;
    color: var(--hud-brass);
    display: none;
  }
  #hud-warning {
    display: none;
    color: var(--hud-orange);
    font-weight: 600;
    font-size: 9.5px;
    letter-spacing: 0.2em;
    background: rgba(17, 21, 19, 0.88);
    padding: 5px 10px;
    border-left: 2.5px solid var(--hud-orange);
    border-top: 1px solid rgba(212, 98, 42, 0.35);
    border-right: 1px solid rgba(212, 98, 42, 0.35);
    border-bottom: 1px solid rgba(212, 98, 42, 0.35);
    margin-top: 4px;
  }

  /* --------------------------------------------------------------------------
     B. TOP CENTER — SURVEYED EXPEDITION ROUTE & LIVING TERRAIN SCANNER
     -------------------------------------------------------------------------- */
  #hud-top-center {
    position: absolute;
    top: 18px;
    left: 50%;
    transform: translateX(-50%);
    width: min(440px, 37vw);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    z-index: 2;
  }
  .hud-route-header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--hud-muted);
  }
  #hud-route-sector-tag {
    color: var(--hud-muted-strong);
  }
  #hud-route-svg {
    width: 100%;
    height: 26px;
    overflow: visible;
  }
  .hud-scanner-wrap {
    width: 84%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  #hud-scanner-svg {
    width: 100%;
    height: 26px;
    overflow: visible;
    opacity: 0.85;
  }
  .hud-scanner-footer {
    width: 100%;
    display: flex;
    justify-content: space-between;
    font-size: 6.5px;
    letter-spacing: 0.24em;
    color: rgba(239, 231, 214, 0.42);
    text-transform: uppercase;
  }
  #hud-scanner-callout {
    color: var(--hud-muted-strong);
    transition: color 0.2s var(--ease-out-quart);
  }

  /* --------------------------------------------------------------------------
     C. TOP RIGHT — ENVIRONMENT TELEMETRY & 3D GIMBAL COMPASS ROSE
     -------------------------------------------------------------------------- */
  #hud-top-right {
    position: absolute;
    top: 18px;
    right: 22px;
    display: flex;
    align-items: center;
    gap: 18px;
    z-index: 2;
    perspective: 600px;
  }
  .hud-env-cluster {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .hud-env-item {
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .hud-env-icon {
    width: 22px;
    height: 22px;
    stroke: var(--hud-muted-strong);
    fill: none;
    stroke-width: 1.25;
  }
  .hud-env-data {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .hud-env-primary {
    font-size: 10px;
    letter-spacing: 0.2em;
    color: var(--hud-paper);
    font-weight: 600;
  }
  .hud-env-secondary {
    font-size: 7.5px;
    letter-spacing: 0.24em;
    color: var(--hud-muted);
    text-transform: uppercase;
  }
  .hud-env-divider {
    width: 1px;
    height: 26px;
    background: rgba(239, 231, 214, 0.18);
  }

  /* 3D Gimbal Compass Rose */
  .hud-compass-wrap {
    width: 60px;
    height: 60px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    transform-style: preserve-3d;
  }
  #hud-compass-svg {
    width: 60px;
    height: 60px;
    overflow: visible;
    filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.45));
  }
  #hud-compass-card {
    transform-origin: 32px 32px;
    transition: transform 0.12s linear;
  }

  /* --------------------------------------------------------------------------
     D. RIGHT EDGE — RADIAL STUNT GYRO, SUSPENDED AIRTIME & VERTICAL BAR
     -------------------------------------------------------------------------- */
  #hud-right-column {
    position: absolute;
    right: 18px;
    top: 61%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 2;
  }
  .hud-right-instrument {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding-top: 24px;
  }
  /* Section 12: Suspended Airborne Timer */
  #hud-airtime-chrono {
    font-family: 'Courier New', Courier, monospace;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.14em;
    color: var(--hud-paper);
    opacity: 0;
    transform: translateY(4px) scale(0.95);
    transition: opacity 0.18s var(--ease-out-quart), transform 0.18s var(--ease-out-quart);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  #hud-airtime-chrono.active {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  /* Section 11: Radial Stunt Angular Momentum Gyro */
  #hud-stunt-gyro-svg {
    width: 38px;
    height: 38px;
    overflow: visible;
    opacity: 0.22;
    transition: opacity 0.22s var(--ease-out-quart), transform 0.22s var(--ease-out-quart);
  }
  #hud-stunt-gyro-svg.active {
    opacity: 0.96;
  }
  .hud-right-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    font-size: 8.5px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: var(--hud-muted);
    text-align: left;
  }
  .hud-right-text .lead {
    color: var(--hud-paper);
    font-weight: 600;
  }
  .hud-right-text .accent-orange {
    color: var(--hud-orange);
    font-weight: 600;
  }
  .hud-right-dash {
    width: 14px;
    height: 1px;
    background: rgba(239, 231, 214, 0.35);
    margin-top: 4px;
    align-self: flex-start;
  }
  .hud-vertical-bar {
    width: 5px;
    height: 168px;
    background: rgba(239, 231, 214, 0.08);
    border: 0.5px solid rgba(239, 231, 214, 0.12);
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    overflow: hidden;
  }
  #hud-stunt-bar-top {
    width: 100%;
    height: 26%;
    background: var(--hud-orange);
    transition: height 0.14s var(--ease-out-quart);
  }
  #hud-stunt-bar-mid {
    width: 100%;
    height: 34%;
    background: rgba(239, 231, 214, 0.18);
  }

  /* --------------------------------------------------------------------------
     E. BOTTOM RIGHT — 4WD TECHNICAL DRIVETRAIN & AXLE TORQUE VISUALIZER
     -------------------------------------------------------------------------- */
  #hud-vehicle-status {
    position: absolute;
    right: 24px;
    bottom: 22px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    z-index: 2;
    transform-style: preserve-3d;
  }
  #hud-4wd-emblem {
    width: 30px;
    height: 16px;
    overflow: visible;
  }
  #hud-drivetrain-mode {
    font-size: 8.5px;
    letter-spacing: 0.28em;
    color: var(--hud-paper);
    text-transform: uppercase;
    font-weight: 600;
  }
  #hud-drivetrain-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--hud-orange);
  }
  #hud-wheel-matrix {
    width: 42px;
    height: 22px;
    opacity: 0.84;
    overflow: visible;
  }

  /* --------------------------------------------------------------------------
     F. BOTTOM CENTER — MULTI-LAYER 3D / MECHANICAL ANALOG INSTRUMENT CLUSTER
     -------------------------------------------------------------------------- */
  #hud-gauges-cluster {
    position: absolute;
    bottom: 14px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: flex-end;
    gap: 28px;
    z-index: 2;
    perspective: 800px;
    transform-style: preserve-3d;
  }
  .hud-sub-dial {
    width: 106px;
    height: 80px;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    transform-style: preserve-3d;
    filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.55));
  }
  .hud-sub-dial svg {
    width: 106px;
    height: 80px;
    overflow: visible;
  }
  .hud-hero-dial {
    width: 174px;
    height: 164px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    transform-style: preserve-3d;
    filter: drop-shadow(0 8px 20px rgba(0, 0, 0, 0.65));
  }
  .hud-hero-dial svg {
    width: 174px;
    height: 174px;
    overflow: visible;
  }
  .hud-speed-center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-top: 22px;
    pointer-events: none;
  }
  #hud-speed-big {
    font-family: 'Courier New', Courier, monospace;
    font-size: 46px;
    font-weight: 200;
    line-height: 0.92;
    letter-spacing: -0.04em;
    transform: scaleX(0.82);
    color: var(--hud-paper);
  }
  .hud-speed-unit {
    margin-top: 7px;
    font-size: 7.5px;
    letter-spacing: 0.28em;
    color: var(--hud-muted);
    text-transform: uppercase;
  }
  .hud-speed-rule {
    margin-top: 10px;
    width: 24px;
    height: 1px;
    background: rgba(239, 231, 214, 0.30);
  }

  /* --------------------------------------------------------------------------
     G. BOTTOM LEFT — TACTILE MECHANICAL PEDAL CONTROLS (BRAKE | ACCELERATE)
     -------------------------------------------------------------------------- */
  #pedals {
    position: fixed;
    bottom: 24px;
    left: 38px;
    display: none;
    align-items: center;
    gap: 24px;
    pointer-events: none;
    z-index: 8;
  }
  .pedal-unit {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    pointer-events: auto;
  }
  .pedal-divider {
    width: 1px;
    height: 44px;
    background: rgba(239, 231, 214, 0.14);
    margin-bottom: 18px;
  }
  #pedals button {
    pointer-events: auto;
    width: 58px;
    height: 58px;
    border-radius: 50%;
    border: 1px solid rgba(239, 231, 214, 0.28);
    background: radial-gradient(circle at 50% 35%, rgba(28, 34, 31, 0.72), rgba(12, 15, 14, 0.88));
    box-shadow:
      inset 0 1px 0 rgba(239, 231, 214, 0.16),
      0 4px 12px rgba(0, 0, 0, 0.55);
    color: var(--hud-paper);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    touch-action: none;
    padding: 0;
    outline: none;
    position: relative;
    transition:
      transform 0.11s var(--ease-tactile-press),
      border-color 0.14s var(--ease-out-quart),
      background-color 0.14s var(--ease-out-quart),
      box-shadow 0.14s var(--ease-out-quart);
  }
  #pedals button::after {
    content: "";
    position: absolute;
    inset: 4px;
    border-radius: 50%;
    border: 1px solid rgba(239, 231, 214, 0.14);
    pointer-events: none;
    transition: border-color 0.14s var(--ease-out-quart), transform 0.11s var(--ease-tactile-press);
  }
  #pedals button svg {
    width: 24px;
    height: 24px;
    stroke: var(--hud-paper);
    stroke-width: 1.5;
    fill: none;
    transition: stroke 0.14s var(--ease-out-quart), transform 0.11s var(--ease-tactile-press);
  }
  #pedals button.pressed {
    border-color: var(--hud-orange);
    background: radial-gradient(circle at 50% 60%, rgba(212, 98, 42, 0.22), rgba(14, 18, 16, 0.94));
    box-shadow:
      inset 0 2px 5px rgba(0, 0, 0, 0.75),
      0 1px 4px rgba(0, 0, 0, 0.45);
  }
  #pedals button.pressed::after {
    border-color: rgba(212, 98, 42, 0.62);
    transform: scale(0.96);
  }
  #pedals button.pressed svg {
    stroke: var(--hud-orange);
  }
  .pedal-label {
    font-family: 'Courier New', Courier, monospace;
    font-size: 8px;
    letter-spacing: 0.26em;
    text-transform: uppercase;
    color: var(--hud-muted-strong);
    transition: color 0.14s var(--ease-out-quart);
  }
  .pedal-unit.active .pedal-label {
    color: var(--hud-orange);
  }

  /* Subtle Archival Stunt Telemetry Log (Replaces Arcade Floating Text) */
  #hud-stunt {
    position: fixed;
    top: 86px;
    right: 24px;
    pointer-events: none;
    z-index: 6;
    display: flex;
    flex-direction: column;
    gap: 5px;
    align-items: flex-end;
  }
  .stunt-toast {
    background: rgba(16, 20, 18, 0.86);
    border: 1px solid rgba(239, 231, 214, 0.20);
    border-left: 2px solid var(--hud-orange);
    padding: 5px 12px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 9.5px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--hud-paper);
    transition: opacity 0.22s var(--ease-out-quart), transform 0.22s var(--ease-out-quart);
  }
  .stunt-toast strong {
    color: var(--hud-orange);
    font-weight: 600;
  }
  .stunt-toast.tier-3 {
    border-left-color: var(--hud-brass);
  }
  .stunt-toast.tier-3 strong {
    color: var(--hud-brass);
  }

  /* Cinematic Death Interruption Banner */
  #hud-death-banner {
    position: fixed;
    top: 38%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 9;
    display: none;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    background: rgba(17, 21, 19, 0.92);
    border: 1px solid rgba(212, 98, 42, 0.55);
    padding: 14px 28px;
    text-align: center;
  }
  #hud-death-banner .kicker {
    color: var(--hud-orange);
    font-family: 'Courier New', monospace;
    font-size: 9px;
    letter-spacing: 0.36em;
    opacity: 1;
  }
  #hud-death-banner .title {
    color: var(--hud-paper);
    font-family: Georgia, serif;
    font-size: 18px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
  }

  /* ==========================================================================
     MODALS & OVERLAYS (TITLE, PAUSE, DEATH DEBRIEF, GARAGE)
     ========================================================================== */
  .overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(17, 21, 19, 0.68);
    backdrop-filter: blur(4px);
    z-index: 10;
  }
  .card {
    width: min(600px, 92vw);
    border: 1.5px solid rgba(27, 31, 29, 0.35);
    background: var(--paper-card);
    color: var(--ink);
    padding: 30px;
    box-shadow: 10px 10px 0 rgba(17, 21, 19, 0.28);
  }
  .kicker {
    font-size: 10px;
    letter-spacing: 0.44em;
    text-transform: uppercase;
    opacity: 0.6;
    margin-bottom: 4px;
  }
  h1 {
    font-size: 42px;
    line-height: 0.94;
    letter-spacing: -0.02em;
    margin-top: 6px;
    text-transform: uppercase;
  }
  .card p.desc {
    margin-top: 14px;
    max-width: 30rem;
    font-size: 13.5px;
    line-height: 1.55;
    opacity: 0.78;
  }
  dl {
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid rgba(27, 31, 29, 0.2);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 20px;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    opacity: 0.85;
  }
  dl div { display: flex; justify-content: space-between; }
  dd { font-family: 'Courier New', monospace; font-weight: bold; }

  .archetype-picker {
    margin-top: 18px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .archetype-btn {
    padding: 8px 10px;
    border: 1.5px solid rgba(27, 31, 29, 0.3);
    background: rgba(27, 31, 29, 0.04);
    font-family: Georgia, serif;
    font-size: 11px;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.15s var(--ease-out-quart), border-color 0.15s var(--ease-out-quart), box-shadow 0.15s var(--ease-out-quart);
  }
  .archetype-btn:hover {
    background: rgba(27, 31, 29, 0.08);
  }
  .archetype-btn.active {
    border-color: var(--hot);
    background: rgba(212, 98, 42, 0.12);
    box-shadow: 2px 2px 0 var(--hot);
  }
  .archetype-btn strong {
    display: block;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .archetype-btn span {
    display: block;
    font-size: 9.5px;
    opacity: 0.7;
    margin-top: 2px;
    font-family: 'Courier New', monospace;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    margin-top: 20px;
    padding: 13px 20px;
    border: 1.5px solid var(--ink);
    background: var(--ink);
    color: var(--paper);
    font-family: Georgia, serif;
    font-size: 13px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow: 5px 5px 0 var(--hot);
    transition: transform 0.12s var(--ease-out-quart), box-shadow 0.12s var(--ease-out-quart);
  }
  .btn:hover {
    transform: translate(-1px, -1px);
    box-shadow: 7px 7px 0 var(--hot);
  }
  .btn:active {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0 var(--hot);
  }
  .btn2 {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    margin-top: 8px;
    padding: 10px 16px;
    border: 1px solid rgba(27, 31, 29, 0.35);
    background: transparent;
    color: var(--ink);
    font-family: Georgia, serif;
    font-size: 12px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background-color 0.15s var(--ease-out-quart);
  }
  .btn2:hover {
    background: rgba(27, 31, 29, 0.08);
  }

  .options-group {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid rgba(27, 31, 29, 0.2);
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .option-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }
  .option-row input[type="checkbox"] {
    accent-color: var(--hot);
    width: 16px;
    height: 16px;
  }

  #pause { display: none; }

  /* Responsive Recomposition Rules (1366x768, 1920x1080, 2560x1440, 3440x1440, Mobile Landscape) */
  @media (min-width: 2200px) {
    #hud-top-left { top: 32px; left: 36px; }
    #hud-top-right { top: 28px; right: 36px; }
    #hud-top-center { width: min(560px, 34vw); top: 26px; }
    .hud-hero-dial { width: 196px; height: 184px; }
    .hud-hero-dial svg { width: 196px; height: 196px; }
    .hud-sub-dial { width: 120px; height: 90px; }
    .hud-sub-dial svg { width: 120px; height: 90px; }
  }
  @media (max-width: 1100px), (max-height: 700px) {
    #hud-top-center { width: min(320px, 34vw); }
    .hud-hero-dial { width: 142px; height: 134px; }
    .hud-hero-dial svg { width: 142px; height: 142px; }
    #hud-speed-big { font-size: 34px; }
    .hud-sub-dial { width: 88px; height: 66px; }
    .hud-sub-dial svg { width: 88px; height: 66px; }
    #hud-gauges-cluster { gap: 16px; bottom: 10px; }
    #pedals { bottom: 16px; left: 22px; gap: 16px; }
  }
  @media (max-width: 760px) {
    #hud-top-center { display: none; }
    .hud-env-item:first-child { display: none; }
    .hud-env-divider:first-of-type { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://unpkg.com/lenis@1.1.13/dist/lenis.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"></script>
</head>
<body>
<canvas id="three-canvas" style="position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;"></canvas>
<canvas id="game" style="position: fixed; inset: 0; width: 100%; height: 100%; touch-action: none; z-index: 2;"></canvas>
<canvas id="hud-three-canvas"></canvas>

<!-- ==========================================================================
     THE OLD MOUNTAIN WORKS — MASTER HUD 2.0 (LIVING EXPEDITION INSTRUMENTS)
     ========================================================================== -->
<div id="hud">
  <!-- Subterranean Topographic Contour Backdrop -->
  <svg id="hud-subterranean-contours" viewBox="0 0 1440 240" preserveAspectRatio="none" aria-hidden="true">
    <g fill="none" stroke="rgba(239, 231, 214, 0.085)" stroke-width="0.9">
      <!-- Left Subterranean Ridge Contours -->
      <path d="M 40,240 C 140,228 240,188 330,118 C 390,145 470,210 580,240" />
      <path d="M 65,240 C 155,228 248,194 334,130 C 392,155 466,214 565,240" />
      <path d="M 90,240 C 170,228 256,200 338,142 C 394,165 460,218 550,240" />
      <path d="M 115,240 C 185,230 264,206 342,154 C 396,174 454,222 535,240" />
      <path d="M 140,240 C 200,231 272,212 346,166 C 398,183 448,225 520,240" />
      <path d="M 165,240 C 218,232 280,217 350,178 C 400,192 442,228 505,240" />
      <path d="M 190,240 C 236,234 288,222 354,190 C 402,201 436,231 490,240" />
      <path d="M 215,240 C 254,235 296,227 358,202 C 404,210 430,234 475,240" />
      <!-- Right Subterranean Ridge Contours -->
      <path d="M 860,240 C 950,218 1020,165 1115,142 C 1210,165 1310,205 1420,240" />
      <path d="M 880,240 C 962,221 1028,174 1120,153 C 1212,174 1304,210 1405,240" />
      <path d="M 900,240 C 974,224 1036,183 1125,164 C 1214,183 1298,215 1390,240" />
      <path d="M 920,240 C 986,227 1044,192 1130,175 C 1216,192 1292,220 1375,240" />
      <path d="M 940,240 C 998,230 1052,201 1135,186 C 1218,201 1286,225 1360,240" />
      <path d="M 960,240 C 1010,233 1060,210 1140,197 C 1220,210 1280,230 1345,240" />
      <!-- Full-Span Deep Strata -->
      <path d="M 0,224 Q 190,198 350,185 T 720,218 T 1120,188 T 1440,212" stroke="rgba(239, 231, 214, 0.055)" />
      <path d="M 0,234 Q 210,212 370,198 T 720,228 T 1135,202 T 1440,225" stroke="rgba(239, 231, 214, 0.055)" />
    </g>
  </svg>

  <!-- A. TOP LEFT: EXPEDITION IDENTITY, VERTICAL GEOLOGICAL ALTIMETER & TELEMETRY -->
  <div id="hud-top-left">
    <div class="hud-identity" id="hud-identity-block">
      <!-- Precision Faceted Twin-Peak Mountain Emblem SVG -->
      <svg id="hud-emblem-svg" viewBox="0 0 64 40" aria-hidden="true">
        <polygon class="emblem-face" points="4,36 22,8 28,36" fill="rgba(239,231,214,0.88)" />
        <polygon class="emblem-face-dark" points="22,8 34,28 28,36" fill="rgba(239,231,214,0.38)" />
        <polygon class="emblem-face" points="20,36 40,3 46,36" fill="rgba(239,231,214,0.95)" />
        <polygon class="emblem-face-dark" points="40,3 60,36 46,36" fill="rgba(239,231,214,0.46)" />
        <polyline class="emblem-stroke" points="4,36 22,8 31,22 40,3 60,36" fill="none" stroke="#efe7d6" stroke-width="1.4" stroke-linejoin="round" />
        <polyline class="emblem-stroke" points="14,36 22,22 28,36" fill="none" stroke="#1b1f1d" stroke-width="1.1" />
        <polyline class="emblem-stroke" points="31,36 40,17 51,36" fill="none" stroke="#1b1f1d" stroke-width="1.1" />
      </svg>
      <div class="hud-identity-text">
        <div id="hud-brand-title">THE OLD MOUNTAIN WORKS</div>
        <div id="hud-brand-rule"></div>
        <div class="hud-brand-sub">
          <span>EXPEDITION LOG &nbsp;//&nbsp;</span>
          <span id="hud-sector-label">SECTOR 01</span>
          <span id="hud-lottie-relic" title="Mountain Echo Telemetry"></span>
        </div>
      </div>
    </div>

    <div class="hud-telemetry-wrap" id="hud-telemetry-block">
      <!-- Section 6: Vertical Geological Surveying Altimeter Strip -->
      <div class="hud-left-ruler">
        <svg id="hud-altimeter-svg" viewBox="0 0 14 160" preserveAspectRatio="none" aria-hidden="true">
          <line x1="1" y1="0" x2="1" y2="160" stroke="rgba(239,231,214,0.26)" stroke-width="1.2" />
          <!-- Scrolling Geological Strata & Elevation Tape -->
          <g id="hud-alt-tape" stroke="rgba(239,231,214,0.32)" stroke-width="0.8" fill="none">
            <line x1="1" y1="10" x2="7" y2="10" />
            <line x1="1" y1="20" x2="5" y2="20" />
            <path d="M 2,30 Q 6,28 11,31" stroke="rgba(239,231,214,0.18)" />
            <line x1="1" y1="40" x2="8" y2="40" />
            <line x1="1" y1="50" x2="5" y2="50" />
            <path d="M 2,60 Q 7,62 12,59" stroke="rgba(239,231,214,0.18)" />
            <line x1="1" y1="70" x2="8" y2="70" />
            <line x1="1" y1="80" x2="5" y2="80" />
            <path d="M 2,90 Q 6,88 11,91" stroke="rgba(239,231,214,0.18)" />
            <line x1="1" y1="100" x2="8" y2="100" />
            <line x1="1" y1="110" x2="5" y2="110" />
            <path d="M 2,120 Q 7,122 12,119" stroke="rgba(239,231,214,0.18)" />
            <line x1="1" y1="130" x2="8" y2="130" />
            <line x1="1" y1="140" x2="5" y2="140" />
            <line x1="1" y1="150" x2="8" y2="150" />
            <line x1="1" y1="170" x2="7" y2="170" />
            <line x1="1" y1="190" x2="8" y2="190" />
          </g>
          <!-- Vernier Elevation Pointer -->
          <polygon id="hud-alt-pointer" points="12,125 6,122 6,128" fill="#d4622a" />
        </svg>
        <div id="hud-left-indicator"></div>
      </div>

      <div class="hud-telemetry-grid">
        <span class="hud-tel-label">DIST</span>
        <span id="hud-dist" class="hud-tel-val mono">0 m</span>

        <span class="hud-tel-label bright">SPEED</span>
        <span id="hud-speed" class="hud-tel-val bright mono">0 km/h</span>

        <span class="hud-tel-label">ALT</span>
        <span id="hud-alt" class="hud-tel-val mono">1 m</span>

        <span class="hud-tel-label">INCLINE</span>
        <span class="hud-incline-row">
          <span id="hud-incline" class="hud-tel-val mono">0°</span>
          <!-- Section 7: Miniature Mechanical Spirit-Level / Inclinometer -->
          <svg id="hud-inclinometer-svg" viewBox="0 0 46 13" aria-hidden="true">
            <rect x="1" y="2.5" width="44" height="8" rx="4" fill="rgba(17,21,19,0.55)" stroke="rgba(239,231,214,0.26)" stroke-width="0.8" />
            <!-- Calibration Center Fiducials -->
            <line x1="19" y1="2.5" x2="19" y2="10.5" stroke="rgba(239,231,214,0.35)" stroke-width="0.7" />
            <line x1="27" y1="2.5" x2="27" y2="10.5" stroke="rgba(239,231,214,0.35)" stroke-width="0.7" />
            <line x1="11" y1="4.5" x2="11" y2="8.5" stroke="rgba(239,231,214,0.18)" stroke-width="0.6" />
            <line x1="35" y1="4.5" x2="35" y2="8.5" stroke="rgba(239,231,214,0.18)" stroke-width="0.6" />
            <!-- Tilting Horizon Reference Line -->
            <line id="hud-incline-bar" x1="8" y1="6.5" x2="38" y2="6.5" stroke="rgba(239,231,214,0.28)" stroke-width="0.7" />
            <!-- Inertial Spirit-Level Bubble / Pendulum -->
            <circle id="hud-incline-bubble" cx="23" cy="6.5" r="2.4" fill="#d4622a" stroke="#efe7d6" stroke-width="0.5" />
          </svg>
        </span>

        <span class="hud-tel-label">ECHOES</span>
        <span id="hud-echoes" class="hud-tel-val mono">0/6</span>

        <span class="hud-tel-label">ZONE</span>
        <span id="hud-zone" class="hud-tel-val mono">ALPINE MEADOW</span>

        <span class="hud-tel-label">SCORE</span>
        <span id="hud-score" class="hud-tel-val mono">0</span>

        <span class="hud-tel-label">VEHICLE</span>
        <span id="hud-vehicle" class="hud-tel-val mono">TRAIL BUGGY</span>
      </div>

      <!-- Section 10: Archival Field-Notebook Echo Discovery Annotation -->
      <div id="hud-echo-annotation">
        <div class="echo-anno-header">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#d4622a" stroke-width="1.3">
            <polygon points="8,1 15,8 8,15 1,8" />
            <circle cx="8" cy="8" r="2" fill="#efe7d6" stroke="none" />
          </svg>
          <span id="hud-echo-anno-counter">ARCHIVAL LOG // ECHO 01 / 06</span>
        </div>
        <div class="echo-anno-line" id="hud-echo-anno-line"></div>
        <div id="hud-echo-anno-name">THE SURVEYOR'S COMPASS</div>
      </div>

      <div class="rpm"><i id="hud-rpm"></i></div>
      <div id="hud-air"></div>
      <div id="hud-combo"></div>
      <div id="hud-warning">WARNING: INVERTED! RECOVERY: <span id="hud-warning-timer">1.8s</span></div>
    </div>
  </div>

  <!-- B. TOP CENTER: SURVEYED EXPEDITION ROUTE & LIVING GEOLOGICAL TERRAIN SCANNER -->
  <div id="hud-top-center">
    <div class="hud-route-header">
      <span>BASE CAMP</span>
      <span id="hud-route-sector-tag">ROUTE // ALPINE MEADOW</span>
      <span>SUMMIT</span>
    </div>
    <!-- Section 9: Hand-Surveyed Mountain Route SVG with 6 Survey Node Types -->
    <svg id="hud-route-svg" viewBox="0 0 400 28">
      <!-- Upcoming Surveyed Ridge Track (Dashed Field-Manual Line) -->
      <path id="hud-route-track" d="M 8,21 L 55,18 L 82,13 L 135,16 L 154,15 L 185,10 L 228,9 L 285,6 L 308,11 L 350,8 L 392,3" fill="none" stroke="rgba(239,231,214,0.20)" stroke-width="1.15" stroke-dasharray="3 2" />
      <!-- Completed Archival Route Trace -->
      <path id="hud-route-Progress-bg" d="M 8,21 L 55,18 L 82,13 L 135,16 L 154,15 L 185,10 L 228,9 L 285,6 L 308,11 L 350,8 L 392,3" fill="none" stroke="rgba(239,231,214,0.16)" stroke-width="1.2" />
      <path id="hud-route-progress" d="M 8,21 L 55,18 L 82,13 L 135,16 L 154,15 L 185,10 L 228,9 L 285,6 L 308,11 L 350,8 L 392,3" fill="none" stroke="#efe7d6" stroke-width="1.5" stroke-dasharray="410" stroke-dashoffset="410" />
      <!-- Survey Nodes: BASE CAMP (0), LANDMARK (1), ECHO (2), SECTOR (3), DANGER (4), SUMMIT (5) -->
      <g id="hud-route-nodes" fill="rgba(239,231,214,0.48)" stroke="rgba(239,231,214,0.48)" stroke-width="0.9">
        <!-- Base Camp Node -->
        <g class="route-node" data-node="0" transform="translate(8, 21)">
          <circle r="2" />
        </g>
        <!-- Landmark Node -->
        <g class="route-node" data-node="1" transform="translate(82, 13)">
          <circle r="1.7" />
          <circle class="node-ring" r="4" fill="none" opacity="0" />
        </g>
        <!-- Echo Survey Node (Diamond) -->
        <g class="route-node" data-node="2" transform="translate(154, 15)">
          <polygon points="0,-2.4 2.4,0 0,2.4 -2.4,0" fill="#c8a464" stroke="none" />
          <circle class="node-ring" r="4.2" fill="none" stroke="#c8a464" opacity="0" />
        </g>
        <!-- Sector Boundary Node -->
        <g class="route-node" data-node="3" transform="translate(228, 9)">
          <rect x="-1.8" y="-1.8" width="3.6" height="3.6" fill="rgba(239,231,214,0.65)" stroke="none" />
          <circle class="node-ring" r="4.5" fill="none" opacity="0" />
        </g>
        <!-- Danger / Chasm Node (Triangle) -->
        <g class="route-node" data-node="4" transform="translate(308, 11)">
          <polygon points="0,-2.5 2.4,2 -2.4,2" fill="none" stroke="#d4622a" stroke-width="1" />
        </g>
        <!-- Summit Survey Target -->
        <g class="route-node" data-node="5" transform="translate(392, 3)">
          <circle r="2.4" stroke="#d4622a" stroke-width="1.1" fill="none" />
          <circle r="0.9" fill="#d4622a" stroke="none" />
        </g>
      </g>
      <!-- Live Vehicle Expedition Beacon on Route -->
      <g id="hud-route-beacon" transform="translate(8, 21)">
        <circle r="4.8" fill="rgba(212,98,42,0.24)" />
        <circle r="2.2" fill="#d4622a" stroke="#efe7d6" stroke-width="0.5" />
      </g>
    </svg>

    <!-- Section 8: Signature Living Geological Terrain Scanner -->
    <div class="hud-scanner-wrap">
      <svg id="hud-scanner-svg" viewBox="0 0 360 28">
        <!-- Datum Baseline & Fixed Vehicle Fiducial Crosshair -->
        <line x1="0" y1="24" x2="360" y2="24" stroke="rgba(239,231,214,0.12)" stroke-width="0.7" stroke-dasharray="2 3" />
        <line x1="64" y1="2" x2="64" y2="26" stroke="rgba(212,98,42,0.38)" stroke-width="0.75" stroke-dasharray="1.5 1.5" />
        <!-- Geological Vertical Strata Shading ticks under upcoming terrain -->
        <path id="hud-scanner-strata" d="" fill="none" stroke="rgba(239,231,214,0.12)" stroke-width="0.75" />
        <!-- Past Terrain Trace (Left of Vehicle) -->
        <path id="hud-scanner-past" d="M 0,16 L 64,16" fill="none" stroke="rgba(239,231,214,0.22)" stroke-width="1.1" />
        <!-- Upcoming Terrain Profile (Right of Vehicle) -->
        <path id="hud-scanner-line" d="M 64,16 L 360,16" fill="none" stroke="rgba(239,231,214,0.62)" stroke-width="1.35" stroke-linejoin="round" />
        <!-- Upcoming Feature / Hazard Reticle -->
        <g id="hud-scanner-reticle" transform="translate(180, 14)" opacity="0">
          <circle r="3.2" fill="none" stroke="#d4622a" stroke-width="0.9" />
          <line x1="0" y1="-5" x2="0" y2="5" stroke="#d4622a" stroke-width="0.6" />
        </g>
        <!-- Fixed Vehicle Position Fiducial Marker -->
        <circle id="hud-scanner-car" cx="64" cy="16" r="2.3" fill="#d4622a" stroke="#efe7d6" stroke-width="0.6" />
      </svg>
      <div class="hud-scanner-footer">
        <span>GEO-PROFILE // +30M</span>
        <span id="hud-scanner-callout">TERRAIN // NOMINAL</span>
      </div>
    </div>
  </div>

  <!-- C. TOP RIGHT: ENVIRONMENT TELEMETRY & 3D GIMBAL COMPASS ROSE -->
  <div id="hud-top-right">
    <div class="hud-env-cluster">
      <!-- Time of Day -->
      <div class="hud-env-item">
        <svg class="hud-env-icon" id="hud-sun-svg" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4.2" />
          <line x1="12" y1="2.5" x2="12" y2="5.2" />
          <line x1="12" y1="18.8" x2="12" y2="21.5" />
          <line x1="2.5" y1="12" x2="5.2" y2="12" />
          <line x1="18.8" y1="12" x2="21.5" y2="12" />
          <line x1="5.3" y1="5.3" x2="7.2" y2="7.2" />
          <line x1="16.8" y1="16.8" x2="18.7" y2="18.7" />
          <line x1="18.7" y1="5.3" x2="16.8" y2="7.2" />
          <line x1="7.2" y1="16.8" x2="5.3" y2="18.7" />
        </svg>
        <div class="hud-env-data">
          <span class="hud-env-primary" id="hud-time-val">06:24</span>
          <span class="hud-env-secondary" id="hud-time-ampm">AM</span>
        </div>
      </div>

      <div class="hud-env-divider"></div>

      <!-- Weather & Altitude Temperature -->
      <div class="hud-env-item">
        <svg class="hud-env-icon" id="hud-weather-svg" viewBox="0 0 24 24">
          <path d="M6.5,17.5 H17.5 A3.5,3.5 0 0,0 18,10.6 A4.8,4.8 0 0,0 8.8,8.8 A3.8,3.8 0 0,0 6.5,17.5 Z" stroke-linejoin="round" />
        </svg>
        <div class="hud-env-data">
          <span class="hud-env-primary" id="hud-temp-val">12°C</span>
          <span class="hud-env-secondary" id="hud-weather-label">CLEAR</span>
        </div>
      </div>

      <div class="hud-env-divider"></div>
    </div>

    <!-- Section 5: 3D Gimbal Compass Rose with Inertial Magnetic Needle -->
    <div class="hud-compass-wrap" id="hud-compass-box">
      <svg id="hud-compass-svg" viewBox="0 0 64 64">
        <!-- Fixed Outer Anodized Bezel Housing -->
        <circle cx="32" cy="32" r="25" fill="rgba(17,21,19,0.52)" stroke="rgba(239,231,214,0.22)" stroke-width="0.9" />
        <line x1="32" y1="5" x2="32" y2="7.5" stroke="#d4622a" stroke-width="1.2" />
        <!-- 3D Tilting Inner Gimbal Compass Card -->
        <g id="hud-compass-card">
          <circle cx="32" cy="32" r="21.5" fill="none" stroke="rgba(239,231,214,0.32)" stroke-width="1" />
          <circle cx="32" cy="32" r="14" fill="none" stroke="rgba(239,231,214,0.10)" stroke-width="0.6" stroke-dasharray="1.5 2" />
          <g stroke="rgba(239,231,214,0.28)" stroke-width="0.8">
            <line x1="32" y1="9" x2="32" y2="12" />
            <line x1="32" y1="52" x2="32" y2="55" />
            <line x1="9" y1="32" x2="12" y2="32" />
            <line x1="52" y1="32" x2="55" y2="32" />
            <line x1="16.4" y1="16.4" x2="18.5" y2="18.5" />
            <line x1="47.6" y1="16.4" x2="45.5" y2="18.5" />
            <line x1="16.4" y1="47.6" x2="18.5" y2="45.5" />
            <line x1="47.6" y1="47.6" x2="45.5" y2="45.5" />
          </g>
          <!-- Cardinal Labels -->
          <text x="32" y="6.2" text-anchor="middle" fill="rgba(239,231,214,0.78)" font-size="5.5" font-family="Courier New, monospace">N</text>
          <text x="32" y="62.2" text-anchor="middle" fill="rgba(239,231,214,0.52)" font-size="5.5" font-family="Courier New, monospace">S</text>
          <text x="4.2" y="34" text-anchor="middle" fill="rgba(239,231,214,0.52)" font-size="5.5" font-family="Courier New, monospace">W</text>
          <text x="59.8" y="34" text-anchor="middle" fill="rgba(239,231,214,0.52)" font-size="5.5" font-family="Courier New, monospace">E</text>
          <!-- Cast Needle Shadow for Physical Depth -->
          <g id="hud-compass-needle-shadow" transform="translate(1.2, 1.8) rotate(0 32 32)" opacity="0.55">
            <polygon points="32,13 35.8,32 32,51 28.2,32" fill="#050706" />
          </g>
          <!-- Rotating Inertial Magnetic Diamond Needle -->
          <g id="hud-compass-needle" transform="rotate(0 32 32)">
            <polygon points="32,13.5 35.6,32 28.4,32" fill="#d4622a" stroke="#efe7d6" stroke-width="0.5" />
            <polygon points="32,50.5 35.6,32 28.4,32" fill="rgba(239,231,214,0.22)" stroke="#efe7d6" stroke-width="0.6" />
            <circle cx="32" cy="32" r="2" fill="#141917" stroke="#c8a464" stroke-width="0.8" />
          </g>
        </g>
      </svg>
    </div>
  </div>

  <!-- D. RIGHT COLUMN: RADIAL STUNT GYRO, SUSPENDED AIRTIME & VERTICAL ELEVATION BAR -->
  <div id="hud-right-column">
    <div class="hud-right-instrument">
      <!-- Section 12: Suspended Airborne Timer -->
      <div id="hud-airtime-chrono">
        <span id="hud-airtime-digits">00.00 s</span>
      </div>
      <!-- Section 11: Radial Stunt Angular Momentum Gyro -->
      <svg id="hud-stunt-gyro-svg" viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r="18" fill="rgba(17,21,19,0.45)" stroke="rgba(239,231,214,0.22)" stroke-width="1" stroke-dasharray="2 2" />
        <circle cx="22" cy="22" r="14" fill="none" stroke="rgba(239,231,214,0.14)" stroke-width="1.8" />
        <!-- Active Angular Momentum Sweep Arc -->
        <circle id="hud-stunt-gyro-arc" cx="22" cy="22" r="14" fill="none" stroke="#d4622a" stroke-width="2.4" stroke-dasharray="88" stroke-dashoffset="88" transform="rotate(-90 22 22)" />
        <!-- Landing Mechanical Pulse Ring -->
        <circle id="hud-stunt-pulse-ring" cx="22" cy="22" r="18" fill="none" stroke="#d4622a" stroke-width="1.5" opacity="0" />
        <!-- Center Pitch Horizon Vector -->
        <g id="hud-stunt-gyro-rotor" transform="rotate(0 22 22)">
          <line x1="13" y1="22" x2="31" y2="22" stroke="#efe7d6" stroke-width="1.2" />
          <polygon points="22,10 24,14 20,14" fill="#d4622a" />
        </g>
      </svg>
      <div class="hud-right-text" id="hud-right-labels">
        <span class="lead" id="hud-right-line1">HIGHER</span>
        <span id="hud-right-line2">TERRAIN</span>
        <span id="hud-right-line3">BIGGER</span>
        <span id="hud-right-line4">STORIES</span>
        <div class="hud-right-dash"></div>
      </div>
    </div>
    <div class="hud-vertical-bar">
      <div id="hud-stunt-bar-top"></div>
      <div id="hud-stunt-bar-mid"></div>
    </div>
  </div>

  <!-- E. BOTTOM RIGHT: 4WD TECHNICAL DRIVETRAIN & AXLE TORQUE VISUALIZER -->
  <div id="hud-vehicle-status">
    <svg id="hud-4wd-emblem" viewBox="0 0 36 20">
      <polyline points="2,18 13,4 19,13 25,3 34,18" fill="none" stroke="#efe7d6" stroke-width="1.3" stroke-linejoin="round" />
      <polyline points="8,18 13,10 17,18" fill="none" stroke="rgba(239,231,214,0.45)" stroke-width="1" />
      <polyline points="20,18 25,9 30,18" fill="none" stroke="rgba(239,231,214,0.45)" stroke-width="1" />
    </svg>
    <div id="hud-drivetrain-mode">4WD</div>
    <div id="hud-drivetrain-dot"></div>
    <!-- Section 14: Miniature Technical Drivetrain & 4-Wheel Torque/Slip Schematic -->
    <svg id="hud-wheel-matrix" viewBox="0 0 44 22">
      <!-- Rear & Front Axles -->
      <line id="hud-axle-rear" x1="10" y1="5" x2="10" y2="17" stroke="rgba(239,231,214,0.38)" stroke-width="1.2" />
      <line id="hud-axle-front" x1="34" y1="5" x2="34" y2="17" stroke="rgba(239,231,214,0.38)" stroke-width="1.2" />
      <!-- Center Driveshaft & Differential -->
      <line id="hud-driveshaft" x1="10" y1="11" x2="34" y2="11" stroke="rgba(239,231,214,0.32)" stroke-width="1.2" />
      <circle id="hud-diff-center" cx="22" cy="11" r="2" fill="#141917" stroke="rgba(239,231,214,0.55)" stroke-width="0.9" />
      <!-- 4 Physical Wheel Hubs -->
      <rect id="hud-wheel-rl" x="6.5" y="2" width="7" height="3.6" rx="1" fill="#efe7d6" />
      <rect id="hud-wheel-rr" x="6.5" y="16.4" width="7" height="3.6" rx="1" fill="#efe7d6" />
      <rect id="hud-wheel-fl" x="30.5" y="2" width="7" height="3.6" rx="1" fill="#efe7d6" />
      <rect id="hud-wheel-fr" x="30.5" y="16.4" width="7" height="3.6" rx="1" fill="#efe7d6" />
    </svg>
  </div>

  <!-- F. BOTTOM CENTER: MULTI-LAYER 3D / MECHANICAL 3-DIAL INSTRUMENT CLUSTER -->
  <div id="hud-gauges-cluster">
    <!-- 1. LEFT SUB-DIAL: DELIBERATE EXPEDITION FUEL / RESERVE INSTRUMENT (Section 15) -->
    <div class="hud-sub-dial" id="hud-fuel-gauge">
      <svg viewBox="0 0 110 82">
        <!-- Layer 1: Dark Anodized Mechanical Housing Arc -->
        <path d="M 10,64 A 46,46 0 0,1 100,64" fill="rgba(14,18,16,0.68)" stroke="rgba(239,231,214,0.18)" stroke-width="0.9" />
        <!-- Layer 2: Inner Scale Track -->
        <path d="M 14,62 A 42,42 0 0,1 96,62" fill="none" stroke="rgba(239,231,214,0.16)" stroke-width="3.2" />
        <!-- Layer 3: Burnt-Orange Active Fuel Reserve Arc -->
        <path id="hud-fuel-arc" d="M 14,62 A 42,42 0 0,1 96,62" fill="none" stroke="#d4622a" stroke-width="2.8" stroke-dasharray="132" stroke-dashoffset="68" />
        <!-- Layer 4: Precision Radial Tick Marks -->
        <g stroke="rgba(239,231,214,0.44)" stroke-width="1">
          <line x1="14" y1="62" x2="19" y2="62" />
          <line x1="19" y1="41" x2="23" y2="43" />
          <line x1="34" y1="25" x2="37" y2="29" />
          <line x1="55" y1="20" x2="55" y2="25" />
          <line x1="76" y1="25" x2="73" y2="29" />
          <line x1="91" y1="41" x2="87" y2="43" />
          <line x1="96" y1="62" x2="91" y2="62" />
        </g>
        <!-- Layer 5: E & F Labels -->
        <text x="11" y="74" text-anchor="middle" fill="rgba(239,231,214,0.58)" font-size="7.5" font-family="Courier New, monospace">E</text>
        <text x="99" y="74" text-anchor="middle" fill="rgba(239,231,214,0.58)" font-size="7.5" font-family="Courier New, monospace">F</text>
        <!-- Layer 6: Fuel Pump Icon -->
        <g transform="translate(47, 45)" stroke="#efe7d6" stroke-width="1.2" fill="none">
          <rect x="2" y="2" width="9" height="13" rx="1" fill="rgba(239,231,214,0.88)" stroke="none" />
          <rect x="3.5" y="3.8" width="6" height="4.2" fill="#111513" stroke="none" />
          <path d="M11,5 L14,7.5 L14,13.5 A1.5,1.5 0 0,1 11,13.5" stroke="#efe7d6" stroke-width="1.2" />
          <line x1="1" y1="15" x2="12" y2="15" stroke="#efe7d6" stroke-width="1.4" />
        </g>
        <!-- Layer 7: Cast Needle Shadow -->
        <g id="hud-fuel-needle-shadow" transform="translate(1.4, 1.8) rotate(-4 55 62)" opacity="0.55">
          <line x1="55" y1="36" x2="55" y2="18" stroke="#040605" stroke-width="2" stroke-linecap="round" />
        </g>
        <!-- Layer 8: Deliberate Reserve Pointer Needle -->
        <g id="hud-fuel-needle" transform="rotate(-4 55 62)">
          <line x1="55" y1="34" x2="55" y2="18" stroke="#efe7d6" stroke-width="1.5" stroke-linecap="round" />
          <circle cx="55" cy="21" r="1.3" fill="#d4622a" />
        </g>
        <text id="hud-fuel-low" x="55" y="76" text-anchor="middle" fill="#d4622a" font-size="6.5" font-family="Courier New, monospace" letter-spacing="1.5" opacity="0">LOW</text>
      </svg>
    </div>

    <!-- 2. CENTER HERO DIAL: 10-LAYER MECHANICAL SPEEDOMETER (Section 3) -->
    <div class="hud-hero-dial" id="hud-speedometer">
      <svg viewBox="0 0 200 200">
        <!-- Layer 1: Outer Dark Anodized Mechanical Housing -->
        <circle id="speedo-layer-housing" cx="100" cy="100" r="91" fill="rgba(13,17,15,0.72)" stroke="rgba(239,231,214,0.14)" stroke-width="1.2" />
        <!-- Layer 2: Thin Brushed Metallic Bezel Ring & Lower Tapered Bezel Arcs -->
        <circle id="speedo-layer-ring" cx="100" cy="100" r="88" fill="none" stroke="rgba(239,231,214,0.26)" stroke-width="1" />
        <path d="M 30.7,140 A 80,80 0 0,0 60,169.3" fill="none" stroke="rgba(239,231,214,0.22)" stroke-width="3.8" />
        <path d="M 169.3,140 A 80,80 0 0,1 140,169.3" fill="none" stroke="rgba(239,231,214,0.22)" stroke-width="3.8" />
        <!-- Background Inner Track Arc (240 deg sweep from 150 deg to 390 deg) -->
        <path d="M 30.7,140 A 80,80 0 1,1 169.3,140" fill="none" stroke="rgba(239,231,214,0.26)" stroke-width="4.5" stroke-linecap="butt" />
        <!-- Layer 5: Orange High-Speed Section (Material Contrast, No Glow) -->
        <path id="hud-speed-orange-zone" d="M 148,36 A 80,80 0 0,1 169.3,140" fill="none" stroke="#d4622a" stroke-width="4.5" opacity="0.92" />
        <!-- Live Speed Illuminated Arc (Warm Paper) -->
        <path id="hud-speed-arc" d="M 30.7,140 A 80,80 0 1,1 169.3,140" fill="none" stroke="#efe7d6" stroke-width="4.5" stroke-dasharray="335" stroke-dashoffset="248" />
        <!-- Layer 3: Precision Radial Major & Minor Tick Marks -->
        <g id="speedo-layer-ticks" stroke="rgba(239,231,214,0.38)" stroke-width="1">
          <line x1="25" y1="143" x2="31" y2="139" stroke-width="1.3" />
          <line x1="18" y1="122" x2="22" y2="120" stroke-width="0.7" />
          <line x1="16" y1="100" x2="23" y2="100" stroke-width="1.3" />
          <line x1="21" y1="72" x2="25" y2="74" stroke-width="0.7" />
          <line x1="37" y1="47" x2="43" y2="52" stroke-width="1.3" />
          <line x1="56" y1="30" x2="59" y2="34" stroke-width="0.7" />
          <line x1="78" y1="20" x2="80" y2="27" stroke-width="1.3" />
          <line x1="100" y1="16" x2="100" y2="21" stroke-width="0.8" />
          <line x1="122" y1="20" x2="120" y2="27" stroke-width="1.3" />
          <line x1="144" y1="30" x2="141" y2="34" stroke-width="0.7" />
          <line x1="163" y1="47" x2="157" y2="52" stroke="#d4622a" stroke-width="1.3" />
          <line x1="179" y1="72" x2="175" y2="74" stroke="#d4622a" stroke-width="0.7" />
          <line x1="184" y1="100" x2="177" y2="100" stroke="#d4622a" stroke-width="1.3" />
          <line x1="182" y1="122" x2="178" y2="120" stroke="#d4622a" stroke-width="0.7" />
          <line x1="175" y1="143" x2="169" y2="139" stroke="#d4622a" stroke-width="1.3" />
        </g>
        <!-- Layer 4: Engraved Micro Speed Scale -->
        <g id="speedo-layer-scale" fill="rgba(239,231,214,0.34)" font-size="5.2" font-family="Courier New, monospace" text-anchor="middle">
          <text x="39" y="137">0</text>
          <text x="31" y="102">20</text>
          <text x="49" y="59">40</text>
          <text x="82" y="36">60</text>
          <text x="118" y="36">80</text>
          <text x="150" y="59" fill="rgba(212,98,42,0.75)">100</text>
          <text x="167" y="102" fill="rgba(212,98,42,0.75)">120</text>
          <text x="159" y="137" fill="rgba(212,98,42,0.75)">140</text>
        </g>
        <!-- Layer 10: Tiny Calibration Marks & Inner Reference Ring -->
        <g id="speedo-layer-cal">
          <circle cx="100" cy="100" r="64" fill="none" stroke="rgba(239,231,214,0.08)" stroke-width="0.6" stroke-dasharray="1.5 3.5" />
          <line x1="95" y1="58" x2="105" y2="58" stroke="rgba(239,231,214,0.16)" stroke-width="0.6" />
        </g>
        <!-- Layer 6: Cast Needle Shadow (Physical Depth Separation) -->
        <g id="hud-speed-needle-shadow" transform="translate(2.2, 2.8) rotate(-70 100 100)" opacity="0.62">
          <line x1="100" y1="56" x2="100" y2="18" stroke="#040605" stroke-width="2.6" stroke-linecap="round" />
        </g>
        <!-- Layer 7: Physical Analog Needle with Tapered Tip -->
        <g id="hud-speed-needle" transform="rotate(-70 100 100)">
          <line x1="100" y1="54" x2="100" y2="21" stroke="#efe7d6" stroke-width="1.6" stroke-linecap="round" />
          <line x1="100" y1="27" x2="100" y2="17.5" stroke="#d4622a" stroke-width="2.1" stroke-linecap="round" />
        </g>
        <!-- Layer 8: Central Mechanical Pivot Assembly (Rotates subtly with needle torque) -->
        <g id="hud-speed-pivot" transform="rotate(0 100 100)">
          <circle cx="100" cy="100" r="38" fill="none" stroke="rgba(239,231,214,0.07)" stroke-width="0.7" />
          <circle cx="100" cy="62" r="1.2" fill="rgba(200,164,100,0.45)" />
        </g>
      </svg>
      <!-- Layer 9: Digital Speed Readout (Reacts faster than needle to convey physical mass) -->
      <div class="hud-speed-center">
        <div id="hud-speed-big">0</div>
        <div class="hud-speed-unit">KM/H</div>
        <div class="hud-speed-rule"></div>
      </div>
    </div>

    <!-- 3. RIGHT SUB-DIAL: ENGINE RPM & THERMAL VIBRATION INSTRUMENT (Section 4) -->
    <div class="hud-sub-dial" id="hud-rpm-gauge">
      <svg viewBox="0 0 110 82">
        <!-- Layer 1: Dark Anodized Mechanical Housing Arc -->
        <path d="M 10,64 A 46,46 0 0,1 100,64" fill="rgba(14,18,16,0.68)" stroke="rgba(239,231,214,0.18)" stroke-width="0.9" />
        <!-- Layer 2: Outer Scale Track -->
        <path d="M 14,62 A 42,42 0 0,1 96,62" fill="none" stroke="rgba(239,231,214,0.16)" stroke-width="3.2" />
        <!-- Layer 3: Right-Side Redline Warning Sector -->
        <path id="hud-rpm-redline" d="M 88,38 A 42,42 0 0,1 96,62" fill="none" stroke="#d4622a" stroke-width="3.2" opacity="0.92" />
        <!-- Layer 4: Live RPM/Thermal Arc -->
        <path id="hud-rpm-arc" d="M 14,62 A 42,42 0 0,1 96,62" fill="none" stroke="rgba(239,231,214,0.32)" stroke-width="2.6" stroke-dasharray="132" stroke-dashoffset="105" />
        <!-- Layer 5: Radial Tick Marks -->
        <g stroke="rgba(239,231,214,0.44)" stroke-width="1">
          <line x1="14" y1="62" x2="19" y2="62" />
          <line x1="19" y1="41" x2="23" y2="43" />
          <line x1="34" y1="25" x2="37" y2="29" />
          <line x1="55" y1="20" x2="55" y2="25" />
          <line x1="76" y1="25" x2="73" y2="29" />
          <line x1="91" y1="41" x2="87" y2="43" stroke="#d4622a" />
          <line x1="96" y1="62" x2="91" y2="62" stroke="#d4622a" />
        </g>
        <!-- C & H Labels -->
        <text x="11" y="74" text-anchor="middle" fill="rgba(239,231,214,0.58)" font-size="7.5" font-family="Courier New, monospace">C</text>
        <text x="99" y="74" text-anchor="middle" fill="rgba(239,231,214,0.58)" font-size="7.5" font-family="Courier New, monospace">H</text>
        <!-- Thermometer / Engine Core Icon -->
        <g transform="translate(46, 44)" stroke="#efe7d6" stroke-width="1.3" fill="none" stroke-linecap="round">
          <path d="M9,2 V11 A2.8,2.8 0 1,0 9,16.5 A2.8,2.8 0 0,0 9,11" fill="rgba(239,231,214,0.2)" />
          <circle cx="9" cy="13.8" r="1.6" fill="#efe7d6" stroke="none" />
          <line x1="11.5" y1="4.5" x2="14" y2="4.5" />
          <line x1="11.5" y1="7.2" x2="13.5" y2="7.2" />
          <line x1="11.5" y1="9.8" x2="14" y2="9.8" />
          <path d="M2,16.5 Q4.5,15 7,16.5 T12,16.5 T16,16.5" stroke-width="1.1" />
          <path d="M3,19 Q5.5,17.5 8,19 T13,19 T15,19" stroke-width="1.1" />
        </g>
        <!-- Cast Needle Shadow -->
        <g id="hud-rpm-needle-shadow" transform="translate(1.4, 1.8) rotate(-48 55 62)" opacity="0.55">
          <line x1="55" y1="36" x2="55" y2="18" stroke="#040605" stroke-width="2" stroke-linecap="round" />
        </g>
        <!-- Rotating Engine Vibration / RPM Needle -->
        <g id="hud-rpm-needle" transform="rotate(-48 55 62)">
          <line x1="55" y1="34" x2="55" y2="18" stroke="#efe7d6" stroke-width="1.5" stroke-linecap="round" />
          <circle cx="55" cy="20.5" r="1.3" fill="#d4622a" />
        </g>
        <text id="hud-rpm-readout" x="55" y="76" text-anchor="middle" fill="rgba(239,231,214,0.52)" font-size="6" font-family="Courier New, monospace" letter-spacing="1" opacity="0">RPM x1000</text>
      </svg>
    </div>
  </div>
</div>

<!-- Cinematic Death Interruption Banner -->
<div id="hud-death-banner">
  <div class="kicker">TELEMETRY LOCKED &middot; SIGNAL LOST</div>
  <div class="title" id="hud-death-banner-title">EXPEDITION INTERRUPTED</div>
</div>

<!-- Floating Stunt Notification Container -->
<div id="hud-stunt"></div>

<!-- G. BOTTOM LEFT: MECHANICAL SVG PEDAL CONTROLS (Section 13) -->
<div id="pedals">
  <div class="pedal-unit" id="pedal-unit-l">
    <button id="pedal-l" aria-label="Reverse / brake">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="rgba(239,231,214,0.12)" stroke-width="0.8" stroke-dasharray="2 2" />
        <polyline points="7.5,8.5 12,13 16.5,8.5" />
        <polyline points="7.5,13 12,17.5 16.5,13" />
      </svg>
    </button>
    <span class="pedal-label">BRAKE</span>
  </div>
  <div class="pedal-divider"></div>
  <div class="pedal-unit" id="pedal-unit-r">
    <button id="pedal-r" aria-label="Throttle">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="rgba(239,231,214,0.12)" stroke-width="0.8" stroke-dasharray="2 2" />
        <polyline points="7.5,15.5 12,11 16.5,15.5" />
        <polyline points="7.5,11 12,6.5 16.5,11" />
      </svg>
    </button>
    <span class="pedal-label">ACCELERATE</span>
  </div>
</div>

<!-- Title & Expedition Launch Overlay -->
<div class="overlay" id="title">
  <div class="card">
    <p class="kicker">Field Expedition &middot; Physics Master</p>
    <h1>The Old Mountain Works</h1>
    <p class="desc">
      A tactile 2.5D mountain driving expedition. Traverse procedural alpine ridges, wooden trestles, and industrial ruins. Discover the six Mountain Echoes and master weight transfer, suspension recoil, and mid-air rotational momentum.
    </p>

    <div class="archetype-picker" id="title-archetypes">
      <button class="archetype-btn active" data-archetype="buggy">
        <strong>Trail Buggy</strong>
        <span>Balanced &middot; Agile</span>
      </button>
      <button class="archetype-btn" data-archetype="crawler">
        <strong>Rock Crawler</strong>
        <span>Heavy &middot; High Grip</span>
      </button>
      <button class="archetype-btn" data-archetype="rally">
        <strong>Alpine Rally</strong>
        <span>Fast &middot; Stiff</span>
      </button>
    </div>

    <dl>
      <div><dt>Throttle / Pitch Up</dt><dd>D / W / &rarr;</dd></div>
      <div><dt>Brake / Pitch Down</dt><dd>A / S / &larr;</dd></div>
      <div><dt>Reset Vehicle</dt><dd>R</dd></div>
      <div><dt>New Mountain Seed</dt><dd>N</dd></div>
      <div><dt>Diagnostics</dt><dd>F3</dd></div>
      <div><dt>Career Best</dt><dd id="title-best-dist">0 m</dd></div>
    </dl>
    <button class="btn" id="start-btn"><span>Begin Expedition</span><span>&rarr;</span></button>
  </div>
</div>

<!-- Pause & Expedition Log Overlay -->
<div class="overlay" id="pause">
  <div class="card">
    <p class="kicker">Paused &middot; Expedition Log</p>
    <h1 style="font-size: 32px;">Field Manual &amp; Recap</h1>

    <dl>
      <div><dt>Current Distance</dt><dd id="recap-dist">0 m</dd></div>
      <div><dt>Peak Altitude</dt><dd id="recap-alt">0 m</dd></div>
      <div><dt>Expedition Score</dt><dd id="recap-score">0</dd></div>
      <div><dt>Best Airtime</dt><dd id="recap-air">0.0 s</dd></div>
      <div><dt>Max Combo</dt><dd id="recap-combo">x1</dd></div>
      <div><dt>All-Time Record</dt><dd id="recap-best">0 m</dd></div>
    </dl>

    <div class="options-group">
      <label class="option-row"><span>Camera Impact Shake</span><input type="checkbox" id="opt-shake" checked /></label>
      <label class="option-row"><span>Reduced Motion</span><input type="checkbox" id="opt-motion" /></label>
      <label class="option-row"><span>Mute Synthesizer Audio</span><input type="checkbox" id="opt-mute" /></label>
    </div>

    <button class="btn" id="resume-btn"><span>Resume Climb</span><span>&rarr;</span></button>
    <button class="btn2" id="restart-btn"><span>Restart At Basecamp</span><span>R</span></button>
    <button class="btn2" id="seed-btn"><span>Generate New Mountain</span><span>N</span></button>
  </div>
</div>

<!-- Death Debrief Overlay (Spec #46) -->
<div class="overlay" id="death-screen" style="display: none;">
  <div class="card">
    <p class="kicker" style="color: #d4622a; opacity: 1; font-weight: bold;">Expedition Terminated &middot; Vehicle Wrecked</p>
    <h1 id="death-cause" style="font-size: 34px; color: #1b1f1d;">ROOF IMPACT</h1>
    <p class="desc" id="death-desc">The expedition was halted on the mountain face. Gravity and terrain claimed the machine.</p>

    <dl>
      <div><dt>Distance Reached</dt><dd id="death-dist">0 m</dd></div>
      <div><dt>Peak Altitude</dt><dd id="death-alt">0 m</dd></div>
      <div><dt>Expedition Score</dt><dd id="death-score">0</dd></div>
      <div><dt>Best Airtime</dt><dd id="death-air">0.0 s</dd></div>
      <div><dt>Flips &amp; Stunts</dt><dd id="death-stunts">0</dd></div>
      <div><dt>Mountain Echoes</dt><dd id="death-echoes">0/6</dd></div>
    </dl>

    <div id="death-lore-box" style="margin-top: 14px; padding: 10px 14px; background: rgba(27,31,29,0.06); border-left: 3px solid #d4622a; font-size: 12px; font-style: italic; display: none; max-height: 110px; overflow-y: auto;"></div>

    <button class="btn" id="death-retry-btn"><span>Retry Expedition</span><span>&rarr;</span></button>
    <button class="btn2" id="death-new-route-btn"><span>New Route (Seed)</span><span>&#9874;</span></button>
    <button class="btn2" id="death-garage-btn"><span>Garage &amp; Tuning</span><span>&#9881;</span></button>
  </div>
</div>

<!-- Vehicle Garage & Suspension Tuning Workshop (Spec #47) -->
<div class="overlay" id="garage-screen" style="display: none;">
  <div class="card" style="width: min(640px, 94vw); max-height: 92vh; overflow-y: auto;">
    <p class="kicker">Engineering Bay &middot; Field Workshop</p>
    <h1 style="font-size: 30px;">Vehicle Garage &amp; Tuning</h1>
    <p class="desc" style="margin-top: 8px;">Select your chassis archetype and calibrate suspension stiffness, damping, tire compound, and differential torque.</p>

    <div class="archetype-picker" id="garage-archetypes">
      <button class="archetype-btn active" data-archetype="buggy">
        <strong>Trail Buggy</strong>
        <span>Mass: 6.8 &middot; Agile</span>
      </button>
      <button class="archetype-btn" data-archetype="crawler">
        <strong>Rock Crawler</strong>
        <span>Mass: 9.8 &middot; High Torque</span>
      </button>
      <button class="archetype-btn" data-archetype="rally">
        <strong>Alpine Rally</strong>
        <span>Mass: 5.8 &middot; High Speed</span>
      </button>
    </div>

    <div class="options-group" style="margin-top: 16px;">
      <label class="option-row">
        <span>Suspension Spring Stiffness (<span id="tune-val-stiff">0.12</span>)</span>
        <input type="range" id="tune-stiff" min="0.06" max="0.24" step="0.01" value="0.12" style="width: 160px; accent-color: #d4622a;" />
      </label>
      <label class="option-row">
        <span>Shock Absorber Damping (<span id="tune-val-damp">0.08</span>)</span>
        <input type="range" id="tune-damp" min="0.02" max="0.18" step="0.005" value="0.08" style="width: 160px; accent-color: #d4622a;" />
      </label>
      <label class="option-row">
        <span>Tire Grip Multiplier (<span id="tune-val-grip">1.00</span>)</span>
        <input type="range" id="tune-grip" min="0.65" max="1.45" step="0.05" value="1.00" style="width: 160px; accent-color: #d4622a;" />
      </label>
      <label class="option-row">
        <span>Engine Torque Output (<span id="tune-val-torque">0.050</span>)</span>
        <input type="range" id="tune-torque" min="0.030" max="0.080" step="0.002" value="0.050" style="width: 160px; accent-color: #d4622a;" />
      </label>
    </div>

    <div style="margin-top: 16px; border-top: 1px solid rgba(27,31,29,0.2); padding-top: 12px;">
      <p class="kicker" style="margin-bottom: 8px;">Discovered Mountain Echoes &amp; Lore</p>
      <div id="garage-echoes-list" style="display: grid; grid-template-columns: 1fr; gap: 6px; max-height: 130px; overflow-y: auto; font-size: 11.5px;"></div>
    </div>

    <button class="btn" id="garage-close-btn"><span>Deploy Tuned Vehicle</span><span>&rarr;</span></button>
  </div>
</div>

<script>
"""

html_tail = """
</script>
</body>
</html>
"""

print("Writing assembly structure...")
