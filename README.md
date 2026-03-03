# Bitespeed Identity Reconciliation API

This is a backend web service built for the Bitespeed Backend Task. It implements an identity reconciliation system that manages customer identities across different channels (email, phone number) and links them together to form a consolidated view.

## Live Demo
The API is fully deployed and accessible at:
👉 **[https://bitespeed-assignment-vert.vercel.app](https://bitespeed-assignment-vert.vercel.app)**

---

## How to Test the API

The primary endpoint for this service is `/identify`. It only accepts `POST` requests containing JSON payloads.

### 1. Using cURL (Command Line)
You can copy and paste these commands directly into your terminal to test the live API.

**Test Case 1: Creating a new primary contact**
```bash
curl -X POST https://bitespeed-assignment-vert.vercel.app/identify \
-H "Content-Type: application/json" \
-d "{\"email\": \"lorraine@hillvalley.edu\", \"phoneNumber\": \"123456\"}"
```

**Test Case 2: Adding a secondary contact (matching email, new phone)**
```bash
curl -X POST https://bitespeed-assignment-vert.vercel.app/identify \
-H "Content-Type: application/json" \
-d "{\"email\": \"lorraine@hillvalley.edu\", \"phoneNumber\": \"123456789\"}"
```

**Test Case 3: Searching with only a phone number**
```bash
curl -X POST https://bitespeed-assignment-vert.vercel.app/identify \
-H "Content-Type: application/json" \
-d "{\"phoneNumber\": \"123456789\"}"
```

### 2. Using Postman / Insomnia
If you prefer a visual tool like Postman:
1. Open Postman and create a new request.
2. Change the method from `GET` to **`POST`**.
3. Enter the URL: `https://bitespeed-assignment-vert.vercel.app/identify`
4. Go to the **Body** tab.
5. Select **raw** and choose **JSON** from the dropdown.
6. Paste the following payload and click Send:
   ```json
   {
       "email": "lorraine@hillvalley.edu",
       "phoneNumber": "123456"
   }
   ```

---

## Tech Stack
* **Language**: TypeScript / Node.js
* **Framework**: Express.js
* **Database**: PostgreSQL (Hosted on Render/Supabase)
* **ORM**: Prisma
* **Deployment**: Vercel (Serverless Functions)

## Features Implemented
- [x] Create new primary identity records
- [x] Link secondary identities using matching emails or phone numbers
- [x] Consolidate isolated primary identities if a new request bridges them together
- [x] Dynamic response consolidation aggregating all emails and phone numbers across the identity cluster
