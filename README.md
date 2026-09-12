## Installation

1. **Clone or download** this project
2. **Install dependencies**:

   ```bash
   bun install
   ```

3. **Start the development server**:

   ```bash
   bun run dev
   ```

4. **Open** [http://localhost:3000](http://localhost:3000) in your browser

## Database configuration

1. **Install Prisma and Client/Prisma**

```bash
bun install prisma
```

```bash
bun install @prisma/client
```

2. **Add This line to .env**

```bash
DATABASE_URL="mongodb+srv://paokue:Pk123456@xaoxao-db.ugdiupy.mongodb.net/xaoxao?retryWrites=true&w=majority&appName=xaoxao-db"
```

3. **Run this command to push database to mongodb**

```bash
npx prisma generate
```

```bash
npx prisma db push
```

## Admin user

The dashboard has no public sign-up. The first admin is created by a seed
script, which also creates the `Super Admin` role and every permission
(19 menus x 4 actions: create, edit, view, delete) and links them all to
that role.

```bash
npx tsx scripts/seed-admin.ts
```

The script is safe to re-run: it skips the role, the user, the permissions
and the permission-role links if they already exist.

### Example admin user

These are the credentials the seed script creates. Sign in at
[/signin](http://localhost:3000/signin) — the login form matches on
**email**, not username.

| Field        | Value               |
| ------------ | ------------------- |
| Email        | `paokue@xaosao.com` |
| Password     | `Admin@1234`        |
| Username     | `paokue`            |
| Name         | Pao Kue             |
| Staff number | `XS-0001`           |
| Role         | Super Admin         |
| Status       | `active`            |
| Two-factor   | disabled            |

To seed a different admin, edit `ADMIN_DATA` at the top of
`scripts/seed-admin.ts` before running it. `number`, `tel` and `email` are
unique in the schema, so each admin needs its own values.

> **Change this password before the app is reachable by anyone else.** It
> ships in the repo, it grants every permission in the dashboard, and the
> `DATABASE_URL` above points at a shared Atlas cluster rather than a local
> MongoDB — so a default left in place is live, not just local.

## Migration Scripts

### Wallet Balance Migration

Recalculates all wallet balances based on transaction history to populate the new wallet fields (totalSpend, totalWithdraw, totalRefunded, totalPending).

```bash
npx tsx scripts/migrate-wallet-balances.ts
```

Or with ts-node:

```bash
npx ts-node scripts/migrate-wallet-balances.ts
```

## Tech Stack

- **Framework**: [Remix](https://remix.run)
- **UI Components**: [Radix UI](https://radix-ui.com)
- **Styling**: [Tailwind CSS](https://tailwindcss.com)
- **Icons**: [Lucide React](https://lucide.dev)
- **Forms**: [React Hook Form](https://react-hook-form.com)
- **Charts**: [Recharts](https://recharts.org)
- **TypeScript**: Full type safety

## Project Structure

```
app/
├── lib/
│   └── utils.ts              # Utility functions
├── routes/
│   ├── _index.tsx            # Landing page
│   ├── signin.tsx            # Sign in page
│   ├── dashboard.tsx         # Dashboard layout
│   └── dashboard._index.tsx  # Dashboard home
└── root.tsx                  # Root layout

components/
├── ui/                       # Base UI components
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   └── ... (40+ components)
├── dashboard-sidebar.tsx     # Dashboard navigation
├── dashboard-navbar.tsx      # Top navigation
└── ... (modal components)

styles/
└── globals.css              # Global styles and Tailwind CSS
```

### Theme Colors

The project uses CSS custom properties for theming. You can customize colors in `app/globals.css`:

```css
:root {
  --dark-pink: #ec4899;
  --purple: #8b5cf6;
  /* ... other colors */
}
```


## Still Call session, Wallet adjust and chat session.