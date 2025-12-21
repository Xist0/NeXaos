# Структура модулей кухни

## Обзор

Система управления модулями кухни с разделением по категориям, типам функционала и описаниями по основе артикула.

## Структура базы данных

### Таблица `module_types` - Типы модулей по функционалу

Хранит типы модулей в зависимости от их функционального назначения.

**Поля:**
- `id` - уникальный идентификатор
- `code` - код типа (swing, drawer, corner, tall, accessory, filler)
- `name` - название типа (Распашной, Выдвижной, Угловой, Пенал, Аксессуар, Доборный)
- `description` - описание типа
- `created_at` - дата создания

**Предустановленные типы:**
- `swing` - Распашной (модуль с распашными дверцами)
- `drawer` - Выдвижной (модуль с выдвижными ящиками)
- `corner` - Угловой (угловой модуль)
- `tall` - Пенал (высокий модуль-пенал)
- `accessory` - Аксессуар (дополнительный элемент)
- `filler` - Доборный (доборный элемент)

### Таблица `module_categories` - Категории модулей

Хранит категории модулей по расположению и назначению.

**Поля:**
- `id` - уникальный идентификатор
- `code` - код категории (bottom, top, tall, filler, accessory)
- `name` - название категории
- `description` - описание категории
- `sort_order` - порядок сортировки
- `created_at` - дата создания

**Предустановленные категории:**
- `bottom` - Нижние модули (модули для нижнего ряда кухни)
- `top` - Верхние модули (модули для верхнего ряда кухни)
- `tall` - Пеналы (высокие модули-пеналы)
- `filler` - Доборные элементы (доборные элементы для кухни)
- `accessory` - Аксессуары (аксессуары для кухни)

### Таблица `module_descriptions` - Описания модулей по основе артикула

Хранит описания и характеристики модулей, привязанные к основе артикула (например, "НМР" для всех распашных нижних модулей).

**Поля:**
- `id` - уникальный идентификатор
- `base_sku` - основа артикула (например, "НМР", "ВМР") - уникальное поле
- `name` - название типа модуля
- `description` - текстовое описание модуля
- `characteristics` - характеристики в формате JSONB
- `created_at` - дата создания
- `updated_at` - дата обновления

**Пример:**
```json
{
  "base_sku": "НМР",
  "name": "Нижний модуль распашной",
  "description": "Нижний модуль с распашными дверцами",
  "characteristics": {
    "depth": 510,
    "height": 820,
    "door_type": "распашная",
    "shelf_count": 1
  }
}
```

### Таблица `modules` - Модули (обновленная)

Добавлены новые поля для связи с типами, категориями и описаниями.

**Новые поля:**
- `module_type_id` - ссылка на тип модуля (module_types.id)
- `module_category_id` - ссылка на категорию модуля (module_categories.id)
- `base_sku` - основа артикула для привязки описания (например, "НМР")
- `description_id` - ссылка на описание модуля (module_descriptions.id)

**Существующие поля:**
- `id`, `sku`, `name`, `short_desc`, `preview_url`
- `length_mm`, `depth_mm`, `height_mm`
- `facade_color`, `corpus_color`
- `shelf_count`, `front_count`, `supports_count`, `hinges_count`, `clips_count`
- `notes`, `base_price`, `cost_price`, `margin_pct`, `final_price`
- `is_active`, `created_at`, `updated_at`

## API Эндпоинты

### 1. Расчет столешницы

**POST** `/api/modules/calculate-countertop`

Рассчитывает длину столешницы на основе нижних модулей.

**Тело запроса:**
```json
{
  "moduleIds": [1, 2, 3]
}
```

**Ответ:**
```json
{
  "data": {
    "totalLengthMm": 1500,
    "totalLengthM": "1.50",
    "maxDepthMm": 510,
    "modulesCount": 3,
    "modules": [
      {
        "id": 1,
        "sku": "НМР1-15",
        "name": "Нижний модуль распашной одностворчатый",
        "lengthMm": 500,
        "depthMm": 510
      }
    ],
    "modulesByLength": {
      "500": [...],
      "600": [...]
    }
  }
}
```

### 2. Проверка совместимости модулей

**POST** `/api/modules/check-compatibility`

Проверяет соответствие длины нижних и верхних модулей.

**Тело запроса:**
```json
{
  "bottomModuleIds": [1, 2, 3],
  "topModuleIds": [4, 5, 6]
}
```

**Ответ:**
```json
{
  "data": {
    "compatible": true,
    "warnings": [],
    "bottomTotalLength": 1500,
    "topTotalLength": 1500,
    "lengthDifference": 0,
    "hasTallModule": false,
    "bottomModules": [...],
    "topModules": [...]
  }
}
```

