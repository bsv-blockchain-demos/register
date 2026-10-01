# BlockMed Frontend

React interface for the BlockMed prescription workflow in `register`. It includes actor setup, role-specific dashboards, prescription sharing and fulfilment, a DID resolver and QR scanning.

The application depends on the [backend](../back/) and wallet integrations described in the [project README](../README.md).

## Setup prerequisites

Use Node.js 22 and npm 9 or later. The package declares support for Node.js versions from 18 up to, but excluding, 24.

This frontend is not self-contained. Its package manifest references local QuarkID packages in a sibling checkout:

```text
workspace/
  register/
    front/
  Paquetes-NPMjs/
    packages/
```

Prepare the required QuarkID workspace and its builds before installing this frontend. The repository [Makefile](../Makefile) contains the `install-quarkid` and `build-quarkid` targets and uses Yarn for workspace setup.

The Vite configuration also points two QuarkID aliases at `../../packages/...`, while the package manifest uses `../../Paquetes-NPMjs/packages/...`. These paths should be aligned with the intended workspace before relying on those aliases. A clean checkout of this repository alone is insufficient to validate the full setup.

## Frontend configuration

Once the external workspace is available, run from the repository root:

```sh
cd front
npm install
```

Create `front/.env.local`:

```dotenv
VITE_API_URL=http://localhost:3000
VITE_BACKEND_URL=http://localhost:3000
```

`VITE_API_URL` is the base for the main API service, which adds `/v1/...` paths. `VITE_BACKEND_URL` is used by the DID resolver. Start the backend separately, then run:

```sh
npm run dev -- --host 127.0.0.1
```

Open the URL printed by Vite, normally `http://localhost:5173`.

Configuration is currently inconsistent: [config.ts](src/config.ts) reads `process.env.REACT_APP_API_URL`, and the insurance dashboard contains fixed localhost endpoints. Setting the two Vite variables does not redirect every request. Those code paths need adjustment for a different backend or deployment origin.

## Routes and behaviour

- `/login` selects an actor; `/setup` opens actor management.
- `/dashboard` displays the appropriate actor dashboard.
- Administrative routes include `/actors`, `/prescription-dashboard`, `/qr-scanner` and `/did-resolver`.

The frontend stores the selected actor in `localStorage` and derives its route access from that actor's role. This is demonstration state, not proof of authentication or server-side authorisation. Use sample identities and prescription data when exploring the workflow.

Wallet-backed actions can create BSV transactions. Their operation also depends on a compatible wallet and the configured backend and overlay services.

## Build commands

```sh
npm run build
npm run build:check
npm run lint
npm run preview -- --host 127.0.0.1
```

`build` runs Vite only. `build:check` runs TypeScript checking before Vite. Successful builds write `dist/`. No frontend test script is defined. Installation and builds require the external QuarkID packages described above.

## Source guide

- [App.tsx](src/App.tsx): routes and navigation.
- [AuthContext.tsx](src/context/AuthContext.tsx): actor selection and persistence.
- [AppContext.tsx](src/context/AppContext.tsx): application workflow state.
- [services/](src/services/): API, DID, credential, token and wallet integration.
