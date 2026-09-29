# DataPhi CRM: Sign-in (SSO) guide for beginners

This guide explains how to run the CRM with the new login, how to switch to real Microsoft login when IT gives you the details, and what to do when something goes wrong. No technical background needed. Copy and paste the commands exactly.

---

## 1. What changed, in plain English

- When you open the CRM you now see a DataPhi **login page** first. Nobody gets into any CRM page or data without signing in.
- **Demo mode (today):** a fake Microsoft login for testing on your own computer. You pick a test person from a list. It refuses to work on any real server.
- **Microsoft mode (later):** the real "Sign in with Microsoft" button. Switch to it when IT gives you the Tenant ID, Client ID and Client Secret. That is the only thing missing.
- Microsoft only proves **who** someone is. A table called `users` decides **whether they may enter and what role they have** (Admin, Executive, Team Lead, Sales Rep). Nobody is added automatically: an Admin must add each person first.
- The top bar now shows the signed-in person's name and role, and a **Sign out** button.
- If a session ends while someone is working (or an Admin deactivates them), the next click sends them back to the login page.

Nothing about how the CRM works with accounts, leads, opportunities and so on was changed.

---

## 2. One-time setup on this computer

Already done for you inside the project folder: the Python packages (`backend\.venv`), the website packages (`frontend\node_modules`) and a built copy of the website (`frontend\dist`). The CRM database (PostgreSQL) is already running on this computer as a Windows service, so you do **not** need Docker.

