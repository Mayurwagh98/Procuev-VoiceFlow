# Procucev Assignment — Submission & Deployment Checklist

## 1. Push to GitHub
```bash
cd procucev-realtime-stt
git init
git add .
git commit -m "feat: real-time multilingual STT app with Node.js, WebSockets, and PostgreSQL CRUD"
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/procucev-realtime-stt.git
git push -u origin main
```

## 2. Deploy to Cloud (1-Click on Render.com)
1. Push the repository to GitHub.
2. Log in to [Render.com](https://render.com) -> **New** -> **Blueprint**.
3. Select your `procucev-realtime-stt` repository (it will automatically read `render.yaml` and provision both the Node.js Web Service and a free PostgreSQL database).
4. *(Optional)* Add `GEMINI_API_KEY` in Render Environment Variables if you want Gemini Live 3.1 server-side streaming enabled. Even without it, Browser Live STT works out of the box.

## 3. Submission Email Template
- **To:** `prerna.shrivastava@procucev.com`
- **CC:** `anshul.goel@procucev.com`
- **Subject:** `Procucev AI Tech Hiring Assignment Submission - <Your Full Name>`

```text
Hi Prerna and Anshul,

Please find my submission for the Procucev AI Tech Hiring Assignment (Real-Time Multilingual Speech-to-Text Web Application built with Node.js, Express, WebSockets, and PostgreSQL):

- GitHub Repository: <YOUR_GITHUB_REPO_URL>
- Deployed Application: <YOUR_DEPLOYED_APP_URL>

Here are my answers to the screening questions:

1. Location / Relocation (Bangalore on-site): <Yes, willing to relocate / based in Bangalore / WFH preference>
2. Prior Internships: <Details of your internships, or "None">
3. Full-time Availability: <Yes, available full-time>
4. Current CTC & Expected CTC: <Current CTC> / <Expected CTC>
5. Git Experience & Last 5 Pull Requests:
   - <PR Link 1>
   - <PR Link 2>
   - <PR Link 3>
   - <PR Link 4>
   - <PR Link 5>
6. Immediate Joiner: <Yes / Notice period details>
7. AI Coding Agents Used: <e.g., GitHub Copilot, Antigravity, Kiro, Cursor, etc.>

Best regards,
<Your Full Name>
<Your Phone / LinkedIn>
```
