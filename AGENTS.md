# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

This is **Aisymetry** (`clawgpt`) — a Next.js (Pages Router) single-page onboarding experience with a particle-based canvas animation and an API route that optionally calls Anthropic Claude to generate personalized capability statements.

### Running the app

```bash
npm run dev    # starts Next.js dev server on http://localhost:3000
npm run build  # production build
npm start      # production server (requires build first)
```

The main page is at `/onboarding`.

### Key caveats

- **Next.js v16 removed `next lint`**: The `npm run lint` script (`next lint`) does not work because Next.js v16 dropped this subcommand. ESLint v9 is installed but requires an `eslint.config.js` (flat config) file to be created before `npx eslint` will work.
- **No automated tests**: The project has no test framework or test files.
- **No lock file committed**: `package.json` pins all deps to `"latest"`, so `npm install` will always fetch the newest versions. A `package-lock.json` is generated at install time.
- **Anthropic API key is optional**: The `/api/onboarding-capabilities` route returns hardcoded fallback capability statements when `ANTHROPIC_API_KEY` is not set. Set it in `.env.local` or as an environment variable to get personalized responses from Claude.
- **Node.js**: Installed via nvm. Run `export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"` to ensure `node`/`npm` are available in new shells if nvm isn't automatically sourced.
