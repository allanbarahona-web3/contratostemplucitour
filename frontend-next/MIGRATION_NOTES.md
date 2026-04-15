# Frontend Migration Notes (HTML -> Next.js + TS)

## Goal
Migrate incrementally inside this same repo using `frontend-next/` while keeping current `frontend/` stable until cutover.

## Already Reused (Stage 1)
- Brand assets copied to `frontend-next/public/assets/`
- Auth token convention: `contractsTempAuthToken`
- API base resolution logic (env + domain fallback + localhost)
- Login API contract (`POST /auth/login`)

## Reusable Modules From Current Frontend
- Contract domain model in `frontend/app.js`
  - Client/companions/minors payload shape
  - Itinerary item shape and constraints
  - Money/date calculations
- Contract template generators in `frontend/app.js`
  - `buildContractHtml`
  - `buildContractPdfHtml`
  - `buildMinorAnnexHtml`
- API endpoints already stable in backend
  - `/auth/*`
  - `/contracts`
  - `/contracts/:id/files`
  - `/contracts/public/*`
- Visual design tokens in `frontend/styles.css`

## Migration Order (Safe)
1. Login page (done)
2. Contracts form page (create contract flow only)
3. History page
4. Public signing page
5. Remove old static frontend after parity checks

## Recommended Module Split in Next.js
- `src/features/auth/`
- `src/features/contracts-form/`
- `src/features/history/`
- `src/features/public-signing/`
- `src/lib/api/` (fetch wrappers)
- `src/lib/validators/` (zod/yup validation)
- `src/lib/contracts/` (pure domain functions)

## Local Test Focus Before Staging
- Login success/failure
- Token persistence + logout
- API base resolution (localhost and domain fallback)
