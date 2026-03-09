# Bitespeed Identity Reconciliation

A backend service that identifies and links customer contacts across multiple purchases, even when different emails or phone numbers are used.

## Live Endpoint

```
POST https://bitespeed-assessment-p45q.onrender.com/identify
```

> Update this URL after deploying to Render

---

## Problem Statement

FluxKart.com needed a way to link orders made with different contact information to the same person. This service exposes a `/identify` endpoint that consolidates customer identity by linking contacts that share an email or phone number.

---

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **ORM**: Prisma v5
- **Database**: PostgreSQL (Neon)
- **Hosting**: Render.com

---

## Run Locally

### 1. Clone the repo

```bash
git clone https://github.com/your-username/bitespeed-assessment.git
cd bitespeed-assessment
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the root:

```env
DATABASE_URL="your-postgresql-connection-string"
```

### 4. Run migrations

```bash
npx prisma migrate dev
```

### 5. Start the server

```bash
npm run dev
```

Server runs on `http://localhost:3000`

---

## API Reference

### POST `/identify`

Accepts an email, phone number, or both and returns a consolidated contact.

**Request Body**

```json
{
  "email": "doc@future.com",
  "phoneNumber": "123456"
}
```

Either field can be `null` but not both.

**Response**

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["doc@future.com"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": []
  }
}
```

---

## How It Works

### Case 1 — No existing contact
Creates a new primary contact and returns it.

### Case 2 — Match found with new information
Creates a secondary contact linked to the existing primary.

```
Request: { email: "mcfly@hillvalley.edu", phoneNumber: "123456" }

Before:  Contact(id:1, email:"lorraine@hillvalley.edu", phone:"123456", primary)
After:   Contact(id:1, primary) ← Contact(id:2, email:"mcfly@...", secondary)
```

### Case 3 — Two separate clusters linked by a request
The older primary stays primary. The newer primary gets demoted to secondary.

```
Request: { email: "george@hillvalley.edu", phoneNumber: "717171" }

Before:  Contact(id:11, george, primary)   Contact(id:27, biffsucks, primary)
After:   Contact(id:11, primary) ← Contact(id:27, secondary, linkedId:11)
```

---

## Project Structure

```
src/
  index.ts      # Express server and route
  identify.ts   # Core reconciliation logic
  prisma.ts     # Prisma client instance
prisma/
  schema.prisma # Contact model
```