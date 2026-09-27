#!/usr/bin/env python3
"""
tools/terrain_analysis.py
-------------------------
Mountain Generation 2.0 offline procedural terrain generator & analysis suite
for The Old Mountain Works (8.2 km Expedition).
Implements the 3-Scale Mountain Architecture:
  - Scale 1: Macro Mountain Envelope (7 Sectors + Summit Observatory at 8,100 m)
  - Scale 2: 32+ Parametric Meso Terrain Shapes + Markov Category Transition Matrix + 10 Signature Setpieces
  - Scale 3: Micro Surface Texture & Curvature-Rate Limiter
"""

import sys
import math
import argparse
from typing import List, Dict, Any

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def clamp(val: float, low: float, high: float) -> float:
    return max(low, min(high, val))


def pseudo_noise(seed: int):
    def l_noise(k: float) -> float:
        f = math.sin(k * 127.1 + seed * 311.7) * 43758.5453123
        return f - math.floor(f)

    def smooth(t: float) -> float:
        return t * t * (3.0 - 2.0 * t)

    def sample(x: float) -> float:
        i = math.floor(x)
        f = x - i
        return (l_noise(i) * (1.0 - smooth(f)) + l_noise(i + 1.0) * smooth(f)) * 2.0 - 1.0

    return sample


SECTORS = [
    {"id": "foothills", "sector": "SECTOR 01", "name": "Foothill Country", "landmark": "The Old Quarry", "startM": 0, "endM": 800, "primaryMaterial": "grass"},
    {"id": "crag", "sector": "SECTOR 02", "name": "Broken Ridge", "landmark": "The Red Ridge", "startM": 800, "endM": 1600, "primaryMaterial": "rock"},
    {"id": "descent", "sector": "SECTOR 03", "name": "Great Descent", "landmark": "The Broken Trestle", "startM": 1600, "endM": 2400, "primaryMaterial": "dirt"},
    {"id": "canyon", "sector": "SECTOR 04", "name": "Canyon Works", "landmark": "The Deep Mine", "startM": 2400, "endM": 3500, "primaryMaterial": "gravel"},
    {"id": "glacier", "sector": "SECTOR 05", "name": "Glacier Run", "landmark": "Glacier Basin", "startM": 3500, "endM": 5000, "primaryMaterial": "ice"},
    {"id": "approach", "sector": "SECTOR 06", "name": "Summit Approach", "landmark": "The High Crag", "startM": 5000, "endM": 6800, "primaryMaterial": "snow"},
    {"id": "summit", "sector": "SECTOR 07", "name": "Summit Face", "landmark": "Summit Observatory", "startM": 6800, "endM": 8200, "primaryMaterial": "snow"},
]

