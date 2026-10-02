# BlockMed

BlockMed is a prescription-workflow demo built with React, Express, QuarkID and BSV overlays. It models doctors issuing prescriptions, patients sharing them with pharmacies, pharmacies recording dispensation, and patients confirming receipt. Insurance and credential-status features provide additional examples.

The repository is named `register`. It is a multi-service development project with local dependencies on a separate QuarkID workspace.

## Components

| Directory | Purpose |
| --- | --- |
| [front/](front/README.md) | React and Vite interface, actor selection and role-specific workflows. |
| [back/](back/README.md) | Express API, MongoDB storage, QuarkID agents and server wallet. |
| [overlay/](overlay/README.md) | DID and credential-status topic managers and lookup services. |
| `../Paquetes-NPMjs/` | External QuarkID package checkout required by local `file:` dependencies. |

The backend wallet is configured for **BSV mainnet in code**. Actor and credential operations can create transactions. The frontend's selected actor is demonstration state, and the backend's authentication middleware is configured to allow unauthenticated requests. Explore the workflow with fictional actors and sample prescription data.

## Requirements

- Node.js 22 and npm 9 or later. The frontend and backend declare Node versions below 24.
- Yarn Classic for the QuarkID workspace commands in the Makefile.
- Git access to the required QuarkID fork.
- MongoDB and a compatible Wallet Toolbox storage service.
- Docker with Compose for the bundled databases and overlay services.
- Your own server wallet keys and funding for transaction-based actions.

## Prepare the workspace

Clone the application and the fork referenced by its Makefile into sibling directories:

```sh
git clone https://github.com/bsv-blockchain-demos/register.git
git clone https://github.com/jonesjBSV/Paquetes-NPMjs.git
cd Paquetes-NPMjs
yarn install
yarn workspaces run build
cd ../register
npm install --prefix back
npm install --prefix front
npm install --prefix overlay
npm install --prefix overlay/backend
```

The external workspace is not pinned to a commit by this repository. Its version must remain compatible with the application's imports. No npm lockfiles are provided for these packages, so installation is less reproducible than a locked dependency setup.

The frontend's Vite configuration also has two QuarkID aliases pointing to `../../packages/...`, whereas package dependencies point to `../../Paquetes-NPMjs/packages/...`. Align those paths with the intended workspace before relying on the aliases. The [frontend guide](front/README.md) describes further configuration differences.

## Configure the services

Use [.env.example](.env.example) as a reference, then create component environment files with your own keys. For the local backend, `back/.env` needs settings such as:

```dotenv
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017
MONGODB_URI=mongodb://127.0.0.1:27017
APP_DB_NAME=quarkid_prescriptions_db
PLATFORM_FUNDING_KEY=<your-hex-private-key>
FEE_PER_KB=1
WALLET_STORAGE_URL=https://storage.babbage.systems
OVERLAY_PROVIDER_URL=http://localhost:8080
DID_TOPIC=tm_did
VC_TOPIC=tm_vc
PRESCRIPTION_TOPIC=prescriptions
```

Review [AppConfig.ts](back/src/config/AppConfig.ts) and the root example for additional credential and overlay settings. The bundled overlay registers `tm_did` and `tm_vc`; a `prescriptions` topic is not supplied by that deployment configuration, so prescription-specific overlay behaviour needs separate verification.

Create `front/.env.local`:

```dotenv
VITE_API_URL=http://localhost:3000
VITE_BACKEND_URL=http://localhost:3000
```

These configure the main API client and DID resolver. Some frontend code still contains fixed localhost endpoints or a `REACT_APP_API_URL` setting, so changing these values alone does not redirect every request.

## Start locally

Start MongoDB and a suitably configured overlay first. The root Compose file can start just its databases:

```sh
docker compose up -d db-mongo db-mysql
```

See the [overlay guide](overlay/README.md) before starting its containers. With the dependencies available, run the API and frontend in separate terminals from the repository root:

```sh
npm run dev --prefix back
```

```sh
npm run dev --prefix front
```

| Service | Default local address |
| --- | --- |
| Frontend development server | URL printed by Vite, normally `http://localhost:5173`. |
| Backend | `http://localhost:3000` |
| Overlay | `http://localhost:8080` |
| Root Compose frontend | `http://localhost:5174` |

The root Docker stack also includes database administration tools. Its backend reads `back/.env.docker`, and its overlay reads the root `.env`; those files must be prepared separately for that mode. The Compose configuration uses development credentials and should be reviewed before deployment.

## Demonstration workflow

1. Open actor setup and create a doctor, patient, pharmacy and insurance actor as needed.
2. Select the doctor and create a prescription for the patient.
3. Select the patient and share the prescription with a pharmacy.
4. Select that pharmacy and record dispensation.
5. Return to the patient and confirm receipt.

Actor selection is not a production sign-in flow. DID documents, credentials, token state and database records are separate parts of the example; a successful screen action does not independently establish a real clinical identity or prescription's validity.

## Checks and known setup gaps

```sh
npm run build --prefix back
npm run build --prefix front
npm run build:check --prefix front
npm run build --prefix overlay/backend
```

Backend and frontend installation/builds require the external QuarkID workspace. The backend defines Jest tests using database fixtures; inspect their setup before running them. The overlay backend has a test script but no checked-in test cases.

The convenience scripts need maintenance:

- `make build` contains the combined prerequisite `build-quarkidbuild-frontend`, so use the individual package commands above.
- `make setup-env` references component example files that are absent from the checkout.
- `setup.sh` updates and stashes an existing sibling checkout, clears the Yarn cache, generates keys and synchronises environment files. Review those effects before using it.
- The backend's `fund-platform` npm script points to a different location from the checked-in `src/scripts/fund-platform.ts`. Funding scripts request wallet transfers and are not ordinary startup commands.

## Licence

No root licence file is included. Overlay package metadata refers to `LICENSE.txt`, which is also absent from those packages. The intended terms require confirmation.
