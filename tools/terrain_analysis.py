#!/usr/bin/env python3
"""
tools/terrain_analysis.py
-------------------------
Offline procedural terrain analysis tool for The Old Mountain Works.
Evaluates continuous Hermite spline curvature, slope distribution, elevation profile,
and detects extreme sections or discontinuities across generated seeds.
"""

import sys
import math
import argparse
from typing import List, Dict, Tuple

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def pseudo_noise(seed: int):
    def l_noise(k: float) -> float:
        f = math.sin(k * 127.1 + seed * 311.7) * 43758.5453123
        return f - math.floor(f)
    
    def smooth(t: float) -> float:
        return t * t * (3.0 - 2.0 * t)
    
    def sample(x: float) -> float:
        i = math.floor(x)
        f = x - i
        return l_noise(i) * (1.0 - smooth(f)) + l_noise(i + 1.0) * smooth(f)
    
    return sample

GRAMMAR_SEQUENCE = [
    {"name": "Gentle Rollers", "type": "rollers", "dx": 600, "dy": -20, "exitSlope": 0.05, "material": "grass"},
    {"name": "Steady Climb", "type": "climb", "dx": 700, "dy": -140, "exitSlope": -0.32, "material": "grass"},
    {"name": "First Kicker Jump", "type": "kicker", "dx": 750, "dy": -40, "exitSlope": 0.15, "material": "dirt"},
    {"name": "Deep Valley Bowl", "type": "bowl", "dx": 650, "dy": 60, "exitSlope": -0.25, "material": "dirt"},
    {"name": "Camelback Double", "type": "camelback", "dx": 700, "dy": -50, "exitSlope": 0.0, "material": "grass"},
    {"name": "Base Camp Plateau", "type": "plateau", "dx": 550, "dy": -10, "exitSlope": 0.0, "material": "grass"},
    {"name": "Stone Ridge Ascent", "type": "climb", "dx": 800, "dy": -210, "exitSlope": -0.42, "material": "rock"},
    {"name": "Crag Crest Drop", "type": "crest", "dx": 650, "dy": 70, "exitSlope": 0.28, "material": "rock"},
    {"name": "Ridge Launch Kicker", "type": "kicker", "dx": 800, "dy": -60, "exitSlope": 0.18, "material": "rock"},
    {"name": "Technical Moguls", "type": "scramble", "dx": 700, "dy": -80, "exitSlope": -0.15, "material": "gravel"},
    {"name": "High Crag Plateau", "type": "plateau", "dx": 600, "dy": -15, "exitSlope": 0.0, "material": "rock"},
    {"name": "Canyon Gorge Descent", "type": "descent", "dx": 750, "dy": 160, "exitSlope": 0.38, "material": "dirt"},
    {"name": "Old Trestle Chasm Jump", "type": "chasm", "dx": 850, "dy": -30, "exitSlope": 0.10, "material": "wood"},
    {"name": "Canyon Cliff Run", "type": "rollers", "dx": 700, "dy": -90, "exitSlope": -0.22, "material": "dirt"},
    {"name": "Mine Pithead Approach", "type": "climb", "dx": 750, "dy": -180, "exitSlope": -0.35, "material": "gravel"},
    {"name": "Slag Heap Kicker", "type": "kicker", "dx": 800, "dy": -50, "exitSlope": 0.20, "material": "gravel"},
    {"name": "Industrial Works Plateau", "type": "plateau", "dx": 650, "dy": -20, "exitSlope": 0.0, "material": "gravel"},
    {"name": "Summit Ridge Climb", "type": "climb", "dx": 850, "dy": -260, "exitSlope": -0.45, "material": "snow"},
    {"name": "Glacier Bowl", "type": "bowl", "dx": 700, "dy": 80, "exitSlope": -0.28, "material": "ice"},
    {"name": "Summit Observatory Kicker", "type": "kicker", "dx": 900, "dy": -70, "exitSlope": 0.15, "material": "snow"},
    {"name": "Summit Panoramic Plateau", "type": "plateau", "dx": 800, "dy": -10, "exitSlope": 0.0, "material": "snow"},
]

