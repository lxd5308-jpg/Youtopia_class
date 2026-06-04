# Youtopia Dance Academy — Class Management App

A web app for teachers and students at Youtopia Dance Academy. Built with React + Vite.

## Features

- **Role-based login** — Teacher and Student views via web or mobile devices
- **Teacher**: dashboard, weekly schedule, messaging, attendance export, student package tracking, auto-notifications
- **Student**: class enrollment, drop-in sign-up, leave requests, package usage tracking, payments
- **Payments** via Zelle, Venmo or cash
- **Export attendance** to Google Sheets

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 3. Build for production

```bash
npm run build
```

Output goes to the `dist/` folder.

---

## Deploying to GitHub Pages

1. Install the deploy helper:
   ```bash
   npm install --save-dev gh-pages
   ```

2. Add to `package.json` scripts:
   ```json
   "predeploy": "npm run build",
   "deploy": "gh-pages -d dist"
   ```

3. Also add your repo URL as `homepage` in `package.json`:
   ```json
   "homepage": "https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO_NAME"
   ```

4. Deploy:
   ```bash
   npm run deploy
   ```

---

## Deploying to Cloudfare 

Hosted in this website: https://youtopia-class.pages.dev/

---

## Connecting Real Auth (Google / WeChat)

### Google OAuth
- Create a project at [console.cloud.google.com](https://console.cloud.google.com)
- Enable Google Sign-In API
- Add your Client ID to `src/pages/LoginPage.jsx`
- Use `@react-oauth/google` or Firebase Auth

---

## Project Structure

```
src/
├── data/
│   └── mockData.js          # All sample data
├── components/
│   ├── AppShell.jsx          # Sidebar + topbar layout
│   └── AppShell.module.css
├── pages/
│   ├── LoginPage.jsx
│   ├── LoginPage.module.css
│   ├── teacher/
│   │   ├── Dashboard.jsx
│   │   ├── Schedule.jsx
│   │   ├── Messages.jsx
│   │   ├── Attendance.jsx
│   │   ├── Packages.jsx
│   │   ├── Notifications.jsx
│   │   ├── UploadSchedule.jsx
│   │   └── Payments.jsx
│   └── student/
│       ├── Dashboard.jsx
│       ├── Schedule.jsx
│       ├── Messages.jsx
│       ├── Package.jsx
│       └── Payments.jsx
├── App.jsx
├── main.jsx
└── index.css                 # Global design tokens + shared styles
```
