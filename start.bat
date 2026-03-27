@echo off
echo ========================================
echo  Census Explorer - Starting Services
echo ========================================
echo.

REM Check for .env
if not exist .env (
    echo ERROR: .env file not found. Copy .env.example to .env and fill in your keys.
    pause
    exit /b 1
)

echo [1/3] Starting Census MCP database (Docker)...
docker compose up -d census-mcp-db
timeout /t 5 /nobreak >nul

echo [2/3] Starting backend (FastAPI)...
cd backend
start "Census Explorer Backend" cmd /k "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
cd ..

echo [3/3] Starting frontend (Vite)...
cd frontend
start "Census Explorer Frontend" cmd /k "npm run dev"
cd ..

echo.
echo ========================================
echo  Census Explorer is starting!
echo  Frontend: http://localhost:5173
echo  Backend:  http://localhost:8000
echo  API Docs: http://localhost:8000/docs
echo ========================================
pause
