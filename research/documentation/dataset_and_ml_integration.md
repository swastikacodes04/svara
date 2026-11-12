# SVARA Dataset & Python ML Integration Guide

## 1. Dataset Sources & Hygiene

SVARA is designed to integrate with academic Indian classical music corpora such as **CompMusic** and **Saraga** while respecting copyright and licensing terms.

### Mandatory Anti-Leakage Rules
1. **Preserve Source Recording IDs (`recording_id`)**: When segmenting long concert recordings into shorter analysis windows (`clip_id`), all clips sharing the same `recording_id` **must** belong to the exact same dataset split (`train`, `validation`, or `test`).
2. **Performer-Disjoint Evaluation**: Whenever `performer_id` metadata is present, assign performers strictly to one split so the model generalizes to unseen artists and Shruti/timbre profiles rather than memorizing performer voiceprint or accompaniment.
3. **Tradition Isolation**: Never combine Hindustani and Carnatic classes into a single uncalibrated classifier without an explicit tradition-aware model design. SVARA's initial ML scope targets **Hindustani Classical Ragas**.

---

## 2. Candidate ML Architectures

The Node.js backend extracts structured features (`pitchClassDistribution`, `observedSequence`, `gamaka` descriptors, `spectralFeatures`, and `pakad` DTW distances) that map naturally onto multiple Python model families:

| Model Family | Primary Inputs | Strengths |
| :--- | :--- | :--- |
| **SVM (RBF / Linear)** | 12-bin & 24-bin tonic-normalised pitch distributions + Gamaka summary statistics | Strong interpretable baseline on limited curated datasets |
| **XGBoost** | Tabular pitch-class occupancy, transition ratios, spectral centroid, Gamaka slopes/oscillation, DTW scores | Handles non-linear interactions and outputs well-calibrated feature importances |
| **GRU / LSTM (PyTorch)** | Temporal sequence of tonic-normalised F0 frames $p(t)$ + $\Delta p(t)$ derivatives | Captures temporal Aarohana/Avarohana phrasing and vakra turns |
| **1D CNN / ResNet** | Fixed-length pitch-contour windows or CQT/chromagram patches | Learns local Gamaka inflection motifs robustly |
| **Transformer** | Long-context melodic contour tokens / Svara sequence embeddings | Models long-range Pakad recurrence across Alap passages |

Feature extraction in Python may leverage **Librosa**, **Essentia** (e.g., Melodia / PredominantPitchMelodia), **Scikit-learn**, **XGBoost**, and **PyTorch**.

---

## 3. FastAPI Inference Contract (`RAGA_MODEL_API_URL`)

Set `RAGA_MODEL_API_URL` in the server environment (e.g., `http://127.0.0.1:8000/predict`).

### Request Payload (`POST`)
```json
{
  "traditionScope": "Hindustani",
  "tonicHz": 146.83,
  "tonicReliability": "high",
  "voicedRatio": 0.84,
  "features": { "...": "MelodicFeaturesResult" },
  "gamaka": { "...": "GamakaAnalysisResult" },
  "pakad": { "...": "PakadMatchingResult" }
}
```

### Expected Response Schema
```json
{
  "modelVersion": "hindustani-xgb-v1.0",
  "supportedClasses": ["yaman", "bhairav", "bhupali", "malkauns", "bhimpalasi", "desh", "kafi", "darbari_kanada"],
  "predictions": [
    { "ragaId": "yaman", "ragaName": "Yaman", "score": 0.84 },
    { "ragaId": "bhupali", "ragaName": "Bhupali", "score": 0.11 }
  ],
  "uncertainty": {
    "rejected": false,
    "reason": null
  }
}
```

If `predictions` are below confidence thresholds, closely tied, or `uncertainty.rejected` is `true`, SVARA withholds a definitive Raga claim and explains the ambiguity to the user.
