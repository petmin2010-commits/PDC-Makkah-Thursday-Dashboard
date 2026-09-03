@echo off
chcp 65001 > nul
cd /d "%~dp0"
if not exist ".env" (
  echo [!] ملف .env غير موجود.
  echo انسخ .env.example إلى .env وضع SPREADSHEET_ID أولاً.
  pause
  exit /b 1
)
if not exist "credentials.json" (
  echo [!] ملف credentials.json غير موجود.
  echo ضع ملف Google Service Account داخل هذا المجلد باسم credentials.json.
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo جاري تثبيت المكتبات لأول مرة...
  call npm install
  if errorlevel 1 pause & exit /b 1
)
echo تشغيل PDC Makkah Website...
start "" http://localhost:3000
call npm start
pause
