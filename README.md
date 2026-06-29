# The River Map

An interactive tool for mapping the belief journey from cold prospect to converted client — with AI-powered feedback from Claude.

## Deploy to Vercel

1. Import this repo into [Vercel](https://vercel.com)
2. Add environment variable: `ANTHROPIC_API_KEY` = your Anthropic API key
3. Set custom domain: `rivermap.jessmiller.co`
4. Deploy

Vercel auto-detects the `api/` directory as serverless functions and serves `public/` as static files.

## Local dev

```
ANTHROPIC_API_KEY=sk-ant-... node server.js
```

Open `http://localhost:3000`
