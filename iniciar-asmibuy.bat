@echo off
title Asmibuy MVP Web Movil - Plataforma de Alimentos (4-C)
echo ========================================================================
echo 🍔 INICIANDO ASMIBUY MVP: ANGULAR + EXPRESS + POSTGRESQL (SUPABASE)
echo ========================================================================
echo.
echo 1. Iniciando Servidor API Express en el puerto 3001...
start "Asmibuy API Backend" cmd /k "cd app\backend && npm start"

echo 2. Iniciando Aplicacion Web Angular en el puerto 4200 (Disponible en red local)...
start "Asmibuy Web Frontend" cmd /k "cd app\frontend && npm start"

echo.
echo ========================================================================
echo ✅ Servicios iniciando en ventanas independientes:
echo.
echo 💻 Acceso desde esta Computadora:
echo    - Aplicacion Web : http://localhost:4200
echo    - API REST Salud : http://localhost:3001/api/v1/health
echo.
echo 📱 ACCESO DIRECTO DESDE TU CELULAR (Misma red Wi-Fi):
echo    - En el navegador de tu celular abre:
echo      👉 http://10.3.1.17:4200
echo.
echo 🔑 Credenciales para iniciar sesion:
echo    - Administrador: admin@asmibuy.com  / Admin1234!
echo    - Trabajador   : cajero@asmibuy.com / Cajero1234!
echo ========================================================================
echo Presiona cualquier tecla para cerrar esta ventana de inicio...
pause > nul