**Предупреждения:**
- Если разница в длине превышает 50мм, добавляется предупреждение типа `length_mismatch`

### 3. Поиск похожих модулей

**POST** `/api/modules/:id/similar`

Находит похожие модули на основе параметров.

**Параметры:**
- `id` (path) - ID модуля для сравнения

**Тело запроса (опционально):**
```json
{
  "limit": 10,
  "weights": {
    "category": 30,
    "type": 25,
    "facadeColor": 20,
    "corpusColor": 15,
    "length": 10
  }
}
```

**Ответ:**
```json
{
  "data": [
    {
      "id": 5,
      "sku": "НМР1-20",
      "name": "Нижний модуль распашной одностворчатый",
      "similarityScore": 85,
      "similarityPercent": 85,
      "matches": ["category", "type", "facadeColor", "corpusColor"]
    }
  ]
}
```

**Алгоритм поиска похожих:**

Система оценивает схожесть по следующим параметрам с весами по умолчанию:

1. **Категория модуля** (30 баллов) - совпадение категории (нижний/верхний/пенал)
2. **Тип модуля** (25 баллов) - совпадение типа (распашной/выдвижной)
3. **Цвет фасада** (20 баллов) - совпадение цвета фасада
4. **Цвет корпуса** (15 баллов) - совпадение цвета корпуса
5. **Длина** (10 баллов) - близость длины (с учетом отклонения ±50мм)
6. **Бонус за пенал** (5 баллов) - если оба модуля являются пеналами

Максимальный балл: 100. Модули сортируются по убыванию схожести.

### 4. Получение модулей с описаниями

**POST** `/api/modules/with-descriptions`

Получает модули с расширенной информацией (категория, тип, описание).

**Тело запроса:**
```json
{
  "moduleIds": [1, 2, 3]
}
```

**Ответ:**
```json
{
  "data": [
    {
      "id": 1,
      "sku": "НМР1-15",
      "name": "Нижний модуль распашной одностворчатый",
      "category_code": "bottom",
      "category_name": "Нижние модули",
      "type_code": "swing",
      "type_name": "Распашной",
      "base_sku": "НМР",
      "module_description": "Описание модуля...",
      "characteristics": {
        "depth": 510,
        "height": 820
      }
    }
  ]
}
```

### 5. Получение описания по основе артикула

**GET** `/api/modules/descriptions/:baseSku`

Получает описание модуля по основе артикула.

**Параметры:**
- `baseSku` (path) - основа артикула (например, "НМР")

**Ответ:**
```json
{
  "data": {
    "id": 1,
    "base_sku": "НМР",
    "name": "Нижний модуль распашной",
    "description": "Описание модуля...",
    "characteristics": {
      "depth": 510,
      "height": 820,
      "door_type": "распашная"
    }
  }
}
```

## Использование на фронтенде

### Пример расчета столешницы

```javascript
const calculateCountertop = async (moduleIds) => {
  const response = await fetch('/api/modules/calculate-countertop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ moduleIds })
  });
  const { data } = await response.json();
  console.log(`Длина столешницы: ${data.totalLengthM}м`);
  return data;
};
```

### Пример проверки совместимости

```javascript
const checkCompatibility = async (bottomIds, topIds) => {
  const response = await fetch('/api/modules/check-compatibility', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bottomModuleIds: bottomIds, topModuleIds: topIds })
  });
  const { data } = await response.json();
  
  if (!data.compatible) {
    data.warnings.forEach(warning => {
      console.warn(warning.message);
    });
  }
  
  return data;
};
```

### Пример поиска похожих модулей

```javascript
const findSimilarModules = async (moduleId, limit = 10) => {
  const response = await fetch(`/api/modules/${moduleId}/similar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit })
  });
  const { data } = await response.json();
  return data; // Массив похожих модулей с оценкой схожести
};
```

## Миграция данных

При применении миграции `006_create_module_structure.js`:

1. Создаются таблицы `module_types`, `module_categories`, `module_descriptions`
2. Заполняются базовые данные (типы и категории)
3. Добавляются новые поля в таблицу `modules`
4. Создаются индексы для быстрого поиска

**Важно:** После миграции необходимо:
- Заполнить `module_category_id` для существующих модулей
- Заполнить `module_type_id` для существующих модулей
- Создать описания в `module_descriptions` для основ артикулов
- Заполнить `base_sku` и `description_id` в таблице `modules`

## Примеры основ артикулов

- `НМР` - Нижний модуль распашной
- `ВМР` - Верхний модуль распашной
- `НМВ` - Нижний модуль выдвижной
- `ВМВ` - Верхний модуль выдвижной
- `ПЕН` - Пенал
- `ДОБ` - Доборный элемент

