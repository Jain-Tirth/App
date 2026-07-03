# DHOBI MATRIMONY --- ENGINEERING BLUEPRINT (Version 3.0)

> This document is the implementation guide for the project.
>
> - This document is the single source of truth.
> - Do not invent features.
> - Do not remove features.
> - Do not simplify flows.
> - Build exactly what is described.
> - If something is unclear, ask instead of assuming.

---

# Technology Stack

## Mobile

- React Native (Expo SDK)
- Expo Router
- TypeScript
- React Query
- Zustand
- React Hook Form
- Zod

## Backend

- NestJS
- PostgreSQL
- Prisma ORM
- Socket.IO
- JWT Authentication

## Storage

- AWS S3
- Firebase Cloud Messaging

## Admin Panel

- React
- Tailwind CSS

## Website

- Next.js

## Deployment

- Docker
- Nginx

---

# Development Rules

- Build one phase at a time.
- Never rewrite completed modules.
- Never change database schema without a migration.
- Use Prisma with PostgreSQL.
- Keep backend, mobile, admin panel and website independent.
- Follow feature-based architecture.
- Use reusable components.
- Use TypeScript everywhere.
- Every phase must compile before moving to the next.
- Follow the database schema, business rules and UI exactly as
  specified.

---

# React Native Folder Structure

    mobile-app/
    │
    ├── app/
    ├── src/
    │   ├── api/
    │   ├── assets/
    │   ├── components/
    │   ├── constants/
    │   ├── features/
    │   ├── hooks/
    │   ├── providers/
    │   ├── services/
    │   ├── store/
    │   ├── theme/
    │   ├── types/
    │   └── utils/

---

# Replace These Technologies

  Old                      New

---

  Flutter                  React Native (Expo SDK)
  Dart                     TypeScript
  Riverpod                 React Query + Zustand
  Go Router                Expo Router
  \*.dart models           types/\*.ts
  Flutter services         services/\*.ts
  Raw SQL implementation   Prisma ORM

---

# Database

Use Prisma ORM with PostgreSQL.

The database schema, relationships, constraints, tables and business
logic remain EXACTLY the same as defined in the original specification.

Do not modify any tables unless instructed.

---

# Build Order

Use the original build order from the specification with only one
change:

Replace every Flutter implementation task with React Native (Expo SDK).

Example:

- Flutter Registration → React Native Registration
- Flutter Chat → React Native Chat
- Flutter Photo Upload → React Native Photo Upload

Everything else remains unchanged.

---

# Important

The original project specification remains authoritative for:

- All 27 features
- Every registration screen
- Every field
- Every workflow
- Every database table
- Admin panel
- Website
- Security
- Matching engine
- Chat
- Notifications
- Membership
- Build phases
- Business rules

This document only updates the implementation technology.
