@echo off
REM Real-time Collaborative Editor - Windows Commands
REM Batch file equivalent of Makefile for Windows systems

if "%1"=="" goto help
if "%1"=="help" goto help
if "%1"=="setup" goto setup
if "%1"=="start" goto start
if "%1"=="stop" goto stop
if "%1"=="logs" goto logs
if "%1"=="clean" goto clean
if "%1"=="health" goto health
if "%1"=="build" goto build
goto help

:help
echo Real-time Collaborative Editor - Windows Commands
echo.
echo Available commands:
echo   setup     - Copy .env.example to .env
echo   start     - Start all services in background
echo   stop      - Stop all services
echo   logs      - Show logs from all services
echo   clean     - Stop services and remove volumes
echo   health    - Check health of all services
echo   build     - Build all Docker images
echo.
echo Usage: run.bat [command]
echo Example: run.bat start
goto end

:setup
echo 🔧 Setting up environment...
if not exist .env (
    copy .env.example .env
    echo ✅ Environment file created (.env)
    echo 📝 Please edit .env with your configuration
) else (
    echo ⚠️  .env already exists
)
goto end

:start
call :setup
echo 🚀 Starting all services...
docker-compose up -d --build
echo ✅ All services started
echo 🌐 Frontend: http://localhost:5173
echo 🔌 WebSocket: ws://localhost:1234
echo 📡 Signaling: ws://localhost:3001
goto end

:stop
echo 🛑 Stopping all services...
docker-compose down
echo ✅ All services stopped
goto end

:logs
echo 📋 Showing logs from all services...
docker-compose logs -f
goto end

:clean
echo 🧹 Cleaning up...
docker-compose down -v --remove-orphans
echo ✅ Cleanup complete
goto end

:health
echo 🏥 Checking service health...
echo WebSocket Server:
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:1234/health' -UseBasicParsing; $json = $response.Content | ConvertFrom-Json; Write-Host '✅ WebSocket server healthy:' $json.status } catch { Write-Host '❌ WebSocket server not healthy' }"
echo.
echo Signaling Server:
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3001/health' -UseBasicParsing; $json = $response.Content | ConvertFrom-Json; Write-Host '✅ Signaling server healthy:' $json.status } catch { Write-Host '❌ Signaling server not healthy' }"
goto end

:build
echo 🏗️  Building Docker images...
docker-compose build
echo ✅ Build complete
goto end

:end
