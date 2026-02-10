# 🌍 Real-Time Internet Outage Globe

## 🎯 What It Does

Track internet outages, submarine cable cuts, BGP routing issues, and DDoS attacks in real-time on an interactive 3D globe. Watch failures ripple across regions with stunning visualizations.

## ✨ Features

- 🌐 **Live 3D Globe** - Real-time outage markers on interactive Earth
- 🔌 **Submarine Cables** - Track undersea infrastructure cuts and disruptions
- 🔄 **BGP Visualization** - Animated routing paths showing network issues
- 💫 **Ripple Effects** - Watch failures propagate across regions
- ⏮️ **Time Travel** - Replay and analyze last 24 hours of incidents
- 🔍 **Detailed Info** - Click any event for comprehensive incident data
- 🎯 **Smart Filtering** - Filter by outages, cable cuts, BGP leaks, DDoS
- 📊 **Live Dashboard** - Real-time statistics and metrics

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Go 1.21+
- PostgreSQL 15+
- Redis 7+

## 🛠️ Tech Stack

### Frontend
- React 18 + TypeScript
- Three.js + React Three Fiber
- Tailwind CSS
- Vite

### Backend
- Go + WebSockets
- PostgreSQL + TimescaleDB
- Redis Cache

### Deployment
- Frontend: Vercel
- Backend: Fly.io

## 📁 Project Structure

```
internet-outage-globe/
├── frontend/           # React + Three.js frontend
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── hooks/      # Custom hooks
│   │   ├── services/   # API & WebSocket
│   │   └── utils/      # Helper functions
│   └── public/         # Static assets
├── backend/            # Go backend
│   ├── cmd/           # Entry points
│   ├── internal/      # Core logic
│   │   ├── api/       # REST handlers
│   │   ├── websocket/ # WebSocket server
│   │   └── models/    # Data models
│   └── configs/       # Configuration
├── database/
│   ├── migrations/    # DB migrations
│   └── seeds/         # Seed data
└── docs/              # Documentation
```


## 📚 Documentation

- [Architecture Overview](docs/architecture.md)
- [API Documentation](docs/api-documentation.md)
- [Contributing Guide](CONTRIBUTING.md)

## 👥 Team

- **[Sarada Mohanty]** - [@github-username](https://github.com/username)
- **[Swagat Mohanty]** - [@github-username](https://github.com/username)
- **[Rudra Prakash Jena]** - [@github-username](https://github.com/username)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Three.js](https://threejs.org/) - 3D graphics library
- [Cloudflare Radar](https://radar.cloudflare.com/) - Internet data
- [RIPE NCC](https://www.ripe.net/) - Network data

---

<div align="center">

**[Report Bug](../../issues)** • **[Request Feature](../../issues)** • **[Documentation](docs/)**

Made with ❤️ for network engineers worldwide-

⭐ **Star this repo** if you find it useful!

</div>
