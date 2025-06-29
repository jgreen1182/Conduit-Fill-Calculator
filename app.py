from flask import Flask, render_template, request, jsonify
from cable_data import cable_db, conduit_db, cable_cross_section_area, get_space_factor, get_recommended_conduit_size

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html', cable_db=cable_db, conduit_db=conduit_db)

@app.route('/calculate', methods=['POST'])
def calculate():
    cables = request.json.get('cables', [])
    conduit_size = int(request.json.get('conduit_size'))

    total_cable_area = sum(cable_cross_section_area(c['diameter_mm']) for c in cables)
    space_factor = get_space_factor(len(cables))

    conduit = next(c for c in conduit_db if c["size"] == conduit_size)
    fill_ratio = total_cable_area / conduit["area_mm2"]

    recommended_size = get_recommended_conduit_size(total_cable_area, space_factor)
    recommended_area = next(c["area_mm2"] for c in conduit_db if c["size"] == recommended_size)

    return jsonify({
        "total_area": total_cable_area,
        "space_factor": space_factor,
        "fill_ratio": fill_ratio,
        "allowed": fill_ratio <= space_factor,
        "recommended_size": recommended_size,
        "recommended_area": recommended_area
    })

if __name__ == '__main__':
    app.run(debug=True)