PARAMETRIC_SHAPES = [
    # CLIMBS (7)
    {"type": "long_climb", "name": "Sustained Alpine Climb", "category": "climb", "minLen": 900, "maxLen": 1400, "dyMin": -260, "dyMax": -420, "exitSlope": -0.22, "maxSlopeDeg": 34, "material": "grass", "danger": 0.35},
    {"type": "stepped_climb", "name": "Stepped Bench Ascent", "category": "climb", "minLen": 950, "maxLen": 1350, "dyMin": -240, "dyMax": -380, "exitSlope": -0.08, "maxSlopeDeg": 36, "material": "rock", "danger": 0.45},
    {"type": "concave_wall_climb", "name": "Concave Wall Pitch", "category": "climb", "minLen": 720, "maxLen": 1050, "dyMin": -280, "dyMax": -440, "exitSlope": -0.34, "maxSlopeDeg": 41, "material": "rock", "danger": 0.68},
    {"type": "convex_crest_climb", "name": "Convex Crest Rollover", "category": "climb", "minLen": 760, "maxLen": 1100, "dyMin": -220, "dyMax": -340, "exitSlope": 0.04, "maxSlopeDeg": 35, "material": "dirt", "danger": 0.42},
    {"type": "double_pitch_climb", "name": "Double-Pitch Headwall", "category": "climb", "minLen": 1100, "maxLen": 1550, "dyMin": -340, "dyMax": -520, "exitSlope": -0.18, "maxSlopeDeg": 40, "material": "rock", "danger": 0.65},
    {"type": "false_summit_climb", "name": "False Summit Ascent", "category": "climb", "minLen": 1000, "maxLen": 1450, "dyMin": -260, "dyMax": -410, "exitSlope": 0.12, "maxSlopeDeg": 37, "material": "snow", "danger": 0.52},
    {"type": "cliff_shelf_climb", "name": "Cliff Shelf Scramble", "category": "climb", "minLen": 820, "maxLen": 1180, "dyMin": -290, "dyMax": -460, "exitSlope": -0.10, "maxSlopeDeg": 42, "material": "rock", "danger": 0.74},
    # DESCENTS (6)
    {"type": "long_fast_descent", "name": "High-Speed Chute Descent", "category": "descent", "minLen": 1050, "maxLen": 1600, "dyMin": 260, "dyMax": 460, "exitSlope": 0.18, "maxSlopeDeg": 36, "material": "dirt", "danger": 0.48},
    {"type": "steep_chute", "name": "Steep Couloir Drop", "category": "descent", "minLen": 780, "maxLen": 1150, "dyMin": 300, "dyMax": 490, "exitSlope": 0.28, "maxSlopeDeg": 42, "material": "rock", "danger": 0.76},
    {"type": "stepped_descent", "name": "Stepped Ledge Drop-Off", "category": "descent", "minLen": 920, "maxLen": 1320, "dyMin": 220, "dyMax": 380, "exitSlope": 0.10, "maxSlopeDeg": 38, "material": "rock", "danger": 0.58},
    {"type": "rolling_downhill", "name": "Rolling Downhill Flow", "category": "descent", "minLen": 980, "maxLen": 1420, "dyMin": 190, "dyMax": 330, "exitSlope": 0.12, "maxSlopeDeg": 30, "material": "grass", "danger": 0.32},
    {"type": "cliff_drop_landing", "name": "Cliff Drop & Catch Slope", "category": "descent", "minLen": 860, "maxLen": 1220, "dyMin": 270, "dyMax": 430, "exitSlope": 0.22, "maxSlopeDeg": 41, "material": "gravel", "danger": 0.72},
    {"type": "canyon_plunge", "name": "Canyon Gorge Plunge", "category": "descent", "minLen": 1000, "maxLen": 1480, "dyMin": 320, "dyMax": 520, "exitSlope": 0.16, "maxSlopeDeg": 42, "material": "dirt", "danger": 0.75},
    # VALLEYS & COMPRESSION BOWLS (5)
    {"type": "deep_compression_bowl", "name": "Deep G-Out Compression Bowl", "category": "valley", "minLen": 820, "maxLen": 1200, "dyMin": -40, "dyMax": 60, "exitSlope": -0.28, "maxSlopeDeg": 36, "material": "dirt", "danger": 0.46},
    {"type": "wide_glacier_basin", "name": "Wide Glacial Basin", "category": "valley", "minLen": 1150, "maxLen": 1680, "dyMin": -30, "dyMax": 50, "exitSlope": -0.18, "maxSlopeDeg": 28, "material": "ice", "danger": 0.35},
    {"type": "v_canyon_dip", "name": "Canyon Gulch Dip", "category": "valley", "minLen": 720, "maxLen": 1020, "dyMin": -20, "dyMax": 70, "exitSlope": -0.32, "maxSlopeDeg": 39, "material": "gravel", "danger": 0.62},
    {"type": "double_dip_valley", "name": "Double-Dip Washout", "category": "valley", "minLen": 980, "maxLen": 1380, "dyMin": -35, "dyMax": 55, "exitSlope": -0.20, "maxSlopeDeg": 34, "material": "mud", "danger": 0.50},
    {"type": "slingshot_bowl", "name": "Slingshot Launch Bowl", "category": "valley", "minLen": 860, "maxLen": 1240, "dyMin": -90, "dyMax": -20, "exitSlope": -0.35, "maxSlopeDeg": 38, "material": "rock", "danger": 0.55},
    # JUMPS & LAUNCHERS (7)
    {"type": "natural_kicker", "name": "Natural Ridge Kicker", "category": "jump", "minLen": 760, "maxLen": 1080, "dyMin": -70, "dyMax": 30, "exitSlope": 0.16, "maxSlopeDeg": 35, "material": "dirt", "danger": 0.48},
    {"type": "step_up_jump", "name": "Step-Up Bench Launch", "category": "jump", "minLen": 820, "maxLen": 1150, "dyMin": -190, "dyMax": -110, "exitSlope": -0.05, "maxSlopeDeg": 37, "material": "rock", "danger": 0.56},
    {"type": "step_down_jump", "name": "Step-Down Escarpment Jump", "category": "jump", "minLen": 880, "maxLen": 1260, "dyMin": 140, "dyMax": 260, "exitSlope": 0.22, "maxSlopeDeg": 38, "material": "dirt", "danger": 0.60},
    {"type": "tabletop_jump", "name": "Highland Tabletop", "category": "jump", "minLen": 860, "maxLen": 1200, "dyMin": -60, "dyMax": 20, "exitSlope": 0.14, "maxSlopeDeg": 33, "material": "gravel", "danger": 0.42},
    {"type": "camelback_double", "name": "Camelback Double Rhythm", "category": "jump", "minLen": 840, "maxLen": 1180, "dyMin": -65, "dyMax": 25, "exitSlope": 0.06, "maxSlopeDeg": 34, "material": "grass", "danger": 0.45},
    {"type": "crest_launch", "name": "Blind Crest Launcher", "category": "jump", "minLen": 780, "maxLen": 1120, "dyMin": -90, "dyMax": 40, "exitSlope": 0.20, "maxSlopeDeg": 36, "material": "rock", "danger": 0.58},
    {"type": "ski_jump_ramp", "name": "Alpine Ski-Jump Flyer", "category": "jump", "minLen": 1050, "maxLen": 1480, "dyMin": 60, "dyMax": 190, "exitSlope": 0.24, "maxSlopeDeg": 39, "material": "snow", "danger": 0.68},
    # TECHNICAL & RHYTHM (5)
    {"type": "whoops_rhythm", "name": "Suspension Whoops Rhythm", "category": "technical", "minLen": 780, "maxLen": 1120, "dyMin": -80, "dyMax": 40, "exitSlope": -0.06, "maxSlopeDeg": 30, "material": "dirt", "danger": 0.44},
    {"type": "washboard_bed", "name": "Corrugated Washboard", "category": "technical", "minLen": 680, "maxLen": 980, "dyMin": -50, "dyMax": 30, "exitSlope": -0.04, "maxSlopeDeg": 26, "material": "gravel", "danger": 0.36},
    {"type": "boulder_staircase", "name": "Broken Talus Staircase", "category": "technical", "minLen": 760, "maxLen": 1060, "dyMin": -180, "dyMax": -70, "exitSlope": -0.14, "maxSlopeDeg": 38, "material": "rock", "danger": 0.64},
    {"type": "eroded_ledges", "name": "Eroded Shale Ledges", "category": "technical", "minLen": 740, "maxLen": 1040, "dyMin": -110, "dyMax": 80, "exitSlope": 0.08, "maxSlopeDeg": 35, "material": "gravel", "danger": 0.52},
    {"type": "frost_heave_moguls", "name": "Glacial Frost-Heave Moguls", "category": "technical", "minLen": 800, "maxLen": 1140, "dyMin": -120, "dyMax": 60, "exitSlope": -0.10, "maxSlopeDeg": 34, "material": "snow", "danger": 0.54},
    # RECOVERY & TRANSITION (4)
    {"type": "scenic_overlook", "name": "Scenic Overlook Shelf", "category": "recovery", "minLen": 580, "maxLen": 840, "dyMin": -30, "dyMax": 15, "exitSlope": 0.0, "maxSlopeDeg": 12, "material": "rock", "danger": 0.10},
    {"type": "alpine_meadow_shelf", "name": "Alpine Meadow Bench", "category": "recovery", "minLen": 640, "maxLen": 920, "dyMin": -45, "dyMax": 20, "exitSlope": -0.04, "maxSlopeDeg": 14, "material": "grass", "danger": 0.08},
    {"type": "ridge_saddle", "name": "High Ridge Saddle", "category": "recovery", "minLen": 600, "maxLen": 860, "dyMin": -25, "dyMax": 25, "exitSlope": -0.02, "maxSlopeDeg": 15, "material": "dirt", "danger": 0.12},
    {"type": "switching_bench", "name": "Switchback Recovery Bench", "category": "recovery", "minLen": 560, "maxLen": 800, "dyMin": -35, "dyMax": 10, "exitSlope": 0.0, "maxSlopeDeg": 12, "material": "gravel", "danger": 0.10},
]

