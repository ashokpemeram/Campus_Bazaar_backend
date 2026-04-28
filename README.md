# Campus_Bazaar_backend

## Price Prediction (Regression Model)

This backend can use the bundled regression model at `models/price_model.pkl` to power the existing endpoint:

- `POST /api/ai/suggest-price`

### Prerequisites

- Python 3 installed (available as `python` in your PATH)
- Install Python dependencies:
  - `pip install -r ml/requirements.txt`

### Environment Variables (Optional)

- `PRICE_MODEL_ENABLED` (`true`/`false`, default: `true`)
- `PRICE_MODEL_PYTHON` (default: `python`)
- `PRICE_MODEL_PATH` (default: `models/price_model.pkl`)
- `PRICE_MODEL_TIMEOUT_MS` (default: `15000`)

## Image Uploads (Cloudinary optional)

This backend currently supports:

- Local uploads stored in `Campus_Bazaar_backend/uploads` and served from `GET /uploads/...`
- Cloudinary uploads (recommended for production / hosting where local disk may be ephemeral)

### Enable Cloudinary

1. Install dependency:
   - `npm i cloudinary`
2. Set env:
   - `USE_CLOUDINARY=true`
   - `CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>`
     - or set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - Optional: `CLOUDINARY_FOLDER=campus-bazaar`

When enabled, new product images and avatars are stored as Cloudinary URLs in MongoDB. Existing stored filenames continue to work.
