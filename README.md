# cadim

A full-stack application with a **Rust** backend and **React** frontend communicating via REST API.

## Project Structure

```
cadim/
├── backend/          # Rust (Axum) REST API server
│   ├── Cargo.toml
│   └── src/
│       └── main.rs
├── frontend/         # React + TypeScript (Vite) client
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── App.css
│       └── index.css
└── README.md
```

## Getting Started

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (1.75+)
- [Node.js](https://nodejs.org/) (18+)

### Start the Backend

```bash
cd backend
cargo run
```

The API server starts at **http://localhost:3001**.

### Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server starts at **http://localhost:5173** and proxies `/api` requests to the backend.

## API Endpoints

| Method | Endpoint       | Description               |
|--------|---------------|---------------------------|
| GET    | `/api/health` | Health check              |
| GET    | `/api/items`  | Get list of sample items  |
