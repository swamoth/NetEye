# NetEye - Real-Time Internet Outage Visualization

A modern web application for tracking and visualizing internet outages, submarine cable disruptions, BGP routing anomalies, and DDoS attacks in real-time using an interactive 3D globe interface.

## Overview

NetEye provides network engineers and infrastructure teams with a comprehensive view of global internet health. The application aggregates data from multiple sources and presents it through an intuitive 3D visualization, enabling rapid identification and analysis of network incidents.

### Key Features

- **Interactive 3D Globe** - Real-time visualization of network outages on a responsive WebGL globe
- **Submarine Cable Monitoring** - Track undersea infrastructure status and cable cut incidents
- **BGP Route Analysis** - Visualize routing path changes and autonomous system disruptions
- **Incident Propagation** - Animated visualization showing how failures spread across regions
- **Historical Replay** - Review and analyze incidents from the past 24 hours
- **Detailed Incident Reports** - Comprehensive information available for each detected event
- **Advanced Filtering** - Filter by incident type (outages, cable cuts, BGP issues, DDoS)
- **Live Statistics Dashboard** - Real-time metrics and KPI monitoring

## Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **3D Graphics**: Three.js + React Three Fiber
- **Styling**: Tailwind CSS
- **State Management**: React Hooks
- **Build Tool**: Next.js built-in

### Backend
- **Runtime**: Node.js
- **API**: Next.js API Routes
- **Real-time**: WebSocket (Socket.io)
- **Database**: PostgreSQL with TimescaleDB extension
- **Cache**: Redis

### Data Sources
- Cloudflare Radar
- RIPE NCC
- Custom aggregation services

### Deployment
- **Platform**: Vercel (Frontend + API Routes)
- **Database**: Hosted PostgreSQL (e.g., Supabase, Railway)
- **Cache**: Redis Cloud or Upstash

## Project Structure

```
neteye/
├── app/                          # Next.js App Router
│   ├── components/               # React components
│   │   ├── Globe.tsx            # 3D globe visualization
│   │   ├── OutageMarker.tsx     # Incident markers on globe
│   │   ├── Dashboard.tsx        # Statistics sidebar
│   │   ├── OutageDetail.tsx     # Incident detail modal
│   │   └── Timeline.tsx         # Historical playback controls
│   ├── hooks/                   # Custom React hooks
│   │   ├── useOutages.ts        # WebSocket connection management
│   │   └── useGeoData.ts        # Geographic data processing
│   ├── utils/                   # Utility functions
│   │   ├── coordinates.ts       # Lat/long calculations
│   │   ├── api.ts              # API client functions
│   │   └── types.ts            # TypeScript type definitions
│   ├── api/                     # API routes
│   │   ├── outages/route.ts     # Outage data endpoints
│   │   └── health/route.ts      # Health check endpoints
│   └── page.tsx                 # Main application page
├── server/                      # Server-side logic
│   ├── websocket.js            # WebSocket server implementation
│   └── aggregator.js           # Data aggregation from sources
├── lib/                        # Shared utilities
│   └── db.ts                   # Database connection
├── public/                     # Static assets
│   └── earth-texture.jpg       # Globe texture asset
├── docs/                       # Documentation
│   ├── architecture.md         # System architecture
│   └── api-documentation.md    # API reference
├── .env.local                  # Environment variables (local)
├── .env.example                # Environment variables template
├── .gitignore                  # Git ignore rules
├── next.config.js              # Next.js configuration
├── package.json                # Dependencies
├── tsconfig.json              # TypeScript configuration
└── README.md                   # This file
```

## Prerequisites

Before running the project, ensure you have the following installed:

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 9.0.0 or higher (or yarn/pnpm)
- **Git**: Latest version

Optional (for full functionality):
- **PostgreSQL**: Version 15+ (for local database)
- **Redis**: Version 7+ (for local cache)

## Quick Start

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/swamoth/neteye.git
   cd neteye
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and add your configuration values.

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open the application**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Create a `.env.local` file with the following variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/neteye

