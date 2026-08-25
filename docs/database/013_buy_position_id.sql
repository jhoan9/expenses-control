-- Agregar columna buy_position_id: cada venta guarda de qué compra específica se descontó.
-- Si es NULL, el replay FIFO la asigna automáticamente (comportamiento anterior).
ALTER TABLE positions ADD COLUMN buy_position_id INTEGER REFERENCES positions(id);

-- Backfill: la venta #14 fue del usuario desde la compra #12
UPDATE positions SET buy_position_id = 12 WHERE id = 14;
