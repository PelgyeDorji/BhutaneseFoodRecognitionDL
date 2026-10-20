# Model

Training happens in Google Colab (GPU) or Jupyter.

- `notebooks/`: data exploration, preprocessing and augmentation, the from-scratch CNN, the transfer
  learning model (MobileNetV2 or ResNet50), and the evaluation (accuracy, precision, recall, F1,
  confusion matrix, failure cases).
- `saved_models/`: the exported `.keras` file. Not committed (it's large); share it through Drive or
  a GitHub release, and point `MODEL_PATH` in `.env` at it.

Write down the exact input size and normalisation used in training: the backend must apply the same
steps in `backend/app/services/predictor.py`.
