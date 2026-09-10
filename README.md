# ULTRON

Advanced futuristic AI assistant project.

## Project Structure

```text
ULTRON
├── backend
│   ├── config
│   │   └── config.js
│   ├── controllers
│   │   └── aiController.js
│   ├── middleware
│   │   └── errorHandler.js
│   ├── routes
│   │   ├── statusRoutes.js
│   │   └── aiRoutes.js
│   ├── services
│   │   └── aiService.js
│   ├── utils
│   │   └── logger.js
│   ├── server.js
│   ├── package.json
│   └── package-lock.json
│
├── frontend
│   ├── index.html
│   ├── style.css
│   └── app.js
│
└── README.md

# ULTRON 2.0 — One-Click Runtime

## Start
Double-click **START_ULTRON.bat**.
It checks Node.js, installs dependencies on first run if needed, starts the backend, waits for `/api/status`, and opens the HUD at `http://127.0.0.1:3000/`.

## Stop
Double-click **STOP_ULTRON.bat** to stop the ULTRON server process started by the launcher.

## Advanced capabilities
- Provider-backed AI with existing Ollama/Google/OpenAI architecture
- Persistent memory
- Current web search/research pipeline
- Trusted Windows desktop controls
- Sequential task planner/orchestrator
- System telemetry and diagnostics
- Skills registry API
- Safe ULTRON workspace inspection
- Advanced task API for supported commands
- Browser launch/open-web capabilities already present in the command layer
- Browser speech recognition + speech synthesis
- Auto Voice mode that keeps recognition alive until STOP
- Existing programmed commands and responses remain in the project

## Important
The launcher does not create or overwrite `.env`. Keep your own `.env` beside `package.json`. Never commit API keys.

## Verification
Run:
`npm test`

Expected:
`ULTRON smoke test: PASS`
