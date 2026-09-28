@echo off
title Utilidad de Respaldo y Restauracion PostgreSQL (Supabase Free)
echo ========================================================================
echo 💾 UTILIDAD DE RESPALDO Y RESTAURACION POSTGRESQL (TAREA W1-05)
echo ========================================================================
echo.
echo Para exportar la base de datos de Supabase Free con pg_dump:
echo    pg_dump "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" -F c -b -v -f respaldo_asmibuy.dump
echo.
echo Para restaurar en una base de datos aislada de pruebas:
echo    pg_restore -d "postgresql://postgres:[PASSWORD]@localhost:5432/asmibuy_test" -v respaldo_asmibuy.dump
echo.
echo ========================================================================
pause