GRAMMAR_SEQUENCE = PARAMETRIC_SHAPES

CATEGORY_TRANSITIONS = {
    "recovery": [("climb", 0.42), ("jump", 0.24), ("technical", 0.18), ("descent", 0.16)],
    "climb": [("jump", 0.30), ("recovery", 0.24), ("descent", 0.22), ("technical", 0.14), ("valley", 0.10)],
    "descent": [("valley", 0.40), ("jump", 0.28), ("recovery", 0.20), ("technical", 0.12)],
    "valley": [("climb", 0.44), ("jump", 0.32), ("recovery", 0.14), ("technical", 0.10)],
    "jump": [("recovery", 0.34), ("valley", 0.26), ("descent", 0.22), ("climb", 0.18)],
    "technical": [("recovery", 0.36), ("climb", 0.28), ("jump", 0.20), ("valley", 0.16)],
}

SIGNATURE_SETPIECES = [
    {"id": "setpiece_quarry", "name": "THE OLD QUARRY", "targetMeters": 450, "type": "stepped_climb", "category": "climb", "len": 1200, "dy": -310, "exitSlope": -0.10, "maxSlopeDeg": 34, "material": "gravel", "danger": 0.45},
    {"id": "setpiece_red_ridge", "name": "THE RED RIDGE", "targetMeters": 1180, "type": "double_pitch_climb", "category": "climb", "len": 1480, "dy": -460, "exitSlope": -0.18, "maxSlopeDeg": 40, "material": "rock", "danger": 0.72},
    {"id": "setpiece_broken_trestle", "name": "THE BROKEN TRESTLE", "targetMeters": 1880, "type": "ski_jump_ramp", "category": "jump", "len": 1360, "dy": 180, "exitSlope": 0.20, "maxSlopeDeg": 38, "material": "wood", "danger": 0.78},
    {"id": "setpiece_great_descent", "name": "THE GREAT DESCENT", "targetMeters": 2180, "type": "canyon_plunge", "category": "descent", "len": 1650, "dy": 520, "exitSlope": 0.18, "maxSlopeDeg": 41, "material": "dirt", "danger": 0.80},
    {"id": "setpiece_deep_mine", "name": "THE DEEP MINE", "targetMeters": 2950, "type": "slingshot_bowl", "category": "valley", "len": 1420, "dy": -120, "exitSlope": -0.32, "maxSlopeDeg": 39, "material": "metal", "danger": 0.75},
    {"id": "setpiece_devils_spine", "name": "DEVIL'S SPINE", "targetMeters": 3920, "type": "crest_launch", "category": "jump", "len": 1320, "dy": -180, "exitSlope": 0.16, "maxSlopeDeg": 40, "material": "rock", "danger": 0.82},
    {"id": "setpiece_glacier_basin", "name": "GLACIER BASIN", "targetMeters": 4520, "type": "wide_glacier_basin", "category": "valley", "len": 1680, "dy": -60, "exitSlope": -0.24, "maxSlopeDeg": 34, "material": "ice", "danger": 0.68},
    {"id": "setpiece_high_crag", "name": "THE HIGH CRAG", "targetMeters": 5850, "type": "concave_wall_climb", "category": "climb", "len": 1520, "dy": -520, "exitSlope": -0.22, "maxSlopeDeg": 42, "material": "rock", "danger": 0.88},
    {"id": "setpiece_false_summit", "name": "THE FALSE SUMMIT", "targetMeters": 7150, "type": "false_summit_climb", "category": "climb", "len": 1500, "dy": -390, "exitSlope": 0.14, "maxSlopeDeg": 41, "material": "snow", "danger": 0.86},
    {"id": "setpiece_summit_obs", "name": "SUMMIT OBSERVATORY", "targetMeters": 7980, "type": "scenic_overlook", "category": "recovery", "len": 1600, "dy": -120, "exitSlope": 0.0, "maxSlopeDeg": 18, "material": "snow", "danger": 0.25},
]


