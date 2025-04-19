# Tennis App

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Setup Process

1. Download & install [Node.js](https://nodejs.org/)

2. Run the following command in terminal
```bash
npx create-next-app@latest your_ project_name --typescript --eslint --app
```

3. When prompted, select the following options:
```
√ Would you like to use Tailwind CSS? ... Yes
# --> yes (in line custom css styling)

√ Would you like your code inside a `src/` directory? ... Yes
# --> yes (better organization)

√ Would you like to use Turbopack for `next dev`? ... Yes
# --> yes (this allows for faster compile in dev env)

√ Would you like to customize the import alias (`@/*` by default)? ... Yes
# --> yes (simplifies import lines)

√ What import alias would you like configured? ... @/*
# --> just hit enter (default config)
```

## Tech Stack

### Production
- **React** - Frontend UI library
- **Tailwind CSS** - Utility-first styling framework
- **Next.js** - Full-stack React framework for the backend and routing

### Staging / Potential
- **Framer Motion** - Custom animations and transitions
- **NodeMailer** - Email notifications system
- **Go (Language)** - Fleshed out faster backend (this is the spice)

## Getting Started

Run the development server:

```bash
npm run dev
# --> starts the Next.js development server with hot reloading
# --> runs on http://localhost:3000 by default
# --> automatically recompiles and refreshes when files change
# --> uses Turbopack for faster compile times in development
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

This project uses:
- [Next.js](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Typed JavaScript
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [ESLint](https://eslint.org/) - Code linting

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# Courtly

A modern full-stack platform to manage court reservations and private lesson bookings for racquet sports facilities. Designed to support multiple locations, member accounts, coach scheduling, and lesson package purchases.

---

## 🧠 Background

Racquet sports like tennis, pickleball, and squash are growing in popularity, putting pressure on facilities to manage reservations more efficiently. This project aims to provide a modern, scalable system to:

- Reserve courts by time slots
- Book private lessons with coaches
- Support lesson package bundles
- Handle multiple locations and user roles (Admin, Coach, Member)

---

## 🚀 Tech Stack

- **Frontend**: React + Next.js (App Router)
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (hosted via Neon/Supabase)
- **ORM**: Prisma
- **Auth**: NextAuth.js (role-based)
- **Deployment**: Vercel

---

## 🧱 Architecture Overview

### Key Components

- **Auth Service**: Role-based auth (Admin, Coach, Member)
- **Reservation Service**: Court & lesson bookings
- **Coach Service**: Availability and profiles
- **Admin Service**: Facility and package configuration

### Data Model Highlights

- `User`, `Location`, `Court`, `Reservation`
- `CoachProfile`, `CoachAvailability`
- `LessonPackage`, `MemberPackage`, `LessonBooking`

---

## 📆 Booking Flows

### Court Reservation
1. Member selects sport + location
2. Views court availability
3. Confirms booking → saved in `Reservation`

### Private Lesson
1. Member views coach availability
2. Selects package (if available)
3. Books → lesson deducted from `MemberPackage`

---

## 📦 Lesson Packages

- Members can purchase bundles (e.g., 5 lessons)
- Packages may expire (e.g., 60 days)
- Multiple packages supported per member
- Bookings deduct from earliest valid package

---

## 🛠️ Implementation Plan

### Milestones

1. **Setup**: Project scaffolding, DB, Vercel config
2. **Auth**: NextAuth with roles
3. **Admin: Facilities & Courts**
4. **Coaches & Lesson Packages**
5. **Booking Logic**: Courts + Lessons
6. **Member Dashboard**
7. **Notifications + QA**
8. **Go-Live**: Seed data, deploy

---

## 👥 Team Collaboration Plan (2 Devs)

### Developer A – *Backend & Logic*
- DB Schema (Prisma)
- API Routes
- Auth System
- Booking Rules (court & lesson)
- Testing + Seeding

### Developer B – *Frontend & UI*
- Next.js pages + routes
- Admin & Member Dashboards
- Booking UI
- Package Management UI
- Email UX & Polishing

### Shared Tasks
- Booking flow integration
- Manual testing
- Production readiness

---

## ✅ Done Criteria

- Users can log in and manage bookings
- Admins can configure courts, coaches, and packages
- Members can book courts and lessons using packages
- Booking conflicts are prevented
- Deployed and functional on Vercel

---

## 🧪 Future Enhancements

- Payment integration (Stripe)
- Mobile-native app
- Waitlists & advanced rescheduling
- Usage analytics dashboard