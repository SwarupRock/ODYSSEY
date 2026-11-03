@rem ODYSSEY — command-line build helper (no Android Studio needed).
@rem Falls back to a locally installed Gradle. Android Studio users don't
@rem need this file at all (open the android/ folder and press Run).
@echo off
setlocal
where gradle >nul 2>nul
if %errorlevel% neq 0 (
  echo gradle was not found on PATH.
  echo Easiest path: open this android folder in Android Studio and press Run.
  exit /b 1
)
gradle %*
