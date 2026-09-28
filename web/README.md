# ixiscope

The block explorer for the Ixian platform: search, blocks, transactions, addresses, a live globe of the network, statistics, supply and emissions.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static site in out/ (upload it to the static host)
npm run typecheck
```

## Data

The app reads everything through `src/data/source.ts`.

- **Demo data (default):** a seeded, deterministic mock chain (`src/data/mock/`). Every page shows a "Demo data" marker. Add `?mock=slow` or `?mock=error` to any URL to see loading and error states.
- **Real data:** build with `NEXT_PUBLIC_IXISCOPE_SOURCE=api` and `NEXT_PUBLIC_IXISCOPE_API=https://<explorer host>/ixiscope-api`. The API is the PHP folder `ixiscope-api/` at the repository root, which runs on the explorer server and reads the explorer's database; its README has the install steps.

## Layout

```
src/app/            routes: /, /blocks, /block, /tx, /address, /network, /stats, /ixi, /search
src/components/     shell, search (omnibox + palette), globe, charts, tables, views, ui
src/data/           types (the contract), source (adapter), api, mock, emission schedule, geo
src/lib/            address checks (Base58, SHA-512, SHA3-512), formatting, hooks, links
src/styles/         ixian.io tokens and reset, globals
```

Design tokens, the logo mark and `sha3.ts` come from the ixian.io repository.
