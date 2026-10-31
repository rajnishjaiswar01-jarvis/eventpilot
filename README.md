# EventPilot — Adaptive Event Intelligence Platform

A production-quality GenAI-powered event planning SaaS built with Next.js, React, TypeScript and Google Gemini.

## Features

### Core
- **Dashboard** — Event overview, stats, demo data loader, data import/export
- **Create Event Wizard** — Zod-validated multi-step form supporting weddings, birthdays, college fests, conferences, community events, and more
- **Event Workspace** — Tabbed interface: Overview, Budget, Timeline, Tasks, Simulate, Vendors, Team, AI Planner

### Budget Management
- Integer minor-unit financial calculations (no floating-point errors)
- Add, edit, delete budget items across 11 categories
- Real-time budget utilisation and variance tracking

### Timeline Planner
- Chronological task display with dependency graph
- Topological sorting, cycle detection, scheduling conflict warnings
- Add, edit, delete tasks with priority and due dates

### Task Manager
- Status tracking: Pending → In Progress → Completed / Cancelled
- Priority levels: Low, Medium, High, Critical
- Task assignment to team members

### What-If Simulation
- Create independent scenario snapshots (deep copy)
- Modify guest count, total budget, and individual budget allocations
- Side-by-side comparison of original vs. scenario
- Promote (apply) or discard — original event never mutated without explicit confirmation

### AI Planner (Gemini-powered)
- Server-side Gemini API integration (API key never exposed to client)
- Generates structured event plans: budget allocations, timelines, tasks, vendor categories, theme ideas, risk assessment
- Zod schema validation + semantic business rule validation of AI output
- AI proposes → app validates → user approves

### Vendor & Team Management
- Vendor tracking with status pipeline and quoted/agreed amounts
- Team member roles, responsibilities, email and contact

### Data Management
- JSON export/import with full validation
- Schema-versioned localStorage persistence
- Corrupted data recovery (invalid events skipped, valid preserved)

## Tech Stack

| Layer          | Technology                          |
| -------------- | ----------------------------------- |
| Framework      | Next.js 16 (App Router)             |
| UI             | React 19, TypeScript (strict)       |
| Styling        | Tailwind CSS v4, custom components  |
| State          | Zustand                             |
| Validation     | Zod v4                              |
| AI             | Google Gemini API (server-side)     |
| Testing        | Vitest 5                            |
| Date Utilities | date-fns                            |

## Getting Started

### Prerequisites
- Node.js 18+
- A Google Gemini API key (optional — app works without AI features)

### Installation

```bash
npm install --legacy-peer-deps
```

### Environment Setup

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Gemini API key:

```
GEMINI_API_KEY=your_api_key_here
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Testing

```bash
npm test
```

### Production Build

```bash
npm run build
```

## Demo

1. Start the dev server (`npm run dev`)
2. Click **Load Demo Data** on the dashboard
3. This creates a sample "TechFest 2026" college festival with:
   - 500 attendees, ₹2,00,000 budget
   - 9 budget items across venue, catering, AV, marketing, etc.
   - 8 tasks with dependencies and varied statuses
   - 5 team members with distinct roles
   - 3 vendors at different stages
   - 3 identified risks with mitigations
4. Explore the event workspace tabs: Budget, Timeline, Tasks, Simulate, Vendors, Team
5. Try the **Simulate** tab to create a what-if scenario
6. Use the **AI Planner** tab to generate Gemini-powered recommendations (requires API key)
7. Use **Export** to save your data as JSON, and **Import** to restore it

## Architecture

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/ai/plan/        # Gemini API server route
│   ├── events/             # Event pages (list, new, [id] workspace)
│   └── layout.tsx          # Root layout
├── components/
│   ├── events/             # Feature components (budget-manager, timeline-planner, etc.)
│   ├── layout/             # App shell, sidebar, mobile nav
│   └── ui/                 # Reusable UI primitives (Button, Card, Dialog, etc.)
└── lib/
    ├── ai/                 # AI safety module (sanitisation, rate limiting)
    ├── constants/          # Display labels and mappings
    ├── engine/             # Business rules, dependency graph, simulation engine
    ├── schemas/            # Zod schemas (event, AI plan)
    ├── stores/             # Zustand store + localStorage persistence
    └── types/              # Domain types + Money utilities
```

## Known Limitations

- **Authentication**: Not implemented — all data is local to the browser
- **Database**: Uses localStorage (no server-side persistence)
- **Rate Limiting**: Process-local token bucket (not distributed)
- **AI Responses**: Validated but treated as untrusted; users must approve all recommendations
- **Vendor Prices**: AI-generated suggestions are estimates, not real market data

## License

Private — Hackathon submission.
