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
echo 📱 ACCESO DESDE DISPOSITIVOS MOVILES (Misma red Wi-Fi):
echo    - Para acceder desde el navegador de tu celular:
echo      Ejecuta 'ipconfig' para ver tu IPv4 local y abre:
echo      👉 http://<TU_IP_LOCAL>:4200
echo.
echo 🔐 Cuentas nominales de acceso:
echo    - Las cuentas se gestionan directamente en tu base de datos PostgreSQL.
echo    - Para crear o gestionar cuentas nominales desde terminal ejecuta:
echo      node app\backend\dist\scripts\mantenimiento-cuentas.js crear "Nombre" correo password ADMINISTRADOR^|TRABAJADOR
echo      node app\backend\dist\scripts\mantenimiento-cuentas.js listar
echo ========================================================================
echo Presiona cualquier tecla para cerrar esta ventana de inicio...
pause > nul
