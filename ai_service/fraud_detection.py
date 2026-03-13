"""
PharmaTrace AI — Fraud Detection Microservice
Flask + Scikit-learn (IsolationForest)
Run: python fraud_detection.py
Port: 5001
"""

from flask import Flask, request, jsonify
from sklearn.ensemble import IsolationForest
import numpy as np

app = Flask(__name__)

# ── Training data (simulated normal medicine quality readings) ──
# [purity%, ph_level, sterility(0/1), contamination(0/1), dissolution%, moisture%]
TRAINING_DATA = np.array([
    [95.5, 7.0, 1, 0, 90.0, 2.1],
    [92.3, 6.8, 1, 0, 87.5, 2.3],
    [88.1, 7.2, 1, 0, 85.0, 2.5],
    [90.0, 7.0, 1, 0, 88.0, 2.0],
    [85.5, 6.9, 1, 0, 83.0, 2.8],
    [93.2, 7.1, 1, 0, 91.0, 1.9],
    [91.8, 7.3, 1, 0, 89.5, 2.2],
    [89.4, 6.7, 1, 0, 86.0, 2.6],
    [87.6, 7.0, 1, 0, 84.5, 2.4],
    [94.1, 6.8, 1, 0, 92.0, 2.0],
    [96.0, 7.1, 1, 0, 93.0, 1.8],
    [83.5, 7.0, 1, 0, 82.0, 2.7],
    [90.5, 6.9, 1, 0, 88.5, 2.1],
    [88.9, 7.2, 1, 0, 86.5, 2.3],
    [92.7, 7.0, 1, 0, 90.5, 2.0],
])

# ── Train model ────────────────────────────────────────────────
model = IsolationForest(
    n_estimators=100,
    contamination=0.1,
    random_state=42
)
model.fit(TRAINING_DATA)
print("[AI] IsolationForest model trained on", len(TRAINING_DATA), "samples")

# ── In-memory results store ────────────────────────────────────
results_store = []


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status':  'running',
        'model':   'IsolationForest',
        'samples': len(TRAINING_DATA),
        'service': 'PharmaTrace AI Fraud Detection'
    })


@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.json or {}

    purity        = float(data.get('purity_percentage', 0))
    ph            = float(data.get('ph_level', 7.0))
    sterility     = int(data.get('sterility_status', 0))
    contamination = int(data.get('contamination_flag', 0))
    dissolution   = float(data.get('dissolution_rate', 85.0))
    moisture      = float(data.get('moisture_content', 2.5))

    features = np.array([[purity, ph, sterility, contamination, dissolution, moisture]])

    prediction    = model.predict(features)[0]   # 1 = normal, -1 = anomaly
    score         = model.decision_function(features)[0]

    is_anomaly = prediction == -1

    # Risk level based on score
    if is_anomaly:
        risk_level = 'HIGH' if score < -0.15 else 'MEDIUM'
    else:
        risk_level = 'LOW'

    result = {
        'batch_id':       data.get('batch_id', 'UNKNOWN'),
        'is_anomaly':     bool(is_anomaly),
        'anomaly_score':  float(score),
        'risk_level':     risk_level,
        'recommendation': 'REJECT and quarantine for investigation' if is_anomaly else 'Approve for distribution',
        'features': {
            'purity_percentage': purity,
            'ph_level':          ph,
            'sterility_status':  sterility,
            'contamination_flag':contamination,
            'dissolution_rate':  dissolution,
            'moisture_content':  moisture
        }
    }

    results_store.append(result)
    print(f"[AI] Analyzed {result['batch_id']} → {risk_level} (anomaly={is_anomaly}, score={score:.4f})")
    return jsonify(result)


@app.route('/analyze/batch', methods=['POST'])
def analyze_batch():
    """Analyze multiple samples at once"""
    items = request.json or []
    results = []
    for item in items:
        features = np.array([[
            float(item.get('purity_percentage', 0)),
            float(item.get('ph_level', 7.0)),
            int(item.get('sterility_status', 0)),
            int(item.get('contamination_flag', 0)),
            float(item.get('dissolution_rate', 85.0)),
            float(item.get('moisture_content', 2.5))
        ]])
        prediction = model.predict(features)[0]
        score      = model.decision_function(features)[0]
        is_anomaly = prediction == -1
        results.append({
            'batch_id':      item.get('batch_id'),
            'is_anomaly':    bool(is_anomaly),
            'anomaly_score': float(score),
            'risk_level':    'HIGH' if is_anomaly and score < -0.15 else ('MEDIUM' if is_anomaly else 'LOW')
        })
    return jsonify(results)


@app.route('/results', methods=['GET'])
def get_results():
    return jsonify(results_store)


@app.route('/results/clear', methods=['POST'])
def clear_results():
    results_store.clear()
    return jsonify({'message': 'Results cleared'})


if __name__ == '__main__':
    print("\n╔══════════════════════════════════════════╗")
    print("║   🤖  PharmaTrace AI Service  Started   ║")
    print("╚══════════════════════════════════════════╝")
    print("  🔬  Endpoint → http://localhost:5001/analyze")
    print("  📊  Results  → http://localhost:5001/results")
    print("  ❤️   Health   → http://localhost:5001/health\n")
    app.run(host='0.0.0.0', port=5001, debug=True)
