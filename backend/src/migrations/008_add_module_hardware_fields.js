/**
 * Миграция для добавления полей фурнитуры и скрытых параметров в таблицу modules
 * Добавляет поля для хранения количества различных элементов фурнитуры
 */

const statements = [
  // Скрытые параметры фурнитуры (общие для всех типов модулей)
  `ALTER TABLE modules 
   ADD COLUMN IF NOT EXISTS shelf_holder_count INT DEFAULT 0,
   ADD COLUMN IF NOT EXISTS screw_35x19_black_count INT DEFAULT 0,
   ADD COLUMN IF NOT EXISTS screw_35x16_white_count INT DEFAULT 0,
   ADD COLUMN IF NOT EXISTS euro_screw_7x50_count INT DEFAULT 0,
   ADD COLUMN IF NOT EXISTS cross_tie_count INT DEFAULT 0,
   ADD COLUMN IF NOT EXISTS damper_10x15_count INT DEFAULT 0,
   ADD COLUMN IF NOT EXISTS nail_16x25_count INT DEFAULT 0;`,

  // Поля для ящиков (для модулей с ящиками - НМЯ.М1, НМЯ.2, НМЯ.3)
  `ALTER TABLE modules 
   ADD COLUMN IF NOT EXISTS drawer_smrtl_84_count INT DEFAULT 0,
   ADD COLUMN IF NOT EXISTS drawer_smrtl_135_count INT DEFAULT 0,
   ADD COLUMN IF NOT EXISTS drawer_smrtl_199_count INT DEFAULT 0,
   ADD COLUMN IF NOT EXISTS extension_15_count INT DEFAULT 0,
   ADD COLUMN IF NOT EXISTS extension_20_count INT DEFAULT 0;`,

  // Поля для материалов (себестоимость)
  `ALTER TABLE modules 
   ADD COLUMN IF NOT EXISTS hdf_count NUMERIC(12,4) DEFAULT 0,
   ADD COLUMN IF NOT EXISTS pvc_edge_count NUMERIC(12,4) DEFAULT 0,
   ADD COLUMN IF NOT EXISTS agt_edge_count NUMERIC(12,4) DEFAULT 0,
   ADD COLUMN IF NOT EXISTS chipboard_count NUMERIC(12,4) DEFAULT 0,
   ADD COLUMN IF NOT EXISTS agt_count NUMERIC(12,4) DEFAULT 0;`,

  // Себестоимость компонентов
  `ALTER TABLE modules 
   ADD COLUMN IF NOT EXISTS hardware_cost NUMERIC(12,2) DEFAULT 0,
   ADD COLUMN IF NOT EXISTS sheet_material_cost NUMERIC(12,2) DEFAULT 0,
   ADD COLUMN IF NOT EXISTS edge_material_cost NUMERIC(12,2) DEFAULT 0;`,
];

const dropStatements = [
  `ALTER TABLE modules 
   DROP COLUMN IF EXISTS edge_material_cost,
   DROP COLUMN IF EXISTS sheet_material_cost,
   DROP COLUMN IF EXISTS hardware_cost,
   DROP COLUMN IF EXISTS agt_count,
   DROP COLUMN IF EXISTS chipboard_count,
   DROP COLUMN IF EXISTS agt_edge_count,
   DROP COLUMN IF EXISTS pvc_edge_count,
   DROP COLUMN IF EXISTS hdf_count,
   DROP COLUMN IF EXISTS extension_20_count,
   DROP COLUMN IF EXISTS extension_15_count,
   DROP COLUMN IF EXISTS drawer_smrtl_199_count,
   DROP COLUMN IF EXISTS drawer_smrtl_135_count,
   DROP COLUMN IF EXISTS drawer_smrtl_84_count,
   DROP COLUMN IF EXISTS nail_16x25_count,
   DROP COLUMN IF EXISTS damper_10x15_count,
   DROP COLUMN IF EXISTS cross_tie_count,
   DROP COLUMN IF EXISTS euro_screw_7x50_count,
   DROP COLUMN IF EXISTS screw_35x16_white_count,
   DROP COLUMN IF EXISTS screw_35x19_black_count,
   DROP COLUMN IF EXISTS shelf_holder_count;`,
];

const up = async (query) => {
  console.log("🔧 Добавляем поля фурнитуры и скрытых параметров в таблицу modules...");
  
  for (const sql of statements) {
    await query(sql);
  }

  console.log("✅ Поля фурнитуры добавлены");
};

const down = async (query) => {
  console.log("🔙 Откатываем поля фурнитуры...");
  for (const sql of dropStatements) {
    await query(sql);
  }
  console.log("✅ Поля фурнитуры откачены");
};

module.exports = {
  id: "008_add_module_hardware_fields",
  up,
  down,
};

