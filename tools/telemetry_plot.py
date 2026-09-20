#!/usr/bin/env python3
"""
tools/telemetry_plot.py
-----------------------
Telemetry visualization and expedition data analysis tool for The Old Mountain Works (Spec Section 60).
Parses recorded browser run telemetry JSON or generates high-fidelity synthetic run data,
rendering speed, altitude, pitch, suspension compression, and slip graphs directly in terminal,
with optional PNG export if matplotlib is available.
"""

import sys
import os
import json
import math
import argparse
from typing import List, Dict, Any

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def ascii_sparkline(values: List[float], width: int = 50, height: int = 8, y_label: str = "") -> str:
    if not values:
        return "No data"
    min_v = min(values)
    max_v = max(values)
    span = max_v - min_v if max_v != min_v else 1.0

    # Resample to width
    step = len(values) / width
    resampled = [values[min(len(values) - 1, int(i * step))] for i in range(width)]

    lines = []
    for r in range(height - 1, -1, -1):
        threshold = min_v + (r / (height - 1)) * span
        row = ""
        for val in resampled:
            if val >= threshold:
                row += "#"
            elif val >= threshold - (span / (height * 2)):
                row += "."
            else:
                row += " "
        lbl = f"{threshold:>7.1f} | " if r in (0, height // 2, height - 1) else "        | "
        lines.append(lbl + row)

    footer = "        +-" + "-" * width
    labels = f"        {min_v:.1f}{' ' * (width - 12)}{max_v:.1f} ({y_label})"
    return "\n".join(lines) + "\n" + footer + "\n" + labels

def generate_sample_telemetry(distance_m: float = 650.0) -> Dict[str, Any]:
    """Generates synthetic mountain expedition run telemetry."""
    records = []
    cur_dist = 0.0
    cur_speed = 0.0
    cur_alt = 10.0
    rollovers = []
    crashes = []

    dt = 0.1 # 100ms sample interval
    t = 0.0
    while cur_dist < distance_m:
        # Terrain profile
        grade = math.sin(cur_dist / 60.0) * 22.0 + (cur_dist / distance_m) * 15.0
        pitch = grade + math.sin(t * 3.0) * 3.0

        # Acceleration and speed
        target_speed = max(5.0, 52.0 - grade * 0.9)
        cur_speed += (target_speed - cur_speed) * 0.08 + (math.sin(t * 5.0) * 1.5)
        cur_speed = max(0.0, cur_speed)

        cur_dist += (cur_speed / 3.6) * dt
        cur_alt += (cur_speed / 3.6) * dt * math.sin(math.radians(grade))

        comp_front = 0.2 + math.sin(t * 8.0) * 0.35 + (grade / 40.0) * 0.2
        comp_rear = 0.25 - math.sin(t * 8.0) * 0.30 - (grade / 40.0) * 0.25
        slip = max(0.0, math.sin(t * 12.0) * 0.22 if grade > 20.0 else 0.04)

        if grade > 32.0 and cur_speed < 8.0 and not rollovers:
            rollovers.append({"dist": cur_dist, "time": t, "type": "STALL_RECOVERED"})

        records.append({
            "t": round(t, 2),
            "distance": round(cur_dist, 1),
            "speed": round(cur_speed, 1),
            "altitude": round(cur_alt, 1),
            "pitch": round(pitch, 1),
            "compFront": round(comp_front, 2),
            "compRear": round(comp_rear, 2),
            "slip": round(slip, 3)
        })
        t += dt

    return {
        "expedition": "Mount Works Alpine Ascent",
        "vehicle": "Trail Buggy",
        "totalTime": round(t, 1),
        "totalDistance": round(cur_dist, 1),
        "samples": records,
        "events": {
            "rollovers": rollovers,
            "crashes": crashes
        }
    }

def analyze_and_plot(data: Dict[str, Any], save_png: bool = False):
    samples = data.get("samples", [])
    if not samples:
        print("No telemetry samples available.")
        return

    dists = [s["distance"] for s in samples]
    speeds = [s["speed"] for s in samples]
    alts = [s["altitude"] for s in samples]
    pitches = [s["pitch"] for s in samples]
    slips = [s["slip"] for s in samples]
    comp_f = [s["compFront"] for s in samples]

    print("=" * 70)
    print(f" THE OLD MOUNTAIN WORKS - TELEMETRY RUN REPORT (Spec #60)")
    print(f" Expedition: {data.get('expedition', 'Alpine Trail')}")
    print(f" Vehicle   : {data.get('vehicle', 'Trail Buggy')}")
    print(f" Distance  : {dists[-1]:.1f} m | Duration: {samples[-1]['t']:.1f} s")
    print("=" * 70)

    print("\n1. SPEED PROFILE (km/h vs Distance)")
    print(ascii_sparkline(speeds, width=54, height=7, y_label="km/h"))

    print("\n2. ALTITUDE PROFILE (m vs Distance)")
    print(ascii_sparkline(alts, width=54, height=7, y_label="m"))

    print("\n3. VEHICLE PITCH (deg vs Distance)")
    print(ascii_sparkline(pitches, width=54, height=6, y_label="deg"))

    print("\n4. FRONT SUSPENSION COMPRESSION (Normalized vs Distance)")
    print(ascii_sparkline(comp_f, width=54, height=6, y_label="travel"))

    print("-" * 70)
    print("RUN METRICS SUMMARY:")
    print(f"  Top Speed            : {max(speeds):.1f} km/h")
    print(f"  Average Speed        : {sum(speeds)/len(speeds):.1f} km/h")
    print(f"  Elevation Gain       : {max(alts) - min(alts):.1f} m")
    print(f"  Max Incline Recorded : {max(pitches):.1f} deg")
    print(f"  Peak Wheel Slip      : {max(slips):.3f}")
    print(f"  Recorded Incidents   : {len(data.get('events', {}).get('rollovers', []))} near-rollovers, {len(data.get('events', {}).get('crashes', []))} crashes")
    print("=" * 70)

    if save_png:
        try:
            import matplotlib.pyplot as plt
            fig, axs = plt.subplots(3, 1, figsize=(10, 8), sharex=True)
            axs[0].plot(dists, speeds, color="#d4622a", lw=2, label="Speed (km/h)")
            axs[0].set_ylabel("km/h")
            axs[0].grid(True, alpha=0.3)
            axs[0].legend(loc="upper right")

            axs[1].plot(dists, alts, color="#2ea3a5", lw=2, label="Altitude (m)")
            axs[1].set_ylabel("m")
            axs[1].grid(True, alpha=0.3)
            axs[1].legend(loc="upper right")

            axs[2].plot(dists, pitches, color="#486954", lw=1.5, label="Pitch (deg)")
            axs[2].set_ylabel("deg")
            axs[2].set_xlabel("Distance (m)")
            axs[2].grid(True, alpha=0.3)
            axs[2].legend(loc="upper right")

            plt.tight_layout()
            out_file = "telemetry_run.png"
            plt.savefig(out_file, dpi=150)
            print(f"\n[PNG Export] Plot successfully saved to {out_file}")
        except ImportError:
            print("\n[Notice] matplotlib not installed; skipped PNG plot export.")

def main():
    parser = argparse.ArgumentParser(description="Analyze and plot expedition telemetry.")
    parser.add_argument("--file", type=str, default="", help="Path to exported telemetry JSON file")
    parser.add_argument("--save-png", action="store_true", help="Export PNG plot using matplotlib")
    args = parser.parse_args()

    if args.file and os.path.exists(args.file):
        with open(args.file, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        if args.file:
            print(f"Warning: File {args.file} not found. Using generated run telemetry.")
        data = generate_sample_telemetry()

    analyze_and_plot(data, save_png=args.save_png)

if __name__ == "__main__":
    main()
