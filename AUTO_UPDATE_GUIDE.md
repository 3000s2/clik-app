# CLIK Auto-Update Setup Guide

This guide explains how to set up automatic updates for CLIK using GitHub Releases.

## Overview

When you publish a new version to GitHub Releases, users will:
1. See a notification banner inside the app ("Version X.X.X is available")
2. Click "Download" to download the update in the background
3. Click "Restart & Update" to install and restart

---

## Step 1: Create a GitHub Repository

1. Go to https://github.com/new
2. Create a new repository (e.g., `clik-app`)
3. Note your **username** (or org name) and **repo name**

## Step 2: Update package.json

Open `package.json` and replace `OWNER` and `REPO` in the publish config:

```json
"publish": [
  {
    "provider": "github",
    "owner": "your-github-username",
    "repo": "clik-app"
  }
]
```

## Step 3: Create a GitHub Personal Access Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give it a name like "CLIK Auto Update"
4. Select scope: `repo` (full control of private repositories)
5. Click "Generate token"
6. Copy the token (you won't see it again)

## Step 4: Set the Token as Environment Variable

**Windows (Command Prompt):**
```cmd
set GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

**Windows (PowerShell):**
```powershell
$env:GH_TOKEN = "ghp_xxxxxxxxxxxxxxxxxxxx"
```

**Mac/Linux:**
```bash
export GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

To make it permanent on Windows:
1. Search "Environment Variables" in Start menu
2. Click "Edit the system environment variables"
3. Click "Environment Variables"
4. Under User variables, click "New"
5. Variable name: `GH_TOKEN`
6. Variable value: your token

## Step 5: Bump Version & Publish

Every time you want to release an update:

### 5a. Update the version number in `package.json`:
```json
"version": "1.3.0"
```

Version must be higher than the previous release (semver format: MAJOR.MINOR.PATCH).

### 5b. Build and publish:

**Windows:**
```cmd
npm run electron:publish:win
```

**Mac:**
```cmd
npm run electron:publish:mac
```

This will:
1. Build the Vite frontend
2. Package the Electron app
3. Create an installer (NSIS for Windows, DMG for Mac)
4. Upload the installer + `latest.yml` to a GitHub Release draft

### 5c. Go to GitHub → Releases

1. You'll see a draft release with your uploaded files
2. Add release notes (what changed in this version)
3. Click "Publish release"

That's it. All users running the previous version will now see the update notification.

---

## How It Works (Technical)

1. On app startup (3 seconds after launch), the app calls `autoUpdater.checkForUpdates()`
2. `electron-updater` fetches `latest.yml` from your GitHub Releases
3. If a newer version exists, it sends an "update-available" event to the renderer
4. The UI shows a banner with "Download" button
5. When the user clicks Download, the update downloads in the background
6. After download completes, "Restart & Update" button appears
7. Clicking it calls `autoUpdater.quitAndInstall()` which restarts the app
8. The app also checks every 4 hours automatically

---

## Version Workflow Example

```
Current version: 1.2.0 (installed on user's machine)

You fix a bug:
1. Make code changes
2. Change package.json version to "1.2.1"
3. Run: npm run electron:publish:win
4. Go to GitHub, publish the draft release

User opens the app:
→ Banner appears: "Version 1.2.1 is available"
→ User clicks Download
→ Banner changes: "Downloading update... 45%"
→ Download completes: "Version 1.2.1 ready to install"
→ User clicks "Restart & Update"
→ App restarts with new version
```

---

## Sidebar UI

- Bottom of sidebar shows: `v1.2.0` and a "Check update" link
- Users can manually trigger an update check by clicking it
- The version number comes from `package.json`

---

## Troubleshooting

**"Error: No published versions on GitHub"**
→ You haven't published a release yet. The first version must be installed manually.

**"Update error: net::ERR_..."**
→ User has no internet or GitHub is blocked. Updates require internet.

**Token not working**
→ Make sure the token has `repo` scope and is set as `GH_TOKEN` environment variable before running the publish command.

**Users not seeing updates**
→ The installed version must have the same `appId` as the published version. Don't change `com.clik.customs-logistics` in package.json.

**Testing locally**
→ Auto-update only works in packaged (production) builds, not in dev mode (`npm run electron:dev`). To test, build with `npm run electron:build:win`, install it, then publish a newer version.

---

## Private Repositories

If your GitHub repo is private, users need a token too. You have two options:

**Option A: Make the repo public** (recommended for free updates)

**Option B: Use a generic S3/server instead of GitHub:**
Change the publish config in package.json:
```json
"publish": [
  {
    "provider": "generic",
    "url": "https://your-server.com/releases"
  }
]
```
Then upload the release files (installer + latest.yml) to that URL.

---

## File Structure After Publish

GitHub Release will contain:
```
CLIK Setup 1.2.0.exe       ← Windows installer
latest.yml                   ← Version metadata (electron-updater reads this)
```

The `latest.yml` file is auto-generated by electron-builder and contains the version, file hash, and download URL. Do not edit it manually.