def biome_at(x_pos: float, start_x: float = 220.0) -> Dict[str, Any]:
    dist_m = max(0.0, (x_pos - start_x) / 40.0)
    for b in SECTORS:
        if b["startM"] <= dist_m < b["endM"]:
            return b
    return SECTORS[-1]


def generate_terrain_data(seed: int, total_length: float = 328220.0, step: float = 18.0) -> Dict[str, Any]:
    ground_base = 560.0
    start_x = 220.0
    n_macro = pseudo_noise(seed + 7)
    n_swell = pseudo_noise(seed + 11)
    n_detail = pseudo_noise(seed + 89)
    n_pick = pseudo_noise(seed + 233)

    samples: List[Dict[str, Any]] = []
    segments: List[Dict[str, Any]] = []

    q = -500.0
    while q < start_x + 350.0:
        samples.append({
            "x": q,
            "y": ground_base,
            "slope": 0.0,
            "curvature": 0.0,
            "material": "grass",
            "biome": "foothills",
            "segmentType": "apron",
            "danger": 0.0,
        })
        q += step

    segments.append({
        "index": 0,
        "type": "apron",
        "name": "Base Camp Apron",
        "category": "recovery",
        "isSetpiece": False,
        "startX": -500.0,
        "endX": start_x + 350.0,
        "startY": ground_base,
        "endY": ground_base,
        "material": "grass",
        "biome": "foothills",
        "danger": 0.0,
    })

    cur_x = start_x + 350.0
    cur_y = ground_base
    cur_slope = 0.0
    current_category = "recovery"
    recent_types: List[str] = []
    used_setpieces = set()
    seg_counter = 1

    while cur_x < total_length:
        dist_meters = max(0.0, (cur_x - start_x) / 40.0)
        biome = biome_at(cur_x, start_x)
        progress = clamp(dist_meters / 8200.0, 0.0, 1.0)

        if dist_meters < 1600:
            sector_difficulty = 0.25 + (dist_meters / 1600.0) * 0.35
        elif dist_meters < 2400:
            sector_difficulty = 0.65
        elif dist_meters < 3500:
            sector_difficulty = 0.72
        elif dist_meters < 5000:
            sector_difficulty = 0.78
        else:
            sector_difficulty = 0.85 + clamp((dist_meters - 5000.0) / 3200.0, 0.0, 0.15)

        chosen_setpiece = None
        for sp in SIGNATURE_SETPIECES:
            if sp["id"] not in used_setpieces and dist_meters >= sp["targetMeters"] - 35.0:
                chosen_setpiece = sp
                used_setpieces.add(sp["id"])
                break

        if chosen_setpiece:
            tmpl = chosen_setpiece
            seg_len = chosen_setpiece["len"]
            seg_dy = chosen_setpiece["dy"]
            target_slope = chosen_setpiece["exitSlope"]
            current_category = chosen_setpiece["category"]
            is_setpiece = True
        else:
            is_setpiece = False
            transitions = CATEGORY_TRANSITIONS.get(current_category, CATEGORY_TRANSITIONS["recovery"])
            r_val = abs(n_pick(seg_counter * 0.73 + seed * 0.013)) % 1.0
            acc = 0.0
            next_cat = transitions[0][0]
            for cat_name, weight in transitions:
                acc += weight
                if r_val <= acc:
                    next_cat = cat_name
                    break

            if dist_meters >= 1600 and dist_meters < 2350 and r_val < 0.55:
                next_cat = "descent"
            elif dist_meters >= 5000 and r_val < 0.42:
                next_cat = "climb"

            candidates = [s for s in PARAMETRIC_SHAPES if s["category"] == next_cat and s["type"] not in recent_types]
            if not candidates:
                candidates = [s for s in PARAMETRIC_SHAPES if s["category"] == next_cat]

            pick_idx = int(math.floor(abs(n_swell(seg_counter * 1.37 + cur_x * 0.0007)) * len(candidates))) % len(candidates)
            tmpl = candidates[pick_idx]
            current_category = next_cat

            recent_types.append(tmpl["type"])
            if len(recent_types) > 5:
                recent_types.pop(0)

            t_len = abs(n_swell(cur_x / 1100.0 + seg_counter * 0.31))
            seg_len = round(tmpl["minLen"] + (tmpl["maxLen"] - tmpl["minLen"]) * clamp(t_len, 0.0, 1.0))

            t_dy = abs(n_macro(cur_x / 1700.0 + seg_counter * 0.53))
            raw_dy = tmpl["dyMin"] + (tmpl["dyMax"] - tmpl["dyMin"]) * clamp(t_dy, 0.0, 1.0)

            sector_bias = -35.0
            if 1600 <= dist_meters < 2400:
                sector_bias = 85.0
            elif 2400 <= dist_meters < 3500:
                sector_bias = -25.0
            elif 3500 <= dist_meters < 5000:
                sector_bias = -55.0
            elif dist_meters >= 5000:
                sector_bias = -95.0

            seg_dy = raw_dy * (0.88 + sector_difficulty * 0.28) + sector_bias
            target_slope = tmpl["exitSlope"] * (0.9 + sector_difficulty * 0.2)

        x0 = cur_x
        y0 = cur_y
        m0 = cur_slope
        x1 = cur_x + seg_len
        y1 = cur_y + seg_dy
        m1 = clamp(target_slope, -0.78, 0.78)
        L = x1 - x0

        seg_material = tmpl["material"] if is_setpiece else (biome["primaryMaterial"] if abs(n_detail(seg_counter * 0.9)) < 0.62 else tmpl["material"])
        max_allowed_rad = (tmpl.get("maxSlopeDeg", 42) * math.pi) / 180.0
        max_dy_step = step * math.tan(min(0.79, max_allowed_rad))
        max_delta_slope = 0.085

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

            env = math.sin(u * math.pi)
            stype = tmpl["type"]
            if stype in ("stepped_climb", "stepped_descent"):
                y += math.sin(u * math.pi * 6.0) * 18.0 * env
            elif stype == "concave_wall_climb":
                y += (1.0 - math.pow(u, 1.65)) * 38.0 * env
            elif stype == "convex_crest_climb":
                y -= math.pow(u, 0.65) * 34.0 * env
            elif stype == "double_pitch_climb":
                y += math.sin(u * math.pi * 4.0) * 28.0 * env
            elif stype == "false_summit_climb":
                if u > 0.65:
                    y += math.sin(((u - 0.65) / 0.35) * math.pi) * 65.0
            elif stype in ("deep_compression_bowl", "wide_glacier_basin", "slingshot_bowl"):
                y += math.sin(u * math.pi) * (85.0 if stype == "wide_glacier_basin" else 115.0)
            elif stype == "v_canyon_dip":
                y += (1.0 - abs(2.0 * u - 1.0)) * 110.0 * env
            elif stype == "double_dip_valley":
                y += math.pow(math.sin(u * math.pi * 2.0), 2.0) * 78.0 * env
            elif stype in ("natural_kicker", "crest_launch", "ski_jump_ramp"):
                if u < 0.46:
                    y -= math.sin((u / 0.46) * math.pi * 0.5) * (34.0 + sector_difficulty * 22.0)
                else:
                    y += math.sin(((u - 0.46) / 0.54) * math.pi) * (24.0 + sector_difficulty * 16.0)
            elif stype == "tabletop_jump":
                if 0.25 < u < 0.72:
                    y -= 42.0 * env
            elif stype == "camelback_double":
                y -= abs(math.sin(u * math.pi * 2.0)) * 44.0 * env
            elif stype == "whoops_rhythm":
                y += math.sin(u * math.pi * 8.0) * (16.0 + sector_difficulty * 8.0) * env
            elif stype == "washboard_bed":
                y += math.sin(u * math.pi * 14.0) * 7.5 * env
            elif stype in ("boulder_staircase", "eroded_ledges", "frost_heave_moguls"):
                y += (math.sin(u * math.pi * 7.0) * 14.0 + n_detail(q / 48.0) * 11.0) * env

            rough_amp = 0.8 if tmpl["category"] == "recovery" else (3.2 if tmpl["category"] == "technical" else 1.8)
            y += (n_detail(q / 55.0) * rough_amp + n_swell(q / 190.0) * 2.4) * env

            prev = samples[-1]
            dx = q - prev["x"]
            dy = y - prev["y"]

            raw_slope = dy / dx
            clamped_slope = clamp(raw_slope, prev["slope"] - max_delta_slope, prev["slope"] + max_delta_slope)
            dy = clamped_slope * dx

            if abs(dy) > max_dy_step:
                dy = math.copysign(max_dy_step, dy)

            y = prev["y"] + dy
            actual_slope = dy / dx
            curv = abs(actual_slope - prev["slope"]) / dx
            sample_biome = biome_at(q, start_x)

            samples.append({
                "x": q,
                "y": y,
                "slope": actual_slope,
                "curvature": curv,
                "material": seg_material,
                "biome": sample_biome["id"],
                "segmentType": tmpl["type"],
                "danger": tmpl.get("danger", 0.3),
            })
            q += step

        end_y = samples[-1]["y"]
        segments.append({
            "index": seg_counter,
            "type": tmpl["type"],
            "name": tmpl["name"],
            "category": tmpl["category"],
            "isSetpiece": is_setpiece,
            "setpieceId": tmpl.get("id") if is_setpiece else None,
            "startX": x0,
            "endX": x1,
            "startY": y0,
            "endY": end_y,
            "material": seg_material,
            "biome": biome["id"],
            "danger": tmpl.get("danger", 0.3),
        })

        cur_x = x1
        cur_y = end_y
        cur_slope = samples[-1]["slope"]
        seg_counter += 1

    return {"samples": samples, "segments": segments, "seed": seed}


