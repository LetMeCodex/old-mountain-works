#!/usr/bin/env python3
"""
tools/terrain_validator.py
--------------------------
Automated procedural terrain validation tool for The Old Mountain Works (Spec Section 58).
Validates continuous Hermite spline curvature, slope limits (max 46.4°), C1 continuity,
landing zones after kicker jumps, and absence of knife-edge discontinuities.
Returns exit code 0 on successful validation, 1 if safety violations are detected.
"""

import sys
import math
import argparse
from typing import List, Dict, Any

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from terrain_analysis import generate_terrain, GRAMMAR_SEQUENCE

def validate_terrain(seed: int, total_length: float = 36000.0, step: float = 18.0) -> Dict[str, Any]:
    samples = generate_terrain(seed, total_length, step)
    n = len(samples)

    violations = []
    max_slope = 0.0
    max_curv = 0.0
    sum_slope = 0.0
    curvatures = []

    # 1. Slope & Discontinuity Audit
    for i in range(n - 1):
        p1 = samples[i]
        p2 = samples[i + 1]
        dx = p2["x"] - p1["x"]
        dy = abs(p2["y"] - p1["y"])
        slope = dy / dx
        slope_deg = math.degrees(math.atan(slope))
        sum_slope += slope_deg

        if slope_deg > max_slope:
            max_slope = slope_deg

        # Section 58 rule: max slope <= 46.4 deg (tan(0.80) rad)
        if slope_deg > 46.5:
            violations.append(f"Excessive slope at x={p1['x']:.0f}: {slope_deg:.2f} deg (> 46.4 deg limit)")

        # Discontinuity / knife-edge check
        if dy > 24.0:
            violations.append(f"Vertical step discontinuity at x={p1['x']:.0f}: dy={dy:.1f}px")

    # 2. Curvature Audit
    for i in range(1, n - 1):
        dx1 = samples[i]["x"] - samples[i-1]["x"]
        dx2 = samples[i+1]["x"] - samples[i]["x"]
        dy1 = (samples[i]["y"] - samples[i-1]["y"]) / dx1
        dy2 = (samples[i+1]["y"] - samples[i]["y"]) / dx2
        d2y = (dy2 - dy1) / ((dx1 + dx2) * 0.5)
        kappa = abs(d2y) / math.pow(1.0 + dy1 * dy1, 1.5)
        curvatures.append(kappa)
        if kappa > max_curv:
            max_curv = kappa

        if kappa > 0.12:
            violations.append(f"Excessive curvature spike at x={samples[i]['x']:.0f}: kappa={kappa:.4f}")

    # 3. Landing Zone Audit for Jump Kickers
    unsafe_jumps = 0
    kicker_indices = []
    # Identify kicker segment regions (where slope changes rapidly from climb to drop)
    for i in range(2, n - 10):
        s_prev = samples[i-1]["slope"]
        s_curr = samples[i]["slope"]
        # Upward launch followed by downward descent
        if s_prev < -0.20 and s_curr > 0.10:
            # Landing zone needs at least 5 samples (~90px) without immediate vertical reversal
            landing_ok = True
            for k in range(i + 1, min(n - 1, i + 8)):
                if abs(samples[k]["slope"]) > 0.95:
                    landing_ok = False
                    break
            if not landing_ok:
                unsafe_jumps += 1
                violations.append(f"Insufficient landing runout after jump at x={samples[i]['x']:.0f}")

    elevations = [s["y"] for s in samples]
    elevation_gain = max(0.0, elevations[0] - min(elevations))
    extreme_sections = sum(1 for s in samples if math.degrees(math.atan(abs(s["slope"]))) > 35.0)
    recovery_zones = sum(1 for s in samples if math.degrees(math.atan(abs(s["slope"]))) < 6.0)

    report = {
        "seed": seed,
        "valid": len(violations) == 0,
        "violations": violations,
        "sampleCount": n,
        "maxSlopeDeg": max_slope,
        "averageSlopeDeg": sum_slope / (n - 1) if n > 1 else 0.0,
        "maxCurvature": max_curv,
        "elevationGainMeters": elevation_gain / 40.0,
        "extremeSections": extreme_sections,
        "unsafeJumps": unsafe_jumps,
        "recoveryZones": recovery_zones,
    }
    return report

def main():
    parser = argparse.ArgumentParser(description="Validate procedural terrain safety and C1 continuity.")
    parser.add_argument("--seed", type=int, default=48192, help="Terrain RNG seed")
    parser.add_argument("--length", type=float, default=36000.0, help="Trail length in pixels")
    args = parser.parse_args()

    res = validate_terrain(args.seed, args.length)

    print("=" * 60)
    print(f" TERRAIN VALIDATION REPORT (Spec #58)")
    print(f" Seed: {res['seed']}")
    print("=" * 60)
    print(f" Maximum slope    : {res['maxSlopeDeg']:.1f} deg")
    print(f" Maximum curvature: {res['maxCurvature']:.5f} 1/px")
    print(f" Average slope    : {res['averageSlopeDeg']:.1f} deg")
    print(f" Extreme sections : {res['extremeSections']}")
    print(f" Unsafe jumps     : {res['unsafeJumps']}")
    print(f" Recovery zones   : {res['recoveryZones']}")
    print(f" Elevation gain   : {res['elevationGainMeters']:.1f} m")
    print("-" * 60)
    
    if res["valid"]:
        print(" STATUS: PASS (0 safety violations detected)")
        print("=" * 60)
        sys.exit(0)
    else:
        print(f" STATUS: FAIL ({len(res['violations'])} violations detected)")
        for v in res["violations"][:10]:
            print(f"  - {v}")
        print("=" * 60)
        sys.exit(1)

if __name__ == "__main__":
    main()
