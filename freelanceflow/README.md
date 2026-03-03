# 💼 FreelanceFlow v2 — Setup & Deployment Guide

## 📁 Project Structure
```
freelanceflow/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx
    ├── firebase.js   ← You'll paste your Firebase config here
    └── App.jsx       ← The entire app
```

---

# 🔥 PART 1 — Firebase Setup (Google Login + Cloud Database)

### STEP 1 — Create a Firebase Account
1. Go to https://firebase.google.com
2. Click **"Get started"**
3. Sign in with your Google account

---

### STEP 2 — Create a New Project
1. Click **"Add project"**
2. Name it: `freelanceflow`
3. Disable Google Analytics (not needed) → Click **"Create project"**
4. Wait ~30 seconds → Click **"Continue"**

---

### STEP 3 — Add a Web App
1. On the project dashboard, click the **Web icon `</>`**
2. App nickname: `freelanceflow-web`
3. Click **"Register app"**
4. You'll see a code block like this — **COPY IT**:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "freelanceflow-xxxx.firebaseapp.com",
     projectId: "freelanceflow-xxxx",
     storageBucket: "freelanceflow-xxxx.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123:web:abc123"
   };
   ```
5. Click **"Continue to console"**

---

### STEP 4 — Paste Config into Your App
1. Open `src/firebase.js` in your code editor
2. Replace the placeholder values with your real values from Step 3
3. Save the file

---

### STEP 5 — Enable Google Login
1. In Firebase console, go to **Build → Authentication**
2. Click **"Get started"**
3. Under "Sign-in method", click **Google**
4. Toggle **Enable** → ON
5. Enter your email as "Project support email"
6. Click **Save** ✅

---

### STEP 6 — Set Up Firestore Database
1. In Firebase console, go to **Build → Firestore Database**
2. Click **"Create database"**
3. Select **"Start in test mode"** (we'll secure it later)
4. Choose a region close to Bangladesh (e.g. `asia-south1`)
5. Click **"Enable"** ✅

---

### STEP 7 — Set Firestore Security Rules
1. In Firestore, click the **"Rules"** tab
2. Replace the rules with this:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```
3. Click **"Publish"** ✅

This means: each user can ONLY see their OWN data. Nobody else can access it.

---

# 🚀 PART 2 — Deploy on Vercel (Free)

### STEP 8 — Create GitHub Account
1. Go to https://github.com
2. Click **"Sign up"**
3. Enter email, password, username → Verify email

---

### STEP 9 — Create Repository & Upload Files
1. Click **"+"** (top right) → **"New repository"**
2. Name: `freelanceflow` → Set to **Public** → Click **"Create repository"**
3. Click **"uploading an existing file"**
4. Upload ALL your files keeping the folder structure:
   ```
   index.html           ← upload directly
   package.json         ← upload directly
   vite.config.js       ← upload directly
   src/main.jsx         ← create src/ folder first
   src/firebase.js      ← inside src/ folder
   src/App.jsx          ← inside src/ folder
   ```
5. Click **"Commit changes"** ✅

---

### STEP 10 — Deploy on Vercel
1. Go to https://vercel.com
2. Click **"Sign Up"** → **"Continue with GitHub"**
3. Allow Vercel to access GitHub
4. On dashboard → Click **"Add New Project"**
5. Find `freelanceflow` → Click **"Import"**
6. Vercel auto-detects Vite. Verify:
   - Framework: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
7. Click **"Deploy"** 🚀
8. Wait ~1 minute...
9. 🎉 You get your FREE link like: `freelanceflow.vercel.app`

---

### STEP 11 — Add Your Domain to Firebase (IMPORTANT!)
After deploying, you need to tell Firebase your website URL:
1. Go to Firebase console → **Authentication → Settings**
2. Under **"Authorized domains"**, click **"Add domain"**
3. Add your Vercel URL: `freelanceflow.vercel.app`
4. Click **Add** ✅

Without this step, Google login won't work on your live site!

---

# ✅ Summary

| Step | What you do | Time |
|------|------------|------|
| 1-4  | Firebase project + config | 5 min |
| 5    | Enable Google login | 2 min |
| 6-7  | Firestore database + rules | 3 min |
| 8-9  | GitHub upload | 5 min |
| 10   | Deploy on Vercel | 2 min |
| 11   | Add domain to Firebase | 1 min |
| **Total** | | **~18 minutes** |

---

# 💡 How the SaaS Works

- Anyone can visit your link and sign in with Google
- Each user gets their OWN private data stored in Firebase
- Data syncs across all devices automatically
- You pay ৳0 forever (Firebase free tier supports 50,000 reads/day)

---

# 🆘 Common Issues

**"auth/unauthorized-domain" error?**
→ You forgot Step 11. Add your Vercel domain to Firebase authorized domains.

**Build fails on Vercel?**
→ Make sure you replaced the placeholder values in `firebase.js` with your real config.

**Data not saving?**
→ Check Firestore rules are published (Step 7).
