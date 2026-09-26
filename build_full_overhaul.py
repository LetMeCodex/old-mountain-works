# Full Master Engine + Alpine Expedition Instrument HUD Builder for Old Mountain Works
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

    /* Expedition Instrument Design Tokens */
    --hud-ink: #111513;
    --hud-paper: #efe7d6;
    --hud-muted: rgba(239, 231, 214, 0.50);
    --hud-muted-strong: rgba(239, 231, 214, 0.76);
    --hud-orange: #d4622a;
    --hud-brass: #c8a464;
    --hud-line: rgba(239, 231, 214, 0.16);
    --hud-warning: #e25822;
    --ease-out-quart: cubic-bezier(0.23, 1, 0.32, 1);
    --ease-in-out-quart: cubic-bezier(0.77, 0, 0.175, 1);
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
     MASTER ALPINE EXPEDITION INSTRUMENT HUD
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
  }

  /* Subtle top & bottom atmospheric instrument vignette so white/paper text is crisp over any sky or snow */
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
     A. TOP LEFT — EXPEDITION IDENTITY & EDITORIAL TELEMETRY
     -------------------------------------------------------------------------- */
  #hud-top-left {
    position: absolute;
    top: 22px;
    left: 22px;
    display: flex;
    flex-direction: column;
    gap: 22px;
    z-index: 2;
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
    background: rgba(239, 231, 214, 0.22);
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

  /* Editorial Telemetry Block with Left Scale Ruler */
  .hud-telemetry-wrap {
    position: relative;
    padding-left: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .hud-left-ruler {
    position: absolute;
    left: 0;
    top: 2px;
    bottom: 2px;
    width: 1.5px;
    background: rgba(239, 231, 214, 0.24);
  }
  #hud-left-indicator {
    position: absolute;
    left: -0.5px;
    bottom: 12%;
    width: 2.5px;
    height: 26%;
    background: var(--hud-orange);
    box-shadow: 0 0 8px rgba(212, 98, 42, 0.55);
    transition: bottom 0.18s var(--ease-out-quart), height 0.18s var(--ease-out-quart);
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
  }
  .hud-tel-val.bright {
    color: var(--hud-paper);
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
    background: rgba(17, 21, 19, 0.86);
    padding: 5px 10px;
    border-left: 2.5px solid var(--hud-orange);
    border-top: 1px solid rgba(212, 98, 42, 0.35);
    border-right: 1px solid rgba(212, 98, 42, 0.35);
    border-bottom: 1px solid rgba(212, 98, 42, 0.35);
    margin-top: 4px;
  }

  /* --------------------------------------------------------------------------
     B. TOP CENTER — EXPEDITION ROUTE & SCIENTIFIC TERRAIN SCANNER
     -------------------------------------------------------------------------- */
  #hud-top-center {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: min(420px, 36vw);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
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
  #hud-scanner-svg {
    width: 76%;
    height: 18px;
    overflow: visible;
    opacity: 0.72;
  }

  /* --------------------------------------------------------------------------
     C. TOP RIGHT — ENVIRONMENT TELEMETRY & ANIMATED COMPASS ROSE
     -------------------------------------------------------------------------- */
  #hud-top-right {
    position: absolute;
    top: 18px;
    right: 22px;
    display: flex;
    align-items: center;
    gap: 18px;
    z-index: 2;
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

  /* Compass Rose */
  .hud-compass-wrap {
    width: 58px;
    height: 58px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  #hud-compass-svg {
    width: 58px;
    height: 58px;
    overflow: visible;
  }

  /* --------------------------------------------------------------------------
     D. RIGHT EDGE — VERTICAL ELEVATION / AIRTIME / STUNT INSTRUMENT
     -------------------------------------------------------------------------- */
  #hud-right-column {
    position: absolute;
    right: 18px;
    top: 61%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    gap: 14px;
    z-index: 2;
  }
  .hud-right-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding-top: 28px;
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
    transition: height 0.16s var(--ease-out-quart);
  }
  #hud-stunt-bar-mid {
    width: 100%;
    height: 34%;
    background: rgba(239, 231, 214, 0.18);
  }

  /* --------------------------------------------------------------------------
     E. BOTTOM RIGHT — 4WD DRIVETRAIN & VEHICLE STATUS MODULE
     -------------------------------------------------------------------------- */
  #hud-vehicle-status {
    position: absolute;
    right: 26px;
    bottom: 26px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    z-index: 2;
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
    box-shadow: 0 0 6px var(--hud-orange);
  }
  #hud-wheel-matrix {
    width: 32px;
    height: 14px;
    opacity: 0.65;
  }

  /* --------------------------------------------------------------------------
     F. BOTTOM CENTER — ANALOG SPEEDOMETER, FUEL RESERVE & RPM/TEMP CLUSTER
     -------------------------------------------------------------------------- */
  #hud-gauges-cluster {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: flex-end;
    gap: 28px;
    z-index: 2;
  }
  .hud-sub-dial {
    width: 102px;
    height: 76px;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
  }
  .hud-sub-dial svg {
    width: 102px;
    height: 76px;
    overflow: visible;
  }
  .hud-hero-dial {
    width: 168px;
    height: 158px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .hud-hero-dial svg {
    width: 168px;
    height: 168px;
    overflow: visible;
  }
  .hud-speed-center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-top: 20px;
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
    margin-top: 8px;
    font-size: 7.5px;
    letter-spacing: 0.28em;
    color: var(--hud-muted);
    text-transform: uppercase;
  }
  .hud-speed-rule {
    margin-top: 11px;
    width: 24px;
    height: 1px;
    background: rgba(239, 231, 214, 0.30);
  }

  /* --------------------------------------------------------------------------
     G. BOTTOM LEFT — MECHANICAL SVG PEDAL CONTROLS (BRAKE | ACCELERATE)
     -------------------------------------------------------------------------- */
  #pedals {
    position: fixed;
    bottom: 26px;
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
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: 1px solid rgba(239, 231, 214, 0.26);
    background: rgba(18, 22, 20, 0.48);
    color: var(--hud-paper);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    touch-action: none;
    padding: 0;
    outline: none;
    position: relative;
    transition: border-color 0.14s var(--ease-out-quart), background-color 0.14s var(--ease-out-quart);
  }
  #pedals button::after {
    content: "";
    position: absolute;
    inset: 3px;
    border-radius: 50%;
    border: 1px solid rgba(239, 231, 214, 0.14);
    pointer-events: none;
    transition: border-color 0.14s var(--ease-out-quart);
  }
  #pedals button svg {
    width: 22px;
    height: 22px;
    stroke: var(--hud-paper);
    stroke-width: 1.5;
    fill: none;
    transition: stroke 0.14s var(--ease-out-quart), transform 0.14s var(--ease-out-quart);
  }
  #pedals button.pressed {
    border-color: var(--hud-orange);
    background: rgba(212, 98, 42, 0.16);
  }
  #pedals button.pressed::after {
    border-color: rgba(212, 98, 42, 0.55);
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
  }

  /* Floating Stunt Telemetry Notification Toasts */
  #hud-stunt {
    position: fixed;
    top: 90px;
    right: 24px;
    pointer-events: none;
    z-index: 6;
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-end;
  }
  .stunt-toast {
    background: rgba(17, 21, 19, 0.88);
    border: 1px solid rgba(239, 231, 214, 0.25);
    border-left: 3px solid var(--hud-orange);
    padding: 6px 14px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 10.5px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--hud-paper);
    animation: toastIn 0.24s var(--ease-out-quart) forwards;
    transition: opacity 0.25s var(--ease-out-quart), transform 0.25s var(--ease-out-quart);
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
  @keyframes toastIn {
    from { opacity: 0; transform: translateX(18px) scale(0.96); }
    to { opacity: 1; transform: translateX(0) scale(1); }
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

  /* Responsive Layout Rules (1366x768, 16:10, 21:9, Mobile Landscape) */
  @media (max-width: 1100px), (max-height: 700px) {
    #hud-top-center { width: min(300px, 32vw); }
    .hud-hero-dial { width: 138px; height: 130px; }
    .hud-hero-dial svg { width: 138px; height: 138px; }
    #hud-speed-big { font-size: 32px; }
    .hud-sub-dial { width: 84px; height: 64px; }
    .hud-sub-dial svg { width: 84px; height: 64px; }
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

<!-- ==========================================================================
     THE OLD MOUNTAIN WORKS — EXPEDITION INSTRUMENT HUD SYSTEM
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

  <!-- A. TOP LEFT: EXPEDITION IDENTITY & PRIMARY TELEMETRY -->
  <div id="hud-top-left">
    <div class="hud-identity" id="hud-identity-block">
      <!-- Precision Faceted Twin-Peak Mountain Emblem SVG -->
      <svg id="hud-emblem-svg" viewBox="0 0 64 40" aria-hidden="true">
        <!-- Left Peak -->
        <polygon class="emblem-face" points="4,36 22,8 28,36" fill="rgba(239,231,214,0.88)" />
        <polygon class="emblem-face-dark" points="22,8 34,28 28,36" fill="rgba(239,231,214,0.38)" />
        <!-- Main Right Peak -->
        <polygon class="emblem-face" points="20,36 40,3 46,36" fill="rgba(239,231,214,0.95)" />
        <polygon class="emblem-face-dark" points="40,3 60,36 46,36" fill="rgba(239,231,214,0.46)" />
        <!-- Inner Ridge Contour Lines -->
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
      <div class="hud-left-ruler">
        <div id="hud-left-indicator"></div>
      </div>
      <div class="hud-telemetry-grid">
        <span class="hud-tel-label">DIST</span>
        <span id="hud-dist" class="hud-tel-val mono">0 m</span>

        <span class="hud-tel-label bright">SPEED</span>
        <span id="hud-speed" class="hud-tel-val bright mono">0 km/h</span>

        <span class="hud-tel-label">ALT</span>
        <span id="hud-alt" class="hud-tel-val mono">0 m</span>

        <span class="hud-tel-label">INCLINE</span>
        <span id="hud-incline" class="hud-tel-val mono">0°</span>

        <span class="hud-tel-label">ECHOES</span>
        <span id="hud-echoes" class="hud-tel-val mono">0/6</span>

        <span class="hud-tel-label">ZONE</span>
        <span id="hud-zone" class="hud-tel-val mono">ALPINE MEADOW</span>

        <span class="hud-tel-label">SCORE</span>
        <span id="hud-score" class="hud-tel-val mono">0</span>

        <span class="hud-tel-label">VEHICLE</span>
        <span id="hud-vehicle" class="hud-tel-val mono">TRAIL BUGGY</span>
      </div>
      <div class="rpm"><i id="hud-rpm"></i></div>
      <div id="hud-air"></div>
      <div id="hud-combo"></div>
      <div id="hud-warning">WARNING: INVERTED! RECOVERY: <span id="hud-warning-timer">1.8s</span></div>
    </div>
  </div>

  <!-- B. TOP CENTER: EXPEDITION ROUTE & DYNAMIC TERRAIN PROFILE SCANNER -->
  <div id="hud-top-center">
    <div class="hud-route-header">
      <span>BASE CAMP</span>
      <span id="hud-route-sector-tag">ROUTE // ALPINE MEADOW</span>
      <span>SUMMIT</span>
    </div>
    <!-- Mountain Ridge Expedition Progression SVG -->
    <svg id="hud-route-svg" viewBox="0 0 400 26">
      <!-- Baseline Ridge Track -->
      <path id="hud-route-track" d="M 8,20 L 55,18 L 95,12 L 135,16 L 185,9 L 235,14 L 285,6 L 335,11 L 392,3" fill="none" stroke="rgba(239,231,214,0.20)" stroke-width="1.2" />
      <!-- Active Illuminated Route Progress -->
      <path id="hud-route-progress" d="M 8,20 L 55,18 L 95,12 L 135,16 L 185,9 L 235,14 L 285,6 L 335,11 L 392,3" fill="none" stroke="#efe7d6" stroke-width="1.6" stroke-dasharray="400" stroke-dashoffset="400" />
      <!-- Sector Landmark Ticks -->
      <g fill="rgba(239,231,214,0.45)">
        <circle cx="8" cy="20" r="2" />
        <circle cx="95" cy="12" r="1.8" />
        <circle cx="185" cy="9" r="1.8" />
        <circle cx="285" cy="6" r="1.8" />
        <circle cx="392" cy="3" r="2.2" stroke="#d4622a" stroke-width="1" fill="none" />
      </g>
      <!-- Live Vehicle Beacon on Route -->
      <g id="hud-route-beacon" transform="translate(8, 20)">
        <circle r="4.5" fill="rgba(212,98,42,0.28)" />
        <circle r="2.2" fill="#d4622a" />
      </g>
    </svg>
    <!-- Live Scientific Terrain Profile Scanner Ahead of Vehicle -->
    <svg id="hud-scanner-svg" viewBox="0 0 300 18">
      <line x1="0" y1="16" x2="300" y2="16" stroke="rgba(239,231,214,0.10)" stroke-width="0.75" stroke-dasharray="2 3" />
      <path id="hud-scanner-line" d="M 0,12 L 300,12" fill="none" stroke="rgba(239,231,214,0.42)" stroke-width="1.15" />
      <circle id="hud-scanner-car" cx="32" cy="12" r="2" fill="#d4622a" />
    </svg>
  </div>

  <!-- C. TOP RIGHT: ENVIRONMENT TELEMETRY & COMPASS ROSE -->
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

    <!-- Precision Animated SVG Compass Rose -->
    <div class="hud-compass-wrap">
      <svg id="hud-compass-svg" viewBox="0 0 64 64">
        <!-- Outer Compass Ring & Ticks -->
        <circle cx="32" cy="32" r="22" fill="none" stroke="rgba(239,231,214,0.28)" stroke-width="1" />
        <g stroke="rgba(239,231,214,0.25)" stroke-width="0.8">
          <line x1="32" y1="8" x2="32" y2="11" />
          <line x1="32" y1="53" x2="32" y2="56" />
          <line x1="8" y1="32" x2="11" y2="32" />
          <line x1="53" y1="32" x2="56" y2="32" />
          <line x1="16.4" y1="16.4" x2="18.2" y2="18.2" />
          <line x1="47.6" y1="16.4" x2="45.8" y2="18.2" />
          <line x1="16.4" y1="47.6" x2="18.2" y2="45.8" />
          <line x1="47.6" y1="47.6" x2="45.8" y2="45.8" />
        </g>
        <!-- Cardinal Labels -->
        <text x="32" y="6" text-anchor="middle" fill="rgba(239,231,214,0.65)" font-size="5.5" font-family="Courier New, monospace">N</text>
        <text x="32" y="62.5" text-anchor="middle" fill="rgba(239,231,214,0.5)" font-size="5.5" font-family="Courier New, monospace">S</text>
        <text x="4.5" y="34" text-anchor="middle" fill="rgba(239,231,214,0.5)" font-size="5.5" font-family="Courier New, monospace">W</text>
        <text x="59.5" y="34" text-anchor="middle" fill="rgba(239,231,214,0.5)" font-size="5.5" font-family="Courier New, monospace">E</text>
        <!-- Rotating Diamond Needle -->
        <g id="hud-compass-needle" transform="rotate(0 32 32)">
          <!-- North Pointer (Burnt Orange) -->
          <polygon points="32,14 35.8,32 28.2,32" fill="#d4622a" stroke="#efe7d6" stroke-width="0.5" />
          <!-- South Pointer (Warm Paper Hollow/Muted) -->
          <polygon points="32,50 35.8,32 28.2,32" fill="rgba(239,231,214,0.22)" stroke="#efe7d6" stroke-width="0.6" />
          <circle cx="32" cy="32" r="1.6" fill="#111513" stroke="#efe7d6" stroke-width="0.7" />
        </g>
      </svg>
    </div>
  </div>

  <!-- D. RIGHT COLUMN: ELEVATION / AIRTIME / STUNT INSTRUMENT -->
  <div id="hud-right-column">
    <div class="hud-right-text" id="hud-right-labels">
      <span class="lead" id="hud-right-line1">HIGHER</span>
      <span id="hud-right-line2">TERRAIN</span>
      <span id="hud-right-line3">BIGGER</span>
      <span id="hud-right-line4">STORIES</span>
      <div class="hud-right-dash"></div>
    </div>
    <div class="hud-vertical-bar">
      <div id="hud-stunt-bar-top"></div>
      <div id="hud-stunt-bar-mid"></div>
    </div>
  </div>

  <!-- E. BOTTOM RIGHT: 4WD VEHICLE STATUS & DRIVETRAIN MATRIX -->
  <div id="hud-vehicle-status">
    <svg id="hud-4wd-emblem" viewBox="0 0 36 20">
      <polyline points="2,18 13,4 19,13 25,3 34,18" fill="none" stroke="#efe7d6" stroke-width="1.3" stroke-linejoin="round" />
      <polyline points="8,18 13,10 17,18" fill="none" stroke="rgba(239,231,214,0.45)" stroke-width="1" />
      <polyline points="20,18 25,9 30,18" fill="none" stroke="rgba(239,231,214,0.45)" stroke-width="1" />
    </svg>
    <div id="hud-drivetrain-mode">4WD</div>
    <div id="hud-drivetrain-dot"></div>
    <svg id="hud-wheel-matrix" viewBox="0 0 36 16">
      <line x1="9" y1="4" x2="27" y2="4" stroke="rgba(239,231,214,0.28)" stroke-width="1" stroke-dasharray="2 2" />
      <line x1="9" y1="12" x2="27" y2="12" stroke="rgba(239,231,214,0.28)" stroke-width="1" stroke-dasharray="2 2" />
      <line x1="18" y1="4" x2="18" y2="12" stroke="rgba(239,231,214,0.28)" stroke-width="1" />
      <circle id="hud-wheel-rl" cx="7" cy="4" r="2.2" fill="#efe7d6" />
      <circle id="hud-wheel-fr" cx="29" cy="4" r="2.2" fill="#efe7d6" />
      <circle id="hud-wheel-rr" cx="7" cy="12" r="2.2" fill="#efe7d6" />
      <circle id="hud-wheel-fl" cx="29" cy="12" r="2.2" fill="#efe7d6" />
    </svg>
  </div>

  <!-- F. BOTTOM CENTER: 3-DIAL ANALOG INSTRUMENT CLUSTER -->
  <div id="hud-gauges-cluster">
    <!-- 1. LEFT SUB-DIAL: FUEL / EXPEDITION RESERVE GAUGE (E -> F) -->
    <div class="hud-sub-dial" id="hud-fuel-gauge">
      <svg viewBox="0 0 110 82">
        <!-- Outer Tick Ring -->
        <path d="M 14,62 A 42,42 0 0,1 96,62" fill="none" stroke="rgba(239,231,214,0.16)" stroke-width="3.2" />
        <!-- Burnt-Orange Active Fuel Arc -->
        <path id="hud-fuel-arc" d="M 14,62 A 42,42 0 0,1 96,62" fill="none" stroke="#d4622a" stroke-width="2.6" stroke-dasharray="132" stroke-dashoffset="35" />
        <!-- Radial Tick Marks -->
        <g stroke="rgba(239,231,214,0.42)" stroke-width="1">
          <line x1="14" y1="62" x2="19" y2="62" />
          <line x1="19" y1="41" x2="23" y2="43" />
          <line x1="34" y1="25" x2="37" y2="29" />
          <line x1="55" y1="20" x2="55" y2="25" />
          <line x1="76" y1="25" x2="73" y2="29" />
          <line x1="91" y1="41" x2="87" y2="43" />
          <line x1="96" y1="62" x2="91" y2="62" />
        </g>
        <!-- E & F Labels -->
        <text x="11" y="74" text-anchor="middle" fill="rgba(239,231,214,0.55)" font-size="7.5" font-family="Courier New, monospace">E</text>
        <text x="99" y="74" text-anchor="middle" fill="rgba(239,231,214,0.55)" font-size="7.5" font-family="Courier New, monospace">F</text>
        <!-- Fuel Pump Icon -->
        <g transform="translate(47, 46)" stroke="#efe7d6" stroke-width="1.2" fill="none">
          <rect x="2" y="2" width="9" height="13" rx="1" fill="rgba(239,231,214,0.88)" stroke="none" />
          <rect x="3.5" y="3.8" width="6" height="4.2" fill="#111513" stroke="none" />
          <path d="M11,5 L14,7.5 L14,13.5 A1.5,1.5 0 0,1 11,13.5" stroke="#efe7d6" stroke-width="1.2" />
          <line x1="1" y1="15" x2="12" y2="15" stroke="#efe7d6" stroke-width="1.4" />
        </g>
        <!-- Subtle Rotating Reserve Needle -->
        <g id="hud-fuel-needle" transform="rotate(42 55 62)">
          <line x1="55" y1="26" x2="55" y2="18" stroke="#efe7d6" stroke-width="1.5" stroke-linecap="round" />
        </g>
        <text id="hud-fuel-low" x="55" y="76" text-anchor="middle" fill="#d4622a" font-size="6.5" font-family="Courier New, monospace" letter-spacing="1.5" opacity="0">LOW</text>
      </svg>
    </div>

    <!-- 2. CENTER HERO DIAL: PRECISION ANALOG SPEEDOMETER -->
    <div class="hud-hero-dial" id="hud-speedometer">
      <svg viewBox="0 0 200 200">
        <!-- Thin Outer Technical Bezel Ring -->
        <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(239,231,214,0.24)" stroke-width="1" />
        <!-- Lower Tapered Bezel Continuation Arcs -->
        <path d="M 30.7,140 A 80,80 0 0,0 60,169.3" fill="none" stroke="rgba(239,231,214,0.22)" stroke-width="3.8" />
        <path d="M 169.3,140 A 80,80 0 0,1 140,169.3" fill="none" stroke="rgba(239,231,214,0.22)" stroke-width="3.8" />
        <!-- Background Inner Track Arc (240 deg sweep from 150 deg to 390 deg) -->
        <path d="M 30.7,140 A 80,80 0 1,1 169.3,140" fill="none" stroke="rgba(239,231,214,0.26)" stroke-width="4.5" stroke-linecap="butt" />
        <!-- High-Speed Burnt-Orange Zone Arc (Right Side) -->
        <path id="hud-speed-orange-zone" d="M 148,36 A 80,80 0 0,1 169.3,140" fill="none" stroke="#d4622a" stroke-width="4.5" opacity="0.92" />
        <!-- Live Speed Illuminated Arc (Warm Paper) -->
        <path id="hud-speed-arc" d="M 30.7,140 A 80,80 0 1,1 169.3,140" fill="none" stroke="#efe7d6" stroke-width="4.5" stroke-dasharray="335" stroke-dashoffset="248" />
        <!-- Fine Radial Ticks -->
        <g stroke="rgba(239,231,214,0.35)" stroke-width="1">
          <line x1="25" y1="143" x2="30" y2="140" />
          <line x1="16" y1="100" x2="22" y2="100" />
          <line x1="37" y1="47" x2="42" y2="51" />
          <line x1="78" y1="20" x2="80" y2="26" />
          <line x1="122" y1="20" x2="120" y2="26" />
          <line x1="163" y1="47" x2="158" y2="51" stroke="#d4622a" />
          <line x1="184" y1="100" x2="178" y2="100" stroke="#d4622a" />
          <line x1="175" y1="143" x2="170" y2="140" stroke="#d4622a" />
        </g>
        <!-- Analog Needle Indicator -->
        <g id="hud-speed-needle" transform="rotate(-70 100 100)">
          <line x1="100" y1="29" x2="100" y2="18" stroke="#efe7d6" stroke-width="1.8" stroke-linecap="round" />
        </g>
      </svg>
      <div class="hud-speed-center">
        <div id="hud-speed-big">0</div>
        <div class="hud-speed-unit">KM/H</div>
        <div class="hud-speed-rule"></div>
      </div>
    </div>

    <!-- 3. RIGHT SUB-DIAL: ENGINE RPM & THERMAL GAUGE (C -> H) -->
    <div class="hud-sub-dial" id="hud-rpm-gauge">
      <svg viewBox="0 0 110 82">
        <!-- Outer Tick Ring -->
        <path d="M 14,62 A 42,42 0 0,1 96,62" fill="none" stroke="rgba(239,231,214,0.16)" stroke-width="3.2" />
        <!-- Right-Side Redline Zone -->
        <path d="M 88,38 A 42,42 0 0,1 96,62" fill="none" stroke="#d4622a" stroke-width="3.2" opacity="0.92" />
        <!-- Live RPM/Thermal Arc -->
        <path id="hud-rpm-arc" d="M 14,62 A 42,42 0 0,1 96,62" fill="none" stroke="rgba(239,231,214,0.28)" stroke-width="2.6" stroke-dasharray="132" stroke-dashoffset="105" />
        <!-- Radial Tick Marks -->
        <g stroke="rgba(239,231,214,0.42)" stroke-width="1">
          <line x1="14" y1="62" x2="19" y2="62" />
          <line x1="19" y1="41" x2="23" y2="43" />
          <line x1="34" y1="25" x2="37" y2="29" />
          <line x1="55" y1="20" x2="55" y2="25" />
          <line x1="76" y1="25" x2="73" y2="29" />
          <line x1="91" y1="41" x2="87" y2="43" stroke="#d4622a" />
          <line x1="96" y1="62" x2="91" y2="62" stroke="#d4622a" />
        </g>
        <!-- C & H Labels -->
        <text x="11" y="74" text-anchor="middle" fill="rgba(239,231,214,0.55)" font-size="7.5" font-family="Courier New, monospace">C</text>
        <text x="99" y="74" text-anchor="middle" fill="rgba(239,231,214,0.55)" font-size="7.5" font-family="Courier New, monospace">H</text>
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
        <!-- Rotating RPM/Thermal Needle -->
        <g id="hud-rpm-needle" transform="rotate(-48 55 62)">
          <line x1="55" y1="26" x2="55" y2="18" stroke="#efe7d6" stroke-width="1.5" stroke-linecap="round" />
        </g>
        <text id="hud-rpm-readout" x="55" y="76" text-anchor="middle" fill="rgba(239,231,214,0.45)" font-size="6" font-family="Courier New, monospace" letter-spacing="1" opacity="0">RPM x1000</text>
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

<!-- G. BOTTOM LEFT: MECHANICAL SVG PEDAL CONTROLS -->
<div id="pedals">
  <div class="pedal-unit">
    <button id="pedal-l" aria-label="Reverse / brake">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <polyline points="7,8 12,13 17,8" />
        <polyline points="7,12.5 12,17.5 17,12.5" />
      </svg>
    </button>
    <span class="pedal-label">BRAKE</span>
  </div>
  <div class="pedal-divider"></div>
  <div class="pedal-unit">
    <button id="pedal-r" aria-label="Throttle">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <polyline points="7,15.5 12,10.5 17,15.5" />
        <polyline points="7,11 12,6 17,11" />
      </svg>
    </button>
    <span class="pedal-label">ACCELERATE</span>
  </div>
</div>

<!-- Title & Expedition Launch Overlay -->
<div class="overlay" id="title">
  <div class="card">
    <p class="kicker">Field Expedition &middot; Physics Master</p>
    <h1>The Old<br/>Mountain Works</h1>
    <p class="desc">A handcrafted physical mountain expedition across changing alpine biomes. Negotiate terrain, momentum, suspension, articulated driver balance and gravity &mdash; simulated in real time with zero canned animation.</p>
    
    <div class="archetype-picker">
      <button class="archetype-btn active" data-archetype="buggy">
        <strong>Trail Buggy</strong>
        <span>Balanced &middot; Agile</span>
      </button>
      <button class="archetype-btn" data-archetype="crawler">
        <strong>Crawler</strong>
        <span>Heavy &middot; High Grip</span>
      </button>
      <button class="archetype-btn" data-archetype="rally">
        <strong>Alpine Rally</strong>
        <span>Light &middot; Air Pitch</span>
      </button>
    </div>

    <dl>
      <div><dt>Throttle / Air Backflip</dt><dd>D / &#8594; / W</dd></div>
      <div><dt>Brake / Air Frontflip</dt><dd>A / &#8592; / S</dd></div>
      <div><dt>Restart Run</dt><dd>R</dd></div>
      <div><dt>Expedition Pause</dt><dd>ESC</dd></div>
      <div><dt>Live Telemetry</dt><dd>F3</dd></div>
      <div><dt>Best Career Run</dt><dd id="title-best-dist">0 m</dd></div>
    </dl>
    <button class="btn" id="start-btn"><span>Start Expedition</span><span class="mono">&#8594;</span></button>
  </div>
</div>

<!-- Pause & Options Overlay -->
<div class="overlay" id="pause">
  <div class="card" style="width: min(480px, 92vw);">
    <p class="kicker">Expedition Instrument Panel &middot; Halted</p>
    <dl style="margin-top: 10px; margin-bottom: 14px;">
      <div><dt>Current Run</dt><dd id="recap-dist">0 m</dd></div>
      <div><dt>Peak Altitude</dt><dd id="recap-alt">0 m</dd></div>
      <div><dt>Run Score</dt><dd id="recap-score">0</dd></div>
      <div><dt>Best Airtime</dt><dd id="recap-air">0.0 s</dd></div>
      <div><dt>Peak Combo</dt><dd id="recap-combo">x1</dd></div>
      <div><dt>Career Record</dt><dd id="recap-best">0 m</dd></div>
    </dl>

    <div class="archetype-picker" style="margin-bottom: 14px;">
      <button class="archetype-btn" data-archetype="buggy">
        <strong>Trail Buggy</strong>
      </button>
      <button class="archetype-btn" data-archetype="crawler">
        <strong>Crawler</strong>
      </button>
      <button class="archetype-btn" data-archetype="rally">
        <strong>Alpine Rally</strong>
      </button>
    </div>

    <button class="btn2" id="resume-btn"><span>Resume Expedition</span><span class="mono">&#9654;</span></button>
    <button class="btn2" id="restart-btn"><span>Restart Run</span><span class="mono">&#8635;</span></button>
    <button class="btn2" id="seed-btn"><span>New Terrain Seed</span><span class="mono">&#9874;</span></button>
    
    <div class="options-group">
      <label class="option-row">
        <span>Screen Shake Feedback</span>
        <input type="checkbox" id="opt-shake" checked />
      </label>
      <label class="option-row">
        <span>Reduced Motion Mode</span>
        <input type="checkbox" id="opt-motion" />
      </label>
      <label class="option-row">
        <span>Mute Audio</span>
        <input type="checkbox" id="opt-mute" />
      </label>
    </div>
  </div>
</div>

<!-- Expedition Death Debrief Screen Overlay (Spec #46) -->
<div class="overlay" id="death-screen" style="display: none; z-index: 12;">
  <div class="card" style="width: min(560px, 92vw);">
    <p class="kicker" style="color: var(--hot);">Expedition Terminated &middot; Vehicle Wrecked</p>
    <h1 id="death-cause" style="font-size: 32px; margin-top: 4px;">Structural Failure</h1>
    <p class="desc" id="death-desc">The expedition was halted on the mountain face. Gravity and terrain claimed the machine.</p>
    
    <dl style="margin-top: 14px; margin-bottom: 16px;">
      <div><dt>Distance Reached</dt><dd id="death-dist">0 m</dd></div>
      <div><dt>Peak Altitude</dt><dd id="death-alt">0 m</dd></div>
      <div><dt>Expedition Score</dt><dd id="death-score">0</dd></div>
      <div><dt>Best Airtime</dt><dd id="death-air">0.0 s</dd></div>
      <div><dt>Flips & Stunts</dt><dd id="death-stunts">0</dd></div>
      <div><dt>Mountain Echoes</dt><dd id="death-echoes">0/6</dd></div>
    </dl>

    <div id="death-lore-box" style="display:none; background: rgba(27,31,29,0.06); padding: 10px 14px; border-left: 4px solid var(--hot); margin-bottom: 14px; font-size: 12px; font-style: italic; max-height: 130px; overflow-y: auto;">
      <!-- Echo lore notes -->
    </div>

    <button class="btn" id="death-retry-btn"><span>Retry Expedition</span><span class="mono">&#8594;</span></button>
    <button class="btn2" id="death-new-route-btn"><span>New Route (Seed)</span><span class="mono">&#9874;</span></button>
    <button class="btn2" id="death-garage-btn"><span>Garage & Tuning</span><span class="mono">&#9881;</span></button>
  </div>
</div>

<!-- Vehicle Garage & Tuning Workshop Overlay (Spec #11) -->
<div class="overlay" id="garage-screen" style="display: none; z-index: 11;">
  <div class="card" style="width: min(620px, 94vw); max-height: 90vh; overflow-y: auto;">
    <p class="kicker">Field Engineering &middot; Tuning Workshop</p>
    <h1 style="font-size: 34px;">Vehicle Garage</h1>
    <p class="desc">Fine-tune suspension stiffness, shock damping, tire tread grip and power output for optimal mountain ascents.</p>

    <div class="archetype-picker" style="margin-top: 14px; margin-bottom: 16px;">
      <button class="archetype-btn active" data-archetype="buggy">
        <strong>Trail Buggy</strong>
        <span>Balanced &middot; Agile</span>
      </button>
      <button class="archetype-btn" data-archetype="crawler">
        <strong>Crawler</strong>
        <span>Heavy &middot; High Grip</span>
      </button>
      <button class="archetype-btn" data-archetype="rally">
        <strong>Alpine Rally</strong>
        <span>Light &middot; Fast</span>
      </button>
    </div>

    <div class="tuning-sliders" style="display: flex; flex-direction: column; gap: 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;">
      <div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Suspension Stiffness (k)</span>
          <span id="tune-val-stiff" class="mono">0.12</span>
        </div>
        <input type="range" id="tune-stiff" min="0.06" max="0.24" step="0.01" value="0.12" style="width: 100%; accent-color: var(--hot);" />
      </div>
      <div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Suspension Damping (c)</span>
          <span id="tune-val-damp" class="mono">0.065</span>
        </div>
        <input type="range" id="tune-damp" min="0.02" max="0.15" step="0.005" value="0.065" style="width: 100%; accent-color: var(--hot);" />
      </div>
      <div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Tire Tread Grip (&mu;)</span>
          <span id="tune-val-grip" class="mono">0.94</span>
        </div>
        <input type="range" id="tune-grip" min="0.70" max="1.50" step="0.02" value="0.94" style="width: 100%; accent-color: var(--hot);" />
      </div>
      <div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Engine Torque</span>
          <span id="tune-val-torque" class="mono">0.050</span>
        </div>
        <input type="range" id="tune-torque" min="0.03" max="0.10" step="0.005" value="0.050" style="width: 100%; accent-color: var(--hot);" />
      </div>
    </div>

    <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.2em; margin-top: 18px; margin-bottom: 8px; border-bottom: 1px solid rgba(27,31,29,0.2); padding-bottom: 4px;">Mountain Echoes Archive</h3>
    <div id="garage-echoes-list" style="max-height: 140px; overflow-y: auto; font-size: 12px; display: flex; flex-direction: column; gap: 6px;">
      <!-- Echo archive entries -->
    </div>

    <button class="btn" id="garage-close-btn" style="margin-top: 16px;"><span>Apply & Return</span><span class="mono">&#8594;</span></button>
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