def generate_terrain(seed: int, total_length: float = 36000.0, step: float = 18.0) -> List[Dict[str, float]]:
    ground_base = 580.0
    start_x = 220.0
    n_swell = pseudo_noise(seed + 11)
    n_detail = pseudo_noise(seed + 89)

    samples = []
    # Starting apron
    q = -500.0
    while q < start_x + 350.0:
        samples.append({"x": q, "y": ground_base, "slope": 0.0})
        q += step

    cur_x = start_x + 350.0
    cur_y = ground_base
    cur_slope = 0.0
    seq_idx = 0

    while cur_x < total_length:
        tmpl = GRAMMAR_SEQUENCE[seq_idx % len(GRAMMAR_SEQUENCE)]
        seq_idx += 1

        dist_meters = max(0.0, (cur_x - start_x) / 40.0)
        difficulty = min(1.0, max(0.0, dist_meters / 1000.0))

        seg_len = tmpl["dx"] * (0.9 + abs(n_swell(cur_x / 900.0)) * 0.25)
        seg_dy = tmpl["dy"] * (1.0 + difficulty * 0.35)
        target_slope = tmpl["exitSlope"] * (1.0 + difficulty * 0.25)

        x0, y0, m0 = cur_x, cur_y, cur_slope
        x1 = cur_x + seg_len
        y1 = cur_y + seg_dy
        m1 = target_slope

        L = x1 - x0
        q = x0 + step
        while q <= x1:
            u = (q - x0) / L
            u2 = u * u
            u3 = u2 * u

            h00 = 2.0 * u3 - 3.0 * u2 + 1.0
            h10 = u3 - 2.0 * u2 + u
            h01 = -2.0 * u3 + 3.0 * u2
            h11 = u3 - u2

            y = h00 * y0 + h10 * L * m0 + h01 * y1 + h11 * L * m1

            # Micro-features
            if tmpl["type"] in ("rollers", "camelback"):
                y += math.sin(u * math.pi * 4.0) * (14.0 + difficulty * 8.0)
            elif tmpl["type"] == "kicker":
                if u < 0.45:
                    y -= math.sin(u / 0.45 * math.pi * 0.5) * (26.0 + difficulty * 16.0)
                else:
                    y += math.sin((u - 0.45) / 0.55 * math.pi) * (16.0 + difficulty * 10.0)
            elif tmpl["type"] == "scramble":
                y += n_detail(q / 60.0) * (10.0 + difficulty * 6.0)

            # Safety clamp: max slope ~ 46 degrees (0.80 rad)
            prev = samples[-1]
            dx = q - prev["x"]
            dy = y - prev["y"]
            max_dy = dx * math.tan(0.80)
            if abs(dy) > max_dy:
                y = prev["y"] + math.copysign(max_dy, dy)

            actual_slope = (y - prev["y"]) / dx
            samples.append({"x": q, "y": y, "slope": actual_slope})
            q += step

        cur_x = x1
        cur_y = samples[-1]["y"]
        cur_slope = samples[-1]["slope"]

    return samples

def analyze_terrain(samples: List[Dict[str, float]], seed: int):
    n = len(samples)
    if n < 2:
        print("Error: insufficient samples")
        return

    slopes = [s["slope"] for s in samples]
    abs_slopes_deg = [math.degrees(math.atan(abs(s))) for s in slopes]
    elevations = [s["y"] for s in samples]

    # Calculate curvature kappa(x) = |y''| / (1 + y'^2)^(3/2)
    curvatures = []
    for i in range(1, n - 1):
        dx1 = samples[i]["x"] - samples[i-1]["x"]
        dx2 = samples[i+1]["x"] - samples[i]["x"]
        dy1 = (samples[i]["y"] - samples[i-1]["y"]) / dx1
        dy2 = (samples[i+1]["y"] - samples[i]["y"]) / dx2
        d2y = (dy2 - dy1) / ((dx1 + dx2) * 0.5)
        kappa = abs(d2y) / math.pow(1.0 + dy1 * dy1, 1.5)
        curvatures.append(kappa)

    max_slope_deg = max(abs_slopes_deg)
    avg_slope_deg = sum(abs_slopes_deg) / len(abs_slopes_deg)
    max_curv = max(curvatures) if curvatures else 0.0
    avg_curv = sum(curvatures) / len(curvatures) if curvatures else 0.0

    # In canvas, lower y = higher altitude
    initial_y = elevations[0]
    peak_y = min(elevations) # highest peak
    lowest_y = max(elevations) # deepest valley
    elevation_gain = max(0.0, initial_y - peak_y)
    max_valley_depth = max(0.0, lowest_y - initial_y)

    extreme_sections = sum(1 for s in abs_slopes_deg if s > 35.0)
    flat_recovery_sections = sum(1 for s in abs_slopes_deg if s < 5.0)

    print("=" * 60)
    print(f" THE OLD MOUNTAIN WORKS - TERRAIN ANALYSIS REPORT")
    print(f" Seed: {seed}")
    print("=" * 60)
    print(f" Total Samples Analyzed : {n}")
    print(f" Trail Length           : {samples[-1]['x'] - samples[0]['x']:.1f} px ({(samples[-1]['x'] - samples[0]['x'])/40.0:.1f} m)")
    print(f" Maximum Slope          : {max_slope_deg:.2f} deg")
    print(f" Average Slope          : {avg_slope_deg:.2f} deg")
    print(f" Maximum Curvature (k)  : {max_curv:.5f} 1/px")
    print(f" Average Curvature (k)  : {avg_curv:.5f} 1/px")
    print(f" Elevation Gain (Climb) : {elevation_gain:.1f} px ({elevation_gain/40.0:.1f} m)")
    print(f" Deepest Valley (Dip)   : {max_valley_depth:.1f} px ({max_valley_depth/40.0:.1f} m)")
    print(f" Extreme Sections (>35d): {extreme_sections} ({extreme_sections/n*100:.1f}%)")
    print(f" Recovery Zones (<5d)   : {flat_recovery_sections} ({flat_recovery_sections/n*100:.1f}%)")
    print("=" * 60)

def main():
    parser = argparse.ArgumentParser(description="Analyze procedural mountain terrain profile.")
    parser.add_argument("--seed", type=int, default=48192, help="Terrain RNG seed")
    parser.add_argument("--length", type=float, default=36000.0, help="Total trail length in pixels")
    parser.add_argument("--step", type=float, default=18.0, help="Sample resolution step in pixels")
    args = parser.parse_args()

    samples = generate_terrain(args.seed, args.length, args.step)
    analyze_terrain(samples, args.seed)

if __name__ == "__main__":
    main()
