# Ejemplos de Uso: API de Promociones (ztpromociones)

Este documento describe cómo utilizar el endpoint principal `crudPromociones` para realizar operaciones de Alta, Baja, y Modificación (ABM) sobre las promociones.

**Usuario para todos los ejemplos:** `lpaniaguag`

---

### 1. Obtener Filtros (GetFilters)

Devuelve los filtros disponibles para la entidad de promociones.

**Endpoint:**
```http
POST /api/ztpromociones/crudPromociones?ProcessType=GetFilters&LoggedUser=lpaniaguag
```

**Body:**
```json
{}
```

**Output de ejemplo (Éxito):**
```json
{
    "ok": true,
    "status": 200,
    "message": "Filtros de promociones obtenidos con éxito.",
    "data": {
        "filters": [
            { "field": "IdPromoOK", "type": "string" },
            { "field": "Titulo", "type": "string" },
            { "field": "ACTIVED", "type": "boolean" }
        ]
    }
}
```

---

### 2. Obtener una Promoción (GetOne)

Obtiene una promoción específica por su `IdPromoOK`.

**Endpoint:**
```http
POST /api/ztpromociones/crudPromociones?ProcessType=GetOne&LoggedUser=lpaniaguag&IdPromoOK=PROMO001
```

**Body:**
```json
{}
```

**Output de ejemplo (Éxito):**
```json
{
    "ok": true,
    "status": 200,
    "message": "Promoción PROMO001 obtenida con éxito.",
    "data": {
        "IdPromoOK": "PROMO001",
        "Titulo": "Descuento Especial de Fin de Año",
        "Subtitulo": "15% OFF en productos seleccionados",
        "ACTIVED": true,
        "createdAt": "2025-10-20T10:00:00.000Z",
        "createdBy": "lpaniaguag",
        "modifiedAt": "2025-10-20T10:00:00.000Z",
        "modifiedBy": "lpaniaguag"
    }
}
```

---

### 3. Agregar Nuevas Promociones (AddMany)

Crea una o más promociones en la base de datos.

**Endpoint:**
```http
POST /api/ztpromociones/crudPromociones?ProcessType=AddMany&LoggedUser=lpaniaguag
```

**Body:**
```json
{
  "promociones": [
    {
      "IdPromoOK": "PROMO002",
      "Titulo": "Promoción de Verano",
      "Subtitulo": "2x1 en bebidas",
      "IdListaOK": "LISTA003"
    },
    {
      "IdPromoOK": "PROMO003",
      "Titulo": "Oferta Flash",
      "Subtitulo": "Solo por 24 horas",
      "IdListaOK": "LISTA004"
    }
  ]
}
```

**Output de ejemplo (Éxito):**
```json
{
    "ok": true,
    "status": 201,
    "message": "Se crearon 2 promociones con éxito.",
    "data": {
        "createdCount": 2,
        "items": [
            { "IdPromoOK": "PROMO002", "Titulo": "Promoción de Verano" },
            { "IdPromoOK": "PROMO003", "Titulo": "Oferta Flash" }
        ]
    }
}
```

---

### 4. Actualizar Promociones (UpdateMany)

Actualiza los campos de una o más promociones que coincidan con un criterio de filtro.

**Endpoint:**
```http
POST /api/ztpromociones/crudPromociones?ProcessType=UpdateMany&LoggedUser=lpaniaguag
```

**Body:**
```json
{
  "filter": {
    "IdListaOK": "LISTA003"
  },
  "updates": {
    "ACTIVED": false,
    "Subtitulo": "Promoción finalizada"
  }
}
```

**Output de ejemplo (Éxito):**
```json
{
    "ok": true,
    "status": 200,
    "message": "Se actualizaron 1 promociones con éxito.",
    "data": {
        "updatedCount": 1
    }
}
```

---

### 5. Borrado Lógico (DeleteMany - logic)

Realiza un borrado suave (soft delete) de las promociones que coincidan con el filtro, generalmente estableciendo `ACTIVED` en `false`.

**Endpoint:**
```http
POST /api/ztpromociones/crudPromociones?ProcessType=DeleteMany&LoggedUser=lpaniaguag&deleteType=logic
```

**Body:**
```json
{
  "filter": {
    "IdPromoOK": "PROMO002"
  }
}
```

**Output de ejemplo (Éxito):**
```json
{
    "ok": true,
    "status": 200,
    "message": "Se desactivaron 1 promociones (borrado lógico).",
    "data": {
        "deletedCount": 1
    }
}
```

---

### 6. Borrado Físico (DeleteMany - hard)

Elimina permanentemente de la base de datos las promociones que coincidan con el filtro. **¡Esta acción es irreversible!**

**Endpoint:**
```http
POST /api/ztpromociones/crudPromociones?ProcessType=DeleteMany&LoggedUser=lpaniaguag&deleteType=hard
```

**Body:**
```json
{
  "filter": {
    "IdPromoOK": "PROMO003"
  }
}
```

**Output de ejemplo (Éxito):**
```json
{
    "ok": true,
    "status": 200,
    "message": "Se eliminaron 1 promociones de la base de datos (borrado físico).",
    "data": {
        "deletedCount": 1
    }
}
```

---

### 7. Activar una Promoción (Activate)

Activa una promoción específica, generalmente estableciendo `ACTIVED` en `true`.

**Endpoint:**
```http
POST /api/ztpromociones/crudPromociones?ProcessType=Activate&LoggedUser=lpaniaguag&IdPromoOK=PROMO002
```

**Body:**
```json
{}
```

**Output de ejemplo (Éxito):**
```json
{
    "ok": true,
    "status": 200,
    "message": "Promoción PROMO002 activada con éxito.",
    "data": {
        "updatedCount": 1
    }
}
```
