# BlockMed Backend

Express API for the BlockMed prescription demo. It combines QuarkID agents, MongoDB records, a server BSV wallet, DID resolution, verifiable credentials and token-based prescription workflows.

Start with the [project setup guide](../README.md). This package is not self-contained: its QuarkID dependencies are `file:` references into a sibling `Paquetes-NPMjs` checkout.

## Setup

Use Node.js 22 and npm 9 or later. Prepare and build the QuarkID workspace before installing this package:

```sh
npm install
```

Run this command from `back/`. There is no checked-in npm lockfile.

Create `back/.env` using the component configuration in the [root guide](../README.md#configure-the-services). The server loads this file through `dotenv/config`.

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | Main MongoDB connection, default `mongodb://localhost:27017`. |
| `APP_DB_NAME` | Main database name, default `quarkid_prescriptions_db`. |
| `MONGODB_URI` | Additional MongoDB setting used by other service paths. Keep it aligned with the intended instance. |
| `PORT` | HTTP port, default `3000`. |
| `PLATFORM_FUNDING_KEY` | Required 64-character hex private key for the server wallet. |
| `FEE_PER_KB` | Required positive fee setting. |
| `WALLET_STORAGE_URL` | Wallet storage, default `https://storage.babbage.systems`. |
| `OVERLAY_PROVIDER_URL` | Overlay endpoint. Replace the placeholder default. |
| `DID_TOPIC`, `VC_TOPIC` | DID and credential topics. Match the overlay's `tm_did` and `tm_vc` registrations. |
| `PRESCRIPTION_TOPIC` | Prescription topic, default `prescriptions`; not registered by the bundled overlay configuration. |
| `DWN_URL` | Optional decentralised web node endpoint. |

[AppConfig.ts](src/config/AppConfig.ts) validates core settings. [app.ts](src/app.ts) builds the wallet on **mainnet** regardless of the root example's `NETWORK` variable. It waits for remote wallet storage and MongoDB during startup.

```sh
npm run dev
```

The development command executes `tsx src/app.ts`; it does not enable file watching. The API normally listens at `http://localhost:3000`. `GET /` returns a service overview and `GET /health` reports service state.

## API areas

Routes are registered in [src/app.ts](src/app.ts). Refer to handlers for the current request and response shapes.

| Prefix | Responsibility |
| --- | --- |
| `/v1/actors`, `/v1/enhanced/actors` | Demonstration actors and their DID-related records. |
| `/v1/dids` | DID creation, updates and resolution. |
| `/v1/vcs` | Verifiable credential operations. |
| `/v1/prescriptions`, `/v1/enhanced/prescriptions` | Prescription workflows. |
| `/v1/tokens`, `/v1/vc-tokens` | Token and credential-status operations. |
| `/v1/fraud-prevention` | Experimental insurance/fraud-prevention workflows. |
| `/v1/dwn` | Storage and sharing helpers. |
| `/v1/status` | Credential-status records. |
| `/register` | Registration handlers. |

The package also includes a fallback subject lookup. It should not be used as a substitute for checking the concrete route implementations.

## Development boundaries

The demo permits unauthenticated requests and logs request bodies. Some identity/fraud-prevention paths include placeholder fallbacks. These are development behaviours, not verified clinical access controls. Use fictional data and review authentication, authorisation and logging before exposing an instance.

The server key and MongoDB records are operational state. Keep them together when preserving a funded demonstration. Scripts under [src/scripts/](src/scripts/) can generate keys, create actors, clear records or request wallet funding; review each script and its target configuration before running it.

## Build and tests

```sh
npm run build
npm start
```

The build compiles TypeScript to `dist/`, and `start` runs `dist/app.js`.

Jest is configured through [jest.config.js](jest.config.js), with fixtures in [src/tests/](src/tests/). Several suites use MongoDB Memory Server, while the global setup also loads `back/.env`. The complete dependency setup, including the external QuarkID workspace, is required before running:

```sh
npm test -- --runInBand
```

The package's `fund-platform` script currently points outside `src/scripts/` and does not match the checked-in funding helper. It is not part of build or test setup.