def generate_terrain(seed: int, total_length: float = 328220.0, step: float = 18.0) -> List[Dict[str, Any]]:
    return generate_terrain_data(seed, total_length, step)["samples"]


def analyze_terrain(seed: int, total_length: float = 328220.0, step: float = 18.0):
    data = generate_terrain_data(seed, total_length, step)
    samples = data["samples"]
    segments = data["segments"]
    n = len(samples)
    if n < 2:
        print("Error: insufficient samples")
        return

    slopes = [s["slope"] for s in samples]
    abs_slopes_deg = [math.degrees(math.atan(abs(s))) for s in slopes]
    elevations = [s["y"] for s in samples]
    curvatures = [s["curvature"] for s in samples]

    max_slope_deg = max(abs_slopes_deg)
    avg_slope_deg = sum(abs_slopes_deg) / n
    max_curv = max(curvatures)

    ground_base = 560.0
    max_elev_m = max(0.0, (ground_base - min(elevations)) / 40.0)
    total_gain_px = sum(max(0.0, samples[i - 1]["y"] - samples[i]["y"]) for i in range(1, n))
    max_descent_px = max(( s["endY"] - s["startY"] for s in segments ), default=0.0)

    mild = sum(1 for d in abs_slopes_deg if d < 10.0)
    moderate = sum(1 for d in abs_slopes_deg if 10.0 <= d < 22.0)
    steep = sum(1 for d in abs_slopes_deg if 22.0 <= d < 35.0)
    extreme = sum(1 for d in abs_slopes_deg if d >= 35.0)

    jumps = sum(1 for s in segments if s["category"] == "jump")
    major_jumps = sum(1 for s in segments if s["category"] == "jump" and (s["endX"] - s["startX"]) >= 950)
    climbs = sum(1 for s in segments if s["category"] == "climb")
    valleys = sum(1 for s in segments if s["category"] == "valley")
    recoveries = sum(1 for s in segments if s["category"] == "recovery")
    setpieces = [s for s in segments if s.get("isSetpiece")]
    unique_types = len(set(s["type"] for s in segments if s["type"] != "apron"))
    diversity_pct = min(100.0, (unique_types / 26.0) * 100.0)

    print("=" * 68)
    print(f" THE OLD MOUNTAIN WORKS — MOUNTAIN GENERATION 2.0 ANALYSIS")
    print(f" Seed: {seed}")
    print("=" * 68)
    print(f" Total Samples Analyzed : {n}")
    print(f" Total Distance         : {(samples[-1]['x'] - 220.0)/40000.0:.2f} km ({(samples[-1]['x'] - 220.0)/40.0:.0f} m)")
    print(f" Peak Elevation         : {max_elev_m:.1f} m")
    print(f" Total Elevation Gain   : {total_gain_px/40.0:.1f} m")
    print(f" Biggest Single Drop    : {max_descent_px/40.0:.1f} m")
    print(f" Maximum Slope          : {max_slope_deg:.2f} deg")
    print(f" Average Slope          : {avg_slope_deg:.2f} deg")
    print(f" Maximum Curvature (k)  : {max_curv:.5f} 1/px")
    print(f" Slope Distribution     : Mild {mild/n*100:.1f}% | Mod {moderate/n*100:.1f}% | Steep {steep/n*100:.1f}% | Ext {extreme/n*100:.1f}%")
    print(f" Feature Counts         : {jumps} Jumps ({major_jumps} Major) | {climbs} Climbs | {valleys} Valleys | {recoveries} Recovery")
    print(f" Signature Setpieces    : {len(setpieces)} / {len(SIGNATURE_SETPIECES)}")
    print(f" Terrain Diversity      : {diversity_pct:.1f}% ({unique_types} unique shapes across {len(segments)} segments)")
    print("=" * 68)


def main():
    parser = argparse.ArgumentParser(description="Analyze procedural mountain terrain profile (8.2 km Expedition).")
    parser.add_argument("--seed", type=int, default=42, help="Terrain RNG seed")
    parser.add_argument("--length", type=float, default=328220.0, help="Total trail length in pixels")
    parser.add_argument("--step", type=float, default=18.0, help="Sample resolution step in pixels")
    args = parser.parse_args()

    analyze_terrain(args.seed, args.length, args.step)


if __name__ == "__main__":
    main()
