module.exports = [
  require("./001_create_core_tables"),
  require("./002_make_phone_required"),
  require("./003_create_order_notes"),
  require("./004_add_preview_columns"),
  require("./005_create_refresh_tokens"),
  require("./006_create_module_structure"),
  require("./007_create_material_structure"),
  require("./008_add_module_hardware_fields"),
  require("./009_create_colors_and_solutions"),
  require("./010_add_colors_to_hardware"),
  require("./011_create_size_templates_and_module_type_prices"),
  require("./012_create_kitchen_types"),
  require("./013_backfill_module_descriptions"),
];

