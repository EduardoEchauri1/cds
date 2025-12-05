# Estructura y Validación de Parámetros

## 📋 Tabla de Contenidos

1. [Introducción](#1-introducción)
2. [Estructura de Parámetros](#2-estructura-de-parámetros)
3. [Validación de Parámetros](#3-validación-de-parámetros)
4. [ProcessType: GetFilters](#4-processtype-getfilters)
5. [Ejemplos Prácticos](#5-ejemplos-prácticos)
6. [Mejores Prácticas](#6-mejores-prácticas)

---

## 1. Introducción

Los parámetros de entrada deben estructurarse correctamente en formato de **cadena HTML o String serializado**, utilizando la clase `URLSearchParams` cuando sea necesario.

### Principios Fundamentales

1. ✅ **No usar valores "basura" o ficticios**: Todas las pruebas deben realizarse con datos reales
2. ✅ **Validar antes de procesar**: Los parámetros obligatorios deben validarse en el controller
3. ✅ **Serializar correctamente**: Usar `URLSearchParams` para convertir a cadena HTML/String
4. ✅ **Desestructurar apropiadamente**: Extraer solo los campos necesarios según el ProcessType

---

## 2. Estructura de Parámetros

### 2.1 Extracción de Parámetros

Los parámetros siempre deben extraerse del query string de la siguiente manera:

```javascript
// 1. Extraer parámetros del query string
const params = req.req?.query || {};

// 2. Serializar a cadena HTML/String usando URLSearchParams
const paramString = params ? new URLSearchParams(params).toString().trim() : '';

// 3. Desestructurar campos obligatorios
const {
  ProcessType,           // Obligatorio
  LoggedUser,            // Obligatorio
  DBServer = 'MongoDB',  // Opcional con default
} = params;
```

### 2.2 Formato de la Cadena Serializada

El `paramString` resultante debe ser una cadena HTML válida:

**Ejemplo:**
```
ProcessType=GetFilters&LoggedUser=jlopezm&DBServer=MongoDB&IdPromoOK=PROMO001
```

Este formato permite:
- ✅ Registro en bitácora
- ✅ Trazabilidad completa
- ✅ Debugging facilitado
- ✅ Compatibilidad con logs

---

## 3. Validación de Parámetros

### 3.1 Parámetros Obligatorios

Los siguientes parámetros **SIEMPRE** deben validarse:

#### ProcessType

```javascript
// Validar existencia
if (!ProcessType) {
  const error = new Error('Parámetro obligatorio faltante: ProcessType');
  error.code = 400;
  throw error;
}

// Validar valores permitidos (case-sensitive)
const validProcessTypes = ['GetFilters', 'AddMany', 'UpdateMany', 'DeleteMany'];
if (!validProcessTypes.includes(ProcessType)) {
  const error = new Error(
    `ProcessType inválido: "${ProcessType}". Valores permitidos: ${validProcessTypes.join(', ')}`
  );
  error.code = 400;
  throw error;
}
```

**Valores Permitidos:**
- `GetFilters` - Proceso genérico de consulta
- `AddMany` - Creación de registros
- `UpdateMany` - Actualización de registros
- `DeleteMany` - Eliminación de registros

#### LoggedUser

```javascript
// Validar existencia
if (!LoggedUser) {
  const error = new Error('Parámetro obligatorio faltante: LoggedUser (formato: jlopezm)');
  error.code = 400;
  throw error;
}

// Validar formato
const userRegex = /^[a-z][a-z]+[a-z]$/i;
if (!userRegex.test(LoggedUser)) {
  console.warn(`[ZTPROMOCIONES] ⚠️  LoggedUser con formato inusual: "${LoggedUser}"`);
  console.warn('[ZTPROMOCIONES] ℹ️  Formato esperado: [1ª letra nombre][apellido paterno][1ª letra apellido materno]');
}
```

**Formato Esperado:**
- Primera letra del primer nombre
- Apellido paterno completo (minúsculas)
- Primera letra del segundo apellido

**Ejemplos Válidos:**
- `jlopezm` ← Juan López Martínez
- `mgonzalezr` ← María González Ruiz
- `psanchezl` ← Pedro Sánchez López

### 3.2 Parámetros Opcionales

#### DBServer

```javascript
// Default si no se proporciona
const { DBServer = 'MongoDB' } = params;

// Validar valores permitidos (si se proporciona)
const validDBServers = ['MongoDB', 'HANA', 'AzureCosmos'];
if (DBServer && !validDBServers.includes(DBServer)) {
  const error = new Error(
    `DBServer inválido: "${DBServer}". Valores permitidos: ${validDBServers.join(', ')}`
  );
  error.code = 400;
  throw error;
}
```

---

## 4. ProcessType: GetFilters

### 4.1 Concepto de Proceso Genérico

`GetFilters` es un **proceso genérico** que abarca múltiples variantes de consulta:

| Variante | Descripción | Filtros |
|----------|-------------|---------|
| **GetAll** | Obtener todos los registros activos | `{ ACTIVED: true, DELETED: false }` |
| **GetOne** | Obtener un registro específico | `{ IdPromoOK: "PROMO001" }` |
| **GetSome** | Obtener registros filtrados | `{ IdListaOK: "LISTA001", vigentes: true }` |
| **GetVigentes** | Obtener registros vigentes | `{ FechaIni: { $lte: now }, FechaFin: { $gte: now } }` |

### 4.2 Filtros Dinámicos

Los filtros se construyen dinámicamente según los parámetros enviados:

```javascript
// Filtro base (siempre presente)
let filter = { ACTIVED: true, DELETED: false };

// Agregar filtros opcionales según parámetros
if (params.IdPromoOK) {
  filter.IdPromoOK = params.IdPromoOK;
}

if (params.SKUID) {
  filter.SKUID = params.SKUID;
}

if (params.IdListaOK) {
  filter.IdListaOK = params.IdListaOK;
}

// Filtro de vigencia
if (params.vigentes === 'true') {
  const now = new Date();
  filter.FechaIni = { $lte: now };
  filter.FechaFin = { $gte: now };
}
```

### 4.3 Paginación

`GetFilters` también soporta paginación:

```javascript
const {
  limit = 100,   // Default: 100 registros
  offset = 0     // Default: inicio
} = params;

// Aplicar en query
const promociones = await ZTPromociones.find(filter)
  .limit(parseInt(limit))
  .skip(parseInt(offset))
  .lean()
  .exec();
```

---

## 5. Ejemplos Prácticos

### 5.1 GetAll - Todos los Registros

**Request:**
```http
POST /api/ztpromociones/crudPromociones?ProcessType=GetFilters&LoggedUser=jlopezm
```

**Filtro Construido:**
```json
{
  "ACTIVED": true,
  "DELETED": false
}
```

**Descripción:** Sin filtros adicionales, retorna todos los registros activos.

---

### 5.2 GetOne - Registro Específico

**Request:**
```http
POST /api/ztpromociones/crudPromociones?ProcessType=GetFilters&LoggedUser=jlopezm&IdPromoOK=PROMO001
```

**Filtro Construido:**
```json
{
  "ACTIVED": true,
  "DELETED": false,
  "IdPromoOK": "PROMO001"
}
```

**Descripción:** Retorna la promoción con `IdPromoOK = "PROMO001"`.

---

### 5.3 GetSome - Registros Filtrados

**Request:**
```http
POST /api/ztpromociones/crudPromociones?ProcessType=GetFilters&LoggedUser=jlopezm&IdListaOK=LISTA001&SKUID=SKU123
```

**Filtro Construido:**
```json
{
  "ACTIVED": true,
  "DELETED": false,
  "IdListaOK": "LISTA001",
  "SKUID": "SKU123"
}
```

**Descripción:** Retorna promociones de la lista `LISTA001` asociadas al SKU `SKU123`.

---

### 5.4 GetVigentes - Registros Vigentes

**Request:**
```http
POST /api/ztpromociones/crudPromociones?ProcessType=GetFilters&LoggedUser=jlopezm&vigentes=true
```

**Filtro Construido:**
```json
{
  "ACTIVED": true,
  "DELETED": false,
  "FechaIni": { "$lte": "2025-10-19T12:00:00.000Z" },
  "FechaFin": { "$gte": "2025-10-19T12:00:00.000Z" }
}
```

**Descripción:** Retorna solo promociones vigentes a la fecha actual.

---

### 5.5 GetSome con Paginación

**Request:**
```http
POST /api/ztpromociones/crudPromociones?ProcessType=GetFilters&LoggedUser=jlopezm&IdListaOK=LISTA001&limit=50&offset=0
```

**Filtro Construido:**
```json
{
  "ACTIVED": true,
  "DELETED": false,
  "IdListaOK": "LISTA001"
}
```

**Paginación:**
- Limit: 50
- Offset: 0

**Descripción:** Retorna los primeros 50 registros de la lista `LISTA001`.

---

## 6. Mejores Prácticas

### 6.1 ✅ DO - Buenas Prácticas

#### 1. Usar Datos Reales en Pruebas

```javascript
// ✅ CORRECTO
const testData = {
  IdPromoOK: "PROMO001",
  Titulo: "Descuento Navidad 2025",
  FechaIni: "2025-12-01",
  FechaFin: "2025-12-31"
};

// ❌ INCORRECTO
const testData = {
  IdPromoOK: "TEST123",
  Titulo: "Test promoción",
  FechaIni: "2020-01-01",
  FechaFin: "2020-12-31"
};
```

#### 2. Serializar Parámetros Correctamente

```javascript
// ✅ CORRECTO
const params = req.req?.query || {};
const paramString = params ? new URLSearchParams(params).toString().trim() : '';
```

#### 3. Validar Antes de Procesar

```javascript
// ✅ CORRECTO - Validar en controller
if (!ProcessType) {
  throw new Error('ProcessType obligatorio');
}

// Luego pasar al service
const result = await crudZTPromociones(req);
```

#### 4. Desestructurar Apropiadamente

```javascript
// ✅ CORRECTO - Solo extraer lo necesario
const {
  ProcessType,
  LoggedUser,
  DBServer = 'MongoDB',
  IdPromoOK,
  vigentes,
  limit = 100,
  offset = 0
} = params;
```

### 6.2 ❌ DON'T - Malas Prácticas

#### 1. No Usar Valores Ficticios

```javascript
// ❌ INCORRECTO
const fakePromo = {
  IdPromoOK: "FAKE001",
  Titulo: "Promoción de prueba",
  Descuento: 999
};
```

#### 2. No Asumir Valores

```javascript
// ❌ INCORRECTO
const ProcessType = params.ProcessType || 'GetFilters'; // NO asumir default

// ✅ CORRECTO
if (!params.ProcessType) {
  throw new Error('ProcessType obligatorio');
}
const ProcessType = params.ProcessType;
```

#### 3. No Validar Solo en Service

```javascript
// ❌ INCORRECTO - Validar solo en service
// Controller
const result = await crudZTPromociones(req);

// Service
if (!params.ProcessType) { /* ... */ }

// ✅ CORRECTO - Validar en controller primero
// Controller
if (!params.ProcessType) { /* ... */ }
const result = await crudZTPromociones(req);
```

---

## 7. Estructura Completa de Validación

```javascript
/**
 * Estructura completa de validación en Controller
 */
this.on('crudPromociones', async (req) => {
  try {
    // ═══════════════════════════════════════════════
    // 1. EXTRAER PARÁMETROS
    // ═══════════════════════════════════════════════
    const params = req.req?.query || {};
    const paramString = params ? new URLSearchParams(params).toString().trim() : '';
    
    const {
      ProcessType,
      LoggedUser,
      DBServer = 'MongoDB',
    } = params;
    
    const method = req.req?.method || 'POST';
    const api = '/api/ztpromociones/crudPromociones';
    
    // ═══════════════════════════════════════════════
    // 2. VALIDAR PARÁMETROS OBLIGATORIOS
    // ═══════════════════════════════════════════════
    
    // ProcessType
    if (!ProcessType) {
      const error = new Error('Parámetro obligatorio faltante: ProcessType');
      error.code = 400;
      throw error;
    }
    
    const validProcessTypes = ['GetFilters', 'AddMany', 'UpdateMany', 'DeleteMany'];
    if (!validProcessTypes.includes(ProcessType)) {
      const error = new Error(`ProcessType inválido: "${ProcessType}"`);
      error.code = 400;
      throw error;
    }
    
    // LoggedUser
    if (!LoggedUser) {
      const error = new Error('Parámetro obligatorio faltante: LoggedUser');
      error.code = 400;
      throw error;
    }
    
    const userRegex = /^[a-z][a-z]+[a-z]$/i;
    if (!userRegex.test(LoggedUser)) {
      console.warn(`⚠️  LoggedUser con formato inusual: "${LoggedUser}"`);
    }
    
    // DBServer (opcional)
    const validDBServers = ['MongoDB', 'HANA', 'AzureCosmos'];
    if (DBServer && !validDBServers.includes(DBServer)) {
      const error = new Error(`DBServer inválido: "${DBServer}"`);
      error.code = 400;
      throw error;
    }
    
    // ═══════════════════════════════════════════════
    // 3. LOG DE CONTEXTO (Desarrollo)
    // ═══════════════════════════════════════════════
    if (process.env.NODE_ENV === 'development') {
      console.log('═══════════════════════════════════════');
      console.log('Contexto del endpoint:');
      console.log(`  • ProcessType: ${ProcessType}`);
      console.log(`  • LoggedUser: ${LoggedUser}`);
      console.log(`  • DBServer: ${DBServer}`);
      console.log(`  • Query String: ${paramString}`);
      console.log('═══════════════════════════════════════');
    }
    
    // ═══════════════════════════════════════════════
    // 4. EJECUTAR LÓGICA DE NEGOCIO
    // ═══════════════════════════════════════════════
    const result = await crudZTPromociones(req);
    
    // ═══════════════════════════════════════════════
    // 5. CONFIGURAR RESPUESTA
    // ═══════════════════════════════════════════════
    if (!result.success && req.http?.res) {
      req.http.res.status(result.status || 500);
    } 
    else if (ProcessType === 'AddMany' && result.success && req.http?.res) {
      req.http.res.status(201);
      const count = result.dataRes?.length || 0;
      if (count > 0) {
        req.http.res.set('X-Created-Count', count.toString());
      }
    }
    else if (result.success && req.http?.res) {
      req.http.res.status(200);
    }
    
    // ═══════════════════════════════════════════════
    // 6. ENRIQUECER CON METADATOS
    // ═══════════════════════════════════════════════
    if (result && typeof result === 'object') {
      result._metadata = {
        processType: ProcessType,
        dbServer: DBServer,
        loggedUser: LoggedUser,
        method: method,
        api: api,
        queryString: paramString, // Cadena HTML/String serializada
        timestamp: new Date().toISOString()
      };
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Error en controller:', error.message);
    const errorCode = error.code || 500;
    req.error(errorCode, error.message);
  }
});
```

---

## 8. Checklist de Validación

Antes de enviar una request, verifica:

- [ ] ✅ `ProcessType` presente y válido
- [ ] ✅ `LoggedUser` presente y con formato correcto
- [ ] ✅ `DBServer` válido (si se proporciona)
- [ ] ✅ Parámetros serializados con `URLSearchParams`
- [ ] ✅ Sin valores ficticios o "basura"
- [ ] ✅ Datos reales para pruebas
- [ ] ✅ Filtros apropiados para `GetFilters`
- [ ] ✅ Paginación configurada (si aplica)

---

## 9. Casos de Error Comunes

### Error 1: ProcessType faltante

**Request:**
```http
POST /api/ztpromociones/crudPromociones?LoggedUser=jlopezm
```

**Error:**
```json
{
  "error": {
    "code": 400,
    "message": "Parámetro obligatorio faltante: ProcessType"
  }
}
```

### Error 2: ProcessType inválido

**Request:**
```http
POST /api/ztpromociones/crudPromociones?ProcessType=GetOnee&LoggedUser=jlopezm
```

**Error:**
```json
{
  "error": {
    "code": 400,
    "message": "ProcessType inválido: \"GetOnee\". Valores permitidos: GetFilters, AddMany, UpdateMany, DeleteMany"
  }
}
```

### Error 3: LoggedUser faltante

**Request:**
```http
POST /api/ztpromociones/crudPromociones?ProcessType=GetFilters
```

**Error:**
```json
{
  "error": {
    "code": 400,
    "message": "Parámetro obligatorio faltante: LoggedUser (formato: jlopezm)"
  }
}
```

### Error 4: DBServer inválido

**Request:**
```http
POST /api/ztpromociones/crudPromociones?ProcessType=GetFilters&LoggedUser=jlopezm&DBServer=MySQL
```

**Error:**
```json
{
  "error": {
    "code": 400,
    "message": "DBServer inválido: \"MySQL\". Valores permitidos: MongoDB, HANA, AzureCosmos"
  }
}
```

---

## 10. Referencias

- **Controller**: `src/api/controllers/ztpromociones-controller.js`
- **Service**: `src/api/services/ztpromociones-service.js`
- **Router**: `src/api/routes/ztpromociones-router.cds`
- **Guía Rápida**: `src/api/GUIA_RAPIDA_ENDPOINTS.md`
- **Estructura Estándar**: `src/api/ESTRUCTURA_ESTANDAR_ENDPOINTS.md`

---

**Última actualización**: 2025-10-19  
**Versión**: 1.0.0  
**Autor**: Equipo Back-CDS
