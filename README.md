# ✶ Creator Studio
### AI Content Creation Platform — Editorial Meets Social Media Command Center

A full-featured local web app for creators, influencers, and brands. Features:
- Editorial magazine aesthetic with cream, warm browns, reds & yellows
- Mini AI companion that walks, dances, and chats with you
- 6 AI content generation tools powered by Groq
- Real-time viral trend tracking
- Smart content calendar
- Badges & streaks gamification
- QR code to open on your phone

---

## 🚀 Quick Start

```bash
# 1. Install
cd creator-studio
npm install

# 2. Add API key
cp .env.example .env
# Edit .env → GROQ_API_KEY=gsk_...

# 3. Start
npm start
```

Open: **http://localhost:3000**

---

## 📱 Open on Phone

1. Connect your phone to the **same WiFi** as your computer
2. Click **"📱 Open on Phone"** in the nav or dashboard sidebar
3. Scan the QR code with your phone camera
4. Full mobile experience opens immediately

---

## 🎭 The Mini Companion

| Action | What happens |
|--------|-------------|
| Upload photo in signup | Your face becomes the companion avatar |
| Watch it | Walks autonomously across the screen |
| Drag it | Reposition anywhere |
| Click it | Opens AI chat — ask anything |
| Generates content | Companion celebrates & comments |
| Trend card clicked | Companion gives niche-specific advice |

---

## ✨ Features

- **Hero Landing Page** — editorial split layout, floating animated cards
- **Onboarding Flow** — 4-step survey (name → niche → style/goals → photo)
- **Dashboard** — personalized with your niche & avatar
- **Content Builder** — 6 tools: hooks, captions, scripts, hashtags, ideas, schedule
- **Trend Tracker** — AI-powered viral trends by niche
- **Content Calendar** — visual monthly calendar with scheduled posts
- **Analytics** — growth stats & engagement chart
- **Badges** — gamification with locked/unlocked achievements
- **QR Modal** — scan to open on phone

---

## 🛠 Stack

- **Backend**: Node.js + Express
- **AI**: Groq (`llama-3.3-70b-versatile` + `llama-3.1-8b-instant`)
- **QR**: `qrcode` package — auto-detects your local IP
- **Frontend**: Pure HTML/CSS/JS — no build step needed

---

## 🎨 Design System

| Token | Value | Use |
|-------|-------|-----|
| `--cream` | #fdf6ec | Primary background |
| `--brown` | #3d2c1e | Primary text / dark surfaces |
| `--red` | #c94040 | Accent / CTAs |
| `--yellow` | #f5c842 | Highlights / streaks |
| `--blue` | #6ab3d4 | Secondary accent |
| `--green` | #7ec8a0 | Success / badges |

Fonts: **Playfair Display** (serif headlines) + **DM Sans** (body) + **Caveat** (handwritten doodles)
