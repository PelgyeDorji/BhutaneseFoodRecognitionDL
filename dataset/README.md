# Dataset

Images live here locally and are not committed. Suggested layout, one folder per class, using the
slugs from `backend/app/services/dishes.py`:

```
dataset/
  raw/ema_datshi/  raw/kewa_datshi/  ...
  splits/train/  splits/val/  splits/test/
```

Keep near-duplicate photos (same plate, same sitting) in the same split.