The only thing you must install yourself is **Node.js** (needed only when you change the website's screens, not for everyday running):

1. Press the Windows key, type **PowerShell**, open it.
2. Run: `winget install OpenJS.NodeJS.LTS`
3. Close PowerShell and open a new one. Check it worked: `node --version`

---

## 3. Run the CRM (simplest way, one window)

1. Open PowerShell.
2. Go to the backend folder:
   ```
   cd "C:\Users\UdgeethDeglurkar\Desktop\CRM\CRM-Portal---React-main\backend"
   ```
3. Start the CRM:
   ```
   .\.venv\Scripts\python.exe -m uvicorn main:app --port 8000
   ```
   Wait for the line `Application startup complete.` A yellow "DEMO MODE" notice is normal.
4. Open **http://localhost:8000** in your browser.
5. You land on the login page. Choose **Demo Admin** and press **Continue as demo user**. You arrive at the Voice Station, and your name, role and **Sign out** appear top right.
6. To stop the CRM, click the PowerShell window and press **Ctrl + C**.

**If you change the website's screens** (files under `frontend\src`), rebuild it once, then restart step 3:
```
cd "C:\Users\UdgeethDeglurkar\Desktop\CRM\CRM-Portal---React-main\frontend"
npm run build
```

**Developer way (live reload, two windows):** window 1 runs step 3. Window 2 runs `cd ...\frontend` then `npm run dev`, and you open **http://localhost:5173** instead. Both work.

### What "working" looks like (a 2-minute check)
1. Open http://localhost:8000/accounts while signed out. You must be sent to the login page.
2. Sign in as Demo Admin. You reach the CRM.
3. Click Accounts, Contacts, Leads. Pages load with no red error message.
4. Click **Sign out**. You are on the login page. Now open http://localhost:8000/voice. You are sent to login again.

### The demo people
| Pick this | Role |
|---|---|
| Demo Admin | Admin |
| Demo Executive | Executive |
| Demo Team Lead | Team Lead |
| Demo Sales Rep | Sales Rep |

These four live in the `users` table only while `AUTH_MODE=demo`. They are deleted automatically when you switch to Microsoft mode.

---

## 4. Switch to real Microsoft login (when IT sends the details)

### 4a. What to ask IT
Send IT this message:

> I need an Entra ID (Azure AD) **App registration** for our internal DataPhi CRM. Single tenant. Platform: Web. Redirect URIs: `http://localhost:8000/auth/callback` (testing) and, later, `https://<our-crm-address>/auth/callback`. Permission: Microsoft Graph **User.Read** (delegated). Please send me the **Directory (tenant) ID**, the **Application (client) ID**, and a **client secret Value**.

If you have Azure access yourself, do it yourself as below.

### 4b. Azure steps (portal.azure.com)
1. **Microsoft Entra ID > App registrations > New registration.**
   Name: `DataPhi CRM`. Supported account types: **Accounts in this organizational directory only**. Redirect URI: platform **Web**, value `http://localhost:8000/auth/callback`. Click Register.
2. On the **Overview** page copy **Application (client) ID** and **Directory (tenant) ID**.
3. **Authentication > Add URI**: also add `http://localhost:8000/login` (this is where Microsoft sends people after sign-out). If you use the developer way (port 5173), also add `http://localhost:5173/auth/callback` and `http://localhost:5173/login`. Save.
4. **Certificates & secrets > New client secret.** Copy the **Value** column immediately (it is shown only once). Do **not** copy "Secret ID". Note the expiry date: the login breaks the day it expires, so put a reminder in your calendar.
5. **API permissions:** `User.Read` should already be there. If IT's rules require it, click **Grant admin consent**.
6. Optional but recommended: **Enterprise applications > DataPhi CRM > Properties > Assignment required = Yes**, then assign only the people or group who should have the CRM. That gives two locks: Microsoft, and the `users` table.

### 4c. Edit the `.env` file
Open `backend\.env` in Notepad and set:
```
AUTH_MODE=microsoft
TENANT_ID=<Directory (tenant) ID>
CLIENT_ID=<Application (client) ID>
CLIENT_SECRET=<the secret Value>
SESSION_SECRET=<see next step>
```
Make a `SESSION_SECRET` (a long random password that signs the login cookies). Run this and paste the result:
```
cd "C:\Users\UdgeethDeglurkar\Desktop\CRM\CRM-Portal---React-main\backend"
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"
```
Never share `.env` or commit it to Git (it is already git-ignored).

### 4d. Add the real people (nobody gets in otherwise)
In the same backend folder, for each person (use their **Microsoft work sign-in email**):
```
.\.venv\Scripts\python.exe -m auth_service.seed_user add rahul@yourcompany.com "Rahul Sharma" "Sales Rep"
.\.venv\Scripts\python.exe -m auth_service.seed_user list
.\.venv\Scripts\python.exe -m auth_service.seed_user deactivate rahul@yourcompany.com
```
Roles allowed: `Admin`, `Executive`, `Team Lead`, `Sales Rep`. **Add yourself first as Admin.**

### 4e. Restart and test
Restart the CRM (Ctrl + C, then step 3 again). The login page now shows **Sign in with Microsoft**. Sign in with your work account. If your email is not in the `users` table you'll see a message that includes exactly which email to add.

### 4f. Errors you might meet
| Message | Meaning and fix |
|---|---|
| **AADSTS50011** redirect URI does not match | The address in Azure differs from the one in your browser. They must match exactly, including `http`, `localhost` and the port. Add the missing one under Authentication, and check `REDIRECT_URI` in `.env`. |
| **AADSTS7000215** invalid client secret | You copied "Secret ID" instead of the **Value**, or the secret expired. Make a new secret and paste the Value. |
| **AADSTS700016** application not found | Wrong `CLIENT_ID` or `TENANT_ID`. |
| **AADSTS50020** user account from another tenant | The person is not in your organisation (for example a personal Microsoft account). Use a work account. |
| **AADSTS50105** user not assigned to the app | "Assignment required" is on and this person was not assigned (step 6 above). |
| **AADSTS65001** consent required | Ask IT to click Grant admin consent (step 5). |
| "signed in to Microsoft but has no CRM account" | Not an error in Microsoft. Add that email with `seed_user add` (step 4d). |
| "Your login attempt expired" | You took more than 10 minutes, or you started on `localhost` and came back on `127.0.0.1`. Always use the same address. Click Sign in again. |
| "AUTH_MODE=microsoft needs these values in .env" | One of `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET` is empty. |
| "SESSION_SECRET is too weak" | Generate one as in step 4c. |
| "Cannot reach the database" | PostgreSQL is not running. Press Windows key, type Services, find **postgresql-x64-16**, Start. (Docker users: `docker compose up -d`.) |
| "Only one usage of each socket address..." | Port 8000 is already used, usually by a CRM window you forgot to close. Close it, or use `--port 8001`. |

To go back to demo mode any time, set `AUTH_MODE=demo` (only allowed with a localhost address).

---

## 5. Automated tests (the safety net)

Run these after any change to the login or the CRM routes. You should see all tests pass.
```
cd "C:\Users\UdgeethDeglurkar\Desktop\CRM\CRM-Portal---React-main\backend"
.\.venv\Scripts\python.exe -m pytest tests -q
cd "C:\Users\UdgeethDeglurkar\Desktop\CRM\dataphi-sso"
..\CRM-Portal---React-main\backend\.venv\Scripts\python.exe -m pytest tests -q
```
- `backend\tests` proves that **every** `/api/...` route refuses a signed-out visitor, that pages redirect to login, and that `/login` works. If a developer later adds an API route and forgets the login check, this test fails and names the route.
- `dataphi-sso\tests` covers the login module: demo flow, Microsoft flow (Microsoft is faked), mobile token checks, settings checks. They use a temporary throw-away database, never your real one.

---

## 6. Before real users touch it (production checklist)

1. **HTTPS.** Serve the CRM only over `https://` (through IIS, nginx, Azure App Service, or similar). Set `COOKIE_SECURE=true` in `.env`. Register the `https://` redirect URIs in Azure and update `REDIRECT_URI` and `POST_LOGOUT_REDIRECT_URI`.
2. **Demo mode must be off** (`AUTH_MODE=microsoft`). It already refuses to start on a non-localhost address, but double-check.
3. **Secrets.** `SESSION_SECRET` and `CLIENT_SECRET` belong in the hosting platform's secret store (Azure Key Vault, etc.), not in a file people can copy. Rotate the client secret before it expires.
4. **Session length.** Default is 8 hours (`SESSION_MAX_AGE_SECONDS=28800`). Shorten it if your policy requires. Deactivating a user in the `users` table already takes effect on their very next click, not after 8 hours.
5. **Logout protection (CSRF).** Sign-out is currently a plain link (`GET /auth/logout`), so another website could sign someone out by embedding it. It is a nuisance rather than a break-in. Before go-live, change it to a POST request with a CSRF token.
6. **Rate limiting.** Add limits on `/auth/login`, `/auth/callback` and `/auth/mobile/exchange` (for example in nginx `limit_req`, an API gateway, or the `slowapi` package) to blunt brute-force and flooding.
7. **Roles are not enforced on CRM actions yet.** Today anyone signed in can do everything in the CRM. `require_role("Admin", ...)` exists in the module for you to protect specific actions once the business decides who may do what.
8. **Security headers** on the server or proxy: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, a Content-Security-Policy. And narrow `CORS_ORIGINS` to your real site address.
9. **Keep the app registration single-tenant**, with **Assignment required** on.
10. **Mobile app (later):** the app signs in with Microsoft itself (MSAL, PKCE), sends the ID token to `/auth/mobile/exchange`, and then calls the CRM with `Authorization: Bearer <token>`. In Azure add platform **Mobile and desktop applications** for it. The CRM already accepts this; only the app is missing.

---

## 7. Things I noticed that you should know

- **`backend\requirements.txt` is out of date.** It still lists Whisper, torch and transformers (huge downloads, and `main.py` does not use them), but `main.py` actually needs `boto3`, `amazon-transcribe` (and optionally `imageio-ffmpeg`). I only *added* the SSO packages to it and did **not** touch the rest. The working environment in `backend\.venv` was built from what the code really imports. Someone on the team should tidy that file.
- **Voice recording still needs your AWS setup** (AWS credentials on this computer, plus ffmpeg, which `imageio-ffmpeg` provides). That is unrelated to sign-in.
- **The CRM already had its own `user` and `role` tables** (empty). The login uses a separate `users` table, as the design specified. Later, someone should decide whether to link them, so records can store *who* created them (`created_by` is not filled from the login yet).
- **The notification bell stores its list in the browser**, not per person. On a shared computer, the next person to sign in would see the previous person's notifications.
- **The top-left logo** in the CRM bar (`frontend\public\site-logo.svg`) is white text on a white pill, so the word "DataPhi" is hard to read. It was like that before; a dark version of the logo would fix it. The login page uses the placeholder logo until you set `LOGO_URL` in `.env` to the official logo's address.
- `/health` (a simple "is it alive" check) is deliberately left open, because monitoring tools call it without signing in.
