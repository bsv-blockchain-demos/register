# BlockMed Quick Start Guide

## 🚀 Get Running in 5 Minutes

### Prerequisites
- Node.js 20+, Yarn, Docker, Git
- (Optional) [Metanet Desktop Wallet](https://metanet.bsvb.tech/) for funding

---

## Option 1: Automated Setup (Recommended) ⭐

```bash
# Clone the repository
git clone git@github.com:sirdeggen/register.git
cd register

# Run the setup script (handles everything)
./setup.sh

# Fund your platform wallet (requires BRC-100 wallet running)
cd back && npx tsx src/scripts/fund-platform.ts

# Start with Docker
cd .. && make docker-up
```

**That's it!** Visit [http://localhost:5174](http://localhost:5174)

---

## Option 2: Using Make Commands

```bash
# Clone and enter directory
git clone git@github.com:sirdeggen/register.git
cd register

# One command setup and run
make quickstart
```

---

## Services Available At

- **Frontend:** [http://localhost:5174](http://localhost:5174)
- **Backend API:** [http://localhost:3000](http://localhost:3000)
- **Overlay (LARS):** [http://localhost:8080](http://localhost:8080)
- **MongoDB Admin:** [http://localhost:8082](http://localhost:8082)
- **MySQL Admin:** [http://localhost:8081](http://localhost:8081)

---

## Seed Demo Data

```bash
cd back
npx tsx src/scripts/seedActors.ts
```

This creates sample actors (doctor, patient, pharmacy, insurance) for testing.

---

## Common Commands

```bash
# View Docker logs
make docker-logs

# Stop all services
make docker-down

# Restart services
make docker-down && make docker-up

# Run locally (without Docker)
make run

# Check status
make status
```

---

## Troubleshooting

### Docker build fails?
```bash
make docker-clean && make docker-build
```

### Backend won't start?
```bash
cd back && npx tsx src/scripts/generate-keys.ts
```

### Need to fund wallet?
```bash
cd back && npx tsx src/scripts/fund-platform.ts
```

### QuarkID packages not found?
```bash
cd .. && git clone git@github.com:jonesjBSV/Paquetes-NPMjs.git
cd register && make install-quarkid build-quarkid
```

---

## What's New in This Refactoring?

✅ **Fixed Docker race conditions** - No more random build failures!
✅ **Added BSV wallet scripts** - Automated key generation and funding
✅ **One-command setup** - `./setup.sh` handles everything
✅ **Shared base image** - Faster, more reliable builds
✅ **Better documentation** - Clear instructions and troubleshooting

---

## Need More Help?

- **Full Documentation:** See [README.md](README.md)
- **Technical Details:** See [REFACTORING_SUMMARY.md](REFACTORING_SUMMARY.md)
- **Make Commands:** Run `make help`
- **BSV Wallet Setup:** See scripts in [back/src/scripts/](back/src/scripts/)

---

**Happy Building! 🎉**
