from math import pi
import csv
from flask import Flask, jsonify, render_template

app = Flask(__name__)

def load_cable_db(filepath='cable_db.csv'):
    cables = []
    try:
        with open(filepath, newline='') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                # Convert numeric fields first so we can use them in name
                cores = int(row.get('cores', 3))
                conductor_size = float(row.get('conductor_size_mm2', 4))

                # Format name as you want
                row['name'] = f"{cores}C {int(conductor_size)}mm²"  # int() to avoid decimals in mm²

                # Store back numeric values as well
                row['cores'] = cores
                row['conductor_size_mm2'] = conductor_size
                row['overall_diameter_mm'] = float(row.get('overall_diameter_mm', 9))

                cables.append(row)
    except FileNotFoundError:
        print(f"Warning: {filepath} not found. Using default cable data.")
        cables = [
            {"name": "1C 16mm²", "cable_type": "Power", "cable_description": "PVC Insulated", "brand": "Olex", "cores": 1,
             "conductor_size_mm2": 16, "conductor_type": "Copper", "insulation": "X-90", "sheath": "PVC", "voltage_rating": "0.6/1 kV",
             "overall_diameter_mm": 9.3},
            # ... add more defaults as needed ...
        ]
    return cables


cable_db = load_cable_db()

conduit_db = [
    {"size": 20, "area_mm2": 314.16},
    {"size": 25, "area_mm2": 490.87},
    {"size": 32, "area_mm2": 804.25},
    {"size": 40, "area_mm2": 1256.64},
    {"size": 50, "area_mm2": 1963.50},
    {"size": 63, "area_mm2": 3117.25},
    {"size": 80, "area_mm2": 5026.55},
    {"size": 100, "area_mm2": 7853.98},
    {"size": 125, "area_mm2": 12271.85},
    {"size": 150, "area_mm2": 17671.46},
    {"size": 200, "area_mm2": 31415.93},
]

def cable_cross_section_area(diameter_mm):
    return pi * (diameter_mm / 2) ** 2

def get_space_factor(num_cables):
    if num_cables == 1:
        return 0.5
    elif num_cables == 2:
        return 0.33
    else:
        return 0.40

def get_recommended_conduit_size(total_cable_area, space_factor):
    required_area = total_cable_area / space_factor
    for conduit in sorted(conduit_db, key=lambda c: c["area_mm2"]):
        if conduit["area_mm2"] >= required_area:
            return conduit["size"]
    return conduit_db[-1]["size"]

@app.route('/')
def index():
    # pass full cable_db (all columns) to template
    return render_template('index.html', cable_db=cable_db, conduit_db=conduit_db)

@app.route('/api/cables')
def api_cables():
    # Return full cable details as JSON, all columns
    return jsonify(cable_db)

if __name__ == '__main__':
    app.run(debug=True)
