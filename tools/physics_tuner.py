#!/usr/bin/env python3
"""
tools/physics_tuner.py
----------------------
Vehicle dynamics calculator and suspension tuning workbench for The Old Mountain Works.
Calculates dynamic normal load transfers, critical tip-over angles, spring-damper oscillation
characteristics, and slip-saturating traction curves on steep mountain grades.
"""

import sys
import math
import argparse
from typing import Dict, Any

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ARCHETYPES = {
    "buggy": {
        "name": "Trail Buggy",
        "mass": 7.2,
        "wheelMass": 1.2,
        "wheelRadius": 20.0,
        "wheelBase": 76.0,
        "wheelOffsetY": 22.0,
        "comHeight": 12.0, # h above axle plane
        "distToFront": 38.0, # b
        "distToRear": 38.0,  # a
        "stiffness": 0.13,
        "damping": 0.038,
        "tireGrip": 1.15,
        "engineTorque": 0.185,
        "brakeTorque": 0.24,
    },
    "crawler": {
        "name": "Mountain Crawler",
        "mass": 9.8,
        "wheelMass": 1.8,
        "wheelRadius": 23.0,
        "wheelBase": 82.0,
        "wheelOffsetY": 25.0,
        "comHeight": 10.0,
        "distToFront": 41.0,
        "distToRear": 41.0,
        "stiffness": 0.16,
        "damping": 0.048,
        "tireGrip": 1.35,
        "engineTorque": 0.22,
        "brakeTorque": 0.30,
    },
    "rally": {
        "name": "Alpine Rally",
        "mass": 5.8,
        "wheelMass": 0.9,
        "wheelRadius": 18.0,
        "wheelBase": 72.0,
        "wheelOffsetY": 19.0,
        "comHeight": 14.0,
        "distToFront": 36.0,
        "distToRear": 36.0,
        "stiffness": 0.11,
        "damping": 0.032,
        "tireGrip": 1.05,
        "engineTorque": 0.165,
        "brakeTorque": 0.21,
    }
}

def saturating_slip_curve(kappa: float) -> float:
    """
    Saturating traction curve S(kappa).
    Linear initial region, peak at kappa ~ 0.15, slight dropoff to sliding friction.
    """
    abs_k = abs(kappa)
    if abs_k < 0.15:
        return math.copysign(abs_k / 0.15, kappa)
    else:
        # Falloff to 82% grip at 100% wheel spin
        falloff = 1.0 - 0.18 * min(1.0, (abs_k - 0.15) / 0.85)
        return math.copysign(falloff, kappa)

def calculate_vehicle_state(arch: Dict[str, Any], grade_deg: float, ax: float = 0.0) -> Dict[str, Any]:
    theta = math.radians(grade_deg)
    g = 9.81
    m = arch["mass"]
    W = m * g
    L = arch["wheelBase"]
    a = arch["distToRear"]
    b = arch["distToFront"]
    h = arch["comHeight"]

    cos_t = math.cos(theta)
    sin_t = math.sin(theta)

    # Dynamic normal load distribution equations (Spec Section 03):
    # N_front = [mg(b cos theta - h sin theta) - m h a_x] / L
    # N_rear  = [mg(a cos theta + h sin theta) + m h a_x] / L
    n_front = (W * (b * cos_t - h * sin_t) - m * h * ax) / L
    n_rear = (W * (a * cos_t + h * sin_t) + m * h * ax) / L

    # Critical rollover angle: when N_front <= 0 (for uphill) or N_rear <= 0 (downhill)
    # tan(theta_crit) = b / h
    crit_uphill_deg = math.degrees(math.atan2(b, h))
    crit_downhill_deg = math.degrees(math.atan2(a, h))

    # Suspension natural frequency omega_n = sqrt(k / m_corner)
    m_corner = m / 2.0
    k_corner = arch["stiffness"] * 1000.0 # scale to N/m equivalent
    omega_n = math.sqrt(k_corner / m_corner)
    freq_hz = omega_n / (2.0 * math.pi)

    # Damping ratio zeta = c / (2 * sqrt(k * m_corner))
    c_corner = arch["damping"] * 100.0
    crit_damping = 2.0 * math.sqrt(k_corner * m_corner)
    zeta = c_corner / crit_damping

    # Traction limits at current grade
    mu = arch["tireGrip"]
    front_max_traction = max(0.0, n_front * mu)
    rear_max_traction = max(0.0, n_rear * mu)
    total_max_traction = front_max_traction + rear_max_traction

    gravity_drag = W * sin_t
    climbable = total_max_traction > gravity_drag and n_front > 0 and n_rear > 0

    return {
        "archetype": arch["name"],
        "gradeDeg": grade_deg,
        "nFront": max(0.0, n_front),
        "nRear": max(0.0, n_rear),
        "frontRearRatio": (n_front / (n_front + n_rear)) if (n_front + n_rear) > 0 else 0.0,
        "critUphillDeg": crit_uphill_deg,
        "critDownhillDeg": crit_downhill_deg,
        "freqHz": freq_hz,
        "zeta": zeta,
        "dampingRegime": "Critical" if abs(zeta - 1.0) < 0.05 else ("Overdamped" if zeta > 1.0 else "Underdamped"),
        "frontMaxTraction": front_max_traction,
        "rearMaxTraction": rear_max_traction,
        "totalMaxTraction": total_max_traction,
        "gravityDrag": gravity_drag,
        "climbable": climbable
    }

def main():
    parser = argparse.ArgumentParser(description="Tuning and dynamics workbench for mountain vehicles.")
    parser.add_argument("--archetype", choices=["buggy", "crawler", "rally", "all"], default="buggy", help="Vehicle archetype")
    parser.add_argument("--grade", type=float, default=32.0, help="Mountain slope grade in degrees")
    parser.add_argument("--ax", type=float, default=1.5, help="Longitudinal acceleration in m/s^2")
    args = parser.parse_args()

    targets = list(ARCHETYPES.keys()) if args.archetype == "all" else [args.archetype]

    print("=" * 70)
    print(f" THE OLD MOUNTAIN WORKS - VEHICLE DYNAMICS TUNER")
    print(f" Target Grade: {args.grade:.1f} deg | Longitudinal Accel: {args.ax:.2f} m/s^2")
    print("=" * 70)

    for arch_id in targets:
        arch = ARCHETYPES[arch_id]
        res = calculate_vehicle_state(arch, args.grade, args.ax)

        print(f"\n--- [{res['archetype'].upper()}] ---")
        print(f"  Front Normal Load (N_f)  : {res['nFront']:.2f} N ({res['frontRearRatio']*100:.1f}%)")
        print(f"  Rear Normal Load (N_r)   : {res['nRear']:.2f} N ({(1.0 - res['frontRearRatio'])*100:.1f}%)")
        print(f"  Max Climbing Traction    : {res['totalMaxTraction']:.2f} N (Gravity Component: {res['gravityDrag']:.2f} N)")
        print(f"  Climbing Viability       : {'FEASIBLE' if res['climbable'] else 'WILL SLIP / ROLLOVER'}")
        print(f"  Critical Tip-Over Angle  : Uphill: {res['critUphillDeg']:.1f} deg | Downhill: {res['critDownhillDeg']:.1f} deg")
        print(f"  Suspension Natural Freq  : {res['freqHz']:.2f} Hz")
        print(f"  Suspension Damping Ratio : {res['zeta']:.3f} ({res['dampingRegime']})")

    print("\n" + "=" * 70)

if __name__ == "__main__":
    main()
