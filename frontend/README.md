# Thokbazar — GitHub-ready marketplace

A Claude-free wholesale marketplace frontend served by an Express backend. The site uses standard HTML/CSS/JavaScript and REST API calls; no `claude.use()` APIs are required.

## Features
- Product search, categories, sorting, seller listings and seller desk
- Seller register/login with bcrypt password hashing and JWT authentication
- Product create/edit/delete with seller ownership checks
- Buyer enquiries and requirements
- Buyer requirements include **Customer name** and **Firm name**
- JSON file persistence for easy local setup
- GitHub Actions syntax check workflow

## Run locally
Requires Node.js 20+.

1. Copy `.env.example` to `.env`.
   - macOS/Linux: `cp .env.example .env`
   - Windows PowerShell: `Copy-Item .env.example .env`
2. Set `JWT_SECRET` in `.env` to a private random value at least 32 characters long.
3. Install and start:
   ```bash
   npm install
   npm run dev
   ```
4. Open http://localhost:3000. API health check: http://localhost:3000/api/health.

## GitHub upload
Create an empty repository on GitHub, then run in this project folder:
```bash
git init
git add .
git commit -m "Add Thokbazar marketplace"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```
Replace the URL with your repository URL.

## Important deployment notes
GitHub hosts source code, but does not run this Node server automatically. Deploy the app to a Node.js host and set `JWT_SECRET`, `PORT`, `DATA_DIR`, and `CORS_ORIGIN` in the host's environment settings. Use HTTPS and restrict CORS to trusted origins.

This starter stores data in a JSON file. Some cloud hosts have ephemeral filesystems, so use a persistent disk or migrate to a managed database before public production use. Back up data and review access to buyer phone numbers before launch.
