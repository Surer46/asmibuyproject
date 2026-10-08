-- =========================================================================
-- MIGRACIÓN 005: PROTECCIÓN DE INTEGRIDAD PARA STOCK NUNCA NEGATIVO
-- Cumple con Criterios CW-04 y CW-06
-- Propietario: Integrante 2 (Catálogo e Inventario)
-- =========================================================================

-- Función de trigger para validar que la suma de existencias nunca sea negativa en movimientos
CREATE OR REPLACE FUNCTION trg_verificar_stock_no_negativo()
RETURNS TRIGGER AS $$
DECLARE
  saldo_calculado NUMERIC(10, 3);
BEGIN
  -- Bloquear la fila del ingrediente para serializar inserciones concurrentes de movimientos
  PERFORM id FROM ingredientes WHERE id = NEW.ingrediente_id FOR UPDATE;

  SELECT COALESCE(SUM(cantidad), 0) INTO saldo_calculado
  FROM movimientos_inventario
  WHERE ingrediente_id = NEW.ingrediente_id;

  IF saldo_calculado < 0 THEN
    RAISE EXCEPTION 'STOCK_NEGATIVO_NO_PERMITIDO: El saldo resultante (%) no puede ser negativo para el ingrediente ID %', saldo_calculado, NEW.ingrediente_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_stock_no_negativo ON movimientos_inventario;

CREATE CONSTRAINT TRIGGER trg_check_stock_no_negativo
AFTER INSERT ON movimientos_inventario
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION trg_verificar_stock_no_negativo();