# Redis
REDIS_URL=redis://localhost:6379

# API Keys (for data sources)
CLOUDFLARE_API_KEY=your_key_here
RIPE_API_KEY=your_key_here

# WebSocket
WS_PORT=3001
```

## Development Guide

### Running Tests

```bash
npm test
```

### Building for Production

```bash
npm run build
```

### Linting

```bash
npm run lint
```

## Team Collaboration Guide

This section provides step-by-step instructions for team members to contribute to the NetEye project.

### Initial Setup

1. **Fork the repository** (if working on personal fork)
   - Visit the repository on GitHub
   - Click the "Fork" button in the top-right corner
   - This creates a copy under your GitHub account

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/neteye.git
   cd neteye
   ```

3. **Add upstream remote** (to sync with original repository)
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/neteye.git
   ```

4. **Verify remotes**
   ```bash
   git remote -v
   ```
   You should see:
   - `origin` pointing to your fork
   - `upstream` pointing to the original repository

### Daily Development Workflow

1. **Sync with upstream** (before starting work)
   ```bash
   git checkout main
   git fetch upstream
   git merge upstream/main
   git push origin main
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
   Use descriptive branch names:
   - `feature/add-cable-filter`
   - `bugfix/globe-zoom-issue`
   - `update/readme-typo`

3. **Make your changes**
   - Edit files
   - Test locally with `npm run dev`
   - Follow existing code style

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add submarine cable filtering"
   ```
   Use conventional commit messages:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `style:` - Code style changes (formatting)
   - `refactor:` - Code refactoring
   - `test:` - Adding tests
   - `chore:` - Maintenance tasks

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

### Creating a Pull Request

1. **Navigate to the repository** on GitHub

2. **Click "New Pull Request"**
   - GitHub usually shows a prompt: "Compare & pull request"
   - Or go to Pull Requests tab → New Pull Request

3. **Configure the PR**
   - Base: `main` branch of original repository
   - Compare: Your feature branch

4. **Fill in the PR template**
   ```
   ## Description
   Brief description of what this PR does

   ## Changes Made
   - List of specific changes
   - Another change

   ## Testing
   - How you tested the changes
   - Test results

   ## Screenshots (if applicable)
   [Add screenshots for UI changes]

   ## Related Issues
   Fixes #123
   ```

5. **Submit the PR**
   - Click "Create Pull Request"
   - Request review from team members
   - Wait for CI checks to pass

6. **Address review comments**
   - Make requested changes
   - Commit and push to the same branch
   - The PR updates automatically

7. **Merge**
   - Once approved, merge the PR
   - Delete the feature branch after merging

### Code Review Guidelines

When reviewing PRs:

- **Check functionality**: Does it work as intended?
- **Code quality**: Is the code clean and maintainable?
- **Performance**: Are there any performance concerns?
- **Security**: Any potential security issues?
- **Tests**: Are tests included and passing?

Use GitHub's review features:
- "Approve" - Ready to merge
- "Request changes" - Needs modifications
- "Comment" - Neutral feedback

### Handling Merge Conflicts

If you encounter conflicts:

1. **Fetch latest changes**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Resolve conflicts**
   - Open conflicting files
   - Look for `<<<<<<<`, `=======`, `>>>>>>>` markers
   - Edit to keep desired changes
   - Remove conflict markers

3. **Complete the rebase**
   ```bash
   git add .
   git rebase --continue
   ```

4. **Push changes**
   ```bash
   git push origin feature/your-feature-name --force-with-lease
   ```

### Best Practices

- **Pull frequently**: Sync with main branch often
- **Small commits**: Make focused, atomic commits
- **Clear messages**: Write descriptive commit messages
- **Test locally**: Always test before pushing
- **One feature per PR**: Keep PRs focused and reviewable
- **Update documentation**: Update docs if you change functionality
- **Be respectful**: Provide constructive feedback in reviews



