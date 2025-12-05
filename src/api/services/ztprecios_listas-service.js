// ============================================
// IMPORTS
// ============================================
const { getCosmosDatabase } = require('../../config/connectToMongoDB.config');
const ZTPreciosListas = require('../models/mongodb/ztprecios_listas');
const { OK, FAIL, BITACORA, DATA, AddMSG } = require('../../middlewares/respPWA.handler'); //construye la bitacora
const { saveWithAudit } = require('../../helpers/audit-timestap'); //guarda con auditoria automatica

// ============================================
// UTIL: OBTENER CONTENEDOR DE COSMOS DB
// ============================================
async function getCosmosContainer(containerName, partitionKeyPath) {
  const database = getCosmosDatabase();
  if (!database) {
    throw new Error('La conexión con Cosmos DB no está disponible.');
  }
  const { container } = await database.containers.createIfNotExists({
    id: containerName,
    partitionKey: { paths: [partitionKeyPath] }
  });
  return container;
}

// Helper específico para este servicio
async function getPreciosListasCosmosContainer() {
  return getCosmosContainer('ZTPRECIOS_LISTAS', '/IDLISTAOK');
}

// ============================================
// FUNCIONES DE BASE DE DATOS
// ============================================
async function GetAllZTPreciosListasMongo() { //obtiene todas 
  return await ZTPreciosListas.find({
    $or: [ //Retorna tanto activas como eliminadas para trazabilidad.
      { ACTIVED: true, DELETED: false },  // activos
      { ACTIVED: false, DELETED: true }   // eliminados lógicamente
    ]
  }).lean(); //Retorna objetos planos (JSON)
}


//Valida que IDLISTAOK no esté vacío
//Busca UN documento con ese ID
//Solo si está activo y no eliminado
//Si no existe → lanza error
async function GetOneZTPreciosListaMongo(IDLISTAOK) { //obtiene una
  if (!IDLISTAOK) throw new Error('Falta parámetro IDLISTAOK');
  const item = await ZTPreciosListas.findOne({ IDLISTAOK, ACTIVED: true, DELETED: false }).lean();
  if (!item) throw new Error('No se encontró la lista');
  return item;
}

//data = objeto con los datos de la nueva lista
//user = usuario que está creando (para auditoría)
async function CreateZTPreciosListaMongo(data, user) { //crea //parametros
  const filter = { IDLISTAOK: data.IDLISTAOK }; //Crea un filtro para buscar el documento por su ID.
  const dataToSave = { ...data }; //Copia el objeto data en una nueva variable dataToSave.

  // Asegurarse de que SKUSIDS sea un arreglo
  // Puede venir como:
  // 1. Array directo (correcto): ["SKU1", "SKU2"]
  // 2. String JSON (si axios lo stringificó): "[\"SKU1\",\"SKU2\"]"
  if (dataToSave.SKUSIDS) {
    if (typeof dataToSave.SKUSIDS === 'string') {
      try {
        dataToSave.SKUSIDS = JSON.parse(dataToSave.SKUSIDS);
      } catch (e) {
        throw new Error('El campo SKUSIDS no es un arreglo JSON válido.');
      }
    } else if (!Array.isArray(dataToSave.SKUSIDS)) {
      throw new Error('El campo SKUSIDS debe ser un array o string JSON válido.');
    }
  }
  return await saveWithAudit(ZTPreciosListas, filter, dataToSave, user, 'CREATE');
}

async function UpdateZTPreciosListaMongo(IDLISTAOK, data, user) {
  const filter = { IDLISTAOK };
  const dataToSave = { ...data };

  // Asegurarse de que SKUSIDS sea un arreglo
  // Puede venir como:
  // 1. Array directo (correcto): ["SKU1", "SKU2"]
  // 2. String JSON (si axios lo stringificó): "[\"SKU1\",\"SKU2\"]"
  if (dataToSave.SKUSIDS) {
    if (typeof dataToSave.SKUSIDS === 'string') {
      try {
        dataToSave.SKUSIDS = JSON.parse(dataToSave.SKUSIDS);
      } catch (e) {
        throw new Error('El campo SKUSIDS no es un arreglo JSON válido.');
      }
    } else if (!Array.isArray(dataToSave.SKUSIDS)) {
      throw new Error('El campo SKUSIDS debe ser un array o string JSON válido.');
    }
  }
  return await saveWithAudit(ZTPreciosListas, filter, dataToSave, user, 'UPDATE');
}

async function DeleteLogicZTPreciosListaMongo(IDLISTAOK, user) {
  const filter = { IDLISTAOK };
  const data = { ACTIVED: false, DELETED: true };
  return await saveWithAudit(ZTPreciosListas, filter, data, user, 'UPDATE');
}

async function DeleteHardZTPreciosListaMongo(IDLISTAOK) {
  const deleted = await ZTPreciosListas.findOneAndDelete({ IDLISTAOK });
  if (!deleted) throw new Error('No se encontró la lista para eliminar permanentemente');
  return { message: 'Lista eliminada permanentemente', IDLISTAOK };
}

async function ActivateZTPreciosListaMongo(IDLISTAOK, user) {
  const filter = { IDLISTAOK };
  const data = { ACTIVED: true, DELETED: false };
  return await saveWithAudit(ZTPreciosListas, filter, data, user, 'UPDATE');
}

async function GetZTPreciosListasBySKUIDMongo(skuid) {
  if (!skuid) throw new Error('Falta parámetro SKUID');
  return await ZTPreciosListas.find({ SKUSIDS: skuid, DELETED: { $ne: true } }).lean();
}

// ============================================
// FUNCIONES DE BASE DE DATOS (COSMOS DB)
// ============================================
async function GetAllZTPreciosListasCosmos() {
  const container = await getPreciosListasCosmosContainer();
  const query = "SELECT * from c WHERE c.DELETED != true";
  const { resources: items } = await container.items.query(query).fetchAll();
  return items;
}

async function GetOneZTPreciosListaCosmos(IDLISTAOK) {
  if (!IDLISTAOK) throw new Error('Falta parámetro IDLISTAOK');
  const container = await getPreciosListasCosmosContainer();
  const { resource: item } = await container.item(IDLISTAOK, IDLISTAOK).read();
  if (!item) throw new Error('No se encontró la lista');
  return item;
}

async function CreateZTPreciosListaCosmos(data, user) {
  if (!data || !data.IDLISTAOK) throw new Error('Faltan datos o el IDLISTAOK');

  const container = await getPreciosListasCosmosContainer();
  const { resource: existing } = await container.item(data.IDLISTAOK, data.IDLISTAOK).read().catch(() => ({}));
  if (existing) throw new Error(`Ya existe una lista con el IDLISTAOK: ${data.IDLISTAOK}`);

  let skusids = data.SKUSIDS || [];
  if (typeof skusids === 'string') {
    try {
      skusids = JSON.parse(skusids);
    } catch (e) {
      throw new Error('El campo SKUSIDS no es un arreglo JSON válido.');
    }
  }
  if (!Array.isArray(skusids)) {
    throw new Error('El campo SKUSIDS debe ser un array.');
  }

  const newItem = {
    id: data.IDLISTAOK,
    partitionKey: data.IDLISTAOK,
    ...data,
    SKUSIDS: skusids,
    ACTIVED: data.ACTIVED ?? true,
    DELETED: data.DELETED ?? false,
    REGUSER: user,
    REGDATE: new Date().toISOString(),
    HISTORY: [{
      user: user,
      event: "CREATE",
      date: new Date().toISOString(),
      changes: data
    }]
  };

  const { resource: createdItem } = await container.items.create(newItem);
  return createdItem;
}

async function UpdateZTPreciosListaCosmos(IDLISTAOK, data, user) {
  if (!IDLISTAOK) throw new Error('Falta parámetro IDLISTAOK');
  const container = await getPreciosListasCosmosContainer();
  const { resource: currentItem } = await container.item(IDLISTAOK, IDLISTAOK).read();
  if (!currentItem) throw new Error(`No se encontró la lista para actualizar con IDLISTAOK: ${IDLISTAOK}`);

  let skusids = data.SKUSIDS;
  if (skusids) {
    if (typeof skusids === 'string') {
      try {
        skusids = JSON.parse(skusids);
      } catch (e) {
        throw new Error('El campo SKUSIDS no es un arreglo JSON válido.');
      }
    }
    if (!Array.isArray(skusids)) {
      throw new Error('El campo SKUSIDS debe ser un array.');
    }
  }

  const updatedItem = {
    ...currentItem,
    ...data,
    SKUSIDS: skusids ?? currentItem.SKUSIDS,
    id: currentItem.id,
    partitionKey: currentItem.partitionKey,
    MODUSER: user,
    MODDATE: new Date().toISOString(),
    HISTORY: [...(currentItem.HISTORY || []), { user, action: 'UPDATE', date: new Date().toISOString(), changes: data }]
  };

  const { resource: replacedItem } = await container.item(currentItem.id, currentItem.partitionKey).replace(updatedItem);
  return replacedItem;
}

async function DeleteLogicZTPreciosListaCosmos(IDLISTAOK, user) {
  if (!IDLISTAOK) throw new Error('Falta parámetro IDLISTAOK');
  const container = await getPreciosListasCosmosContainer();
  const { resource: currentItem } = await container.item(IDLISTAOK, IDLISTAOK).read();
  if (!currentItem) throw new Error(`No se encontró la lista para borrado lógico con IDLISTAOK: ${IDLISTAOK}`);

  const updatedItem = {
    ...currentItem,
    ACTIVED: false,
    DELETED: true,
    MODUSER: user,
    MODDATE: new Date().toISOString(),
    HISTORY: [...(currentItem.HISTORY || []), { user, action: 'DELETE_LOGIC', date: new Date().toISOString(), changes: { ACTIVED: false, DELETED: true } }]
  };

  const { resource: replacedItem } = await container.item(currentItem.id, currentItem.partitionKey).replace(updatedItem);
  return replacedItem;
}

async function DeleteHardZTPreciosListaCosmos(IDLISTAOK) {
  if (!IDLISTAOK) throw new Error('Falta parámetro IDLISTAOK');
  const container = await getPreciosListasCosmosContainer();
  await container.item(IDLISTAOK, IDLISTAOK).delete();
  return { message: 'Lista eliminada permanentemente de Cosmos DB', IDLISTAOK };
}

async function ActivateZTPreciosListaCosmos(IDLISTAOK, user) {
  if (!IDLISTAOK) throw new Error('Falta parámetro IDLISTAOK');
  const container = await getPreciosListasCosmosContainer();
  const { resource: currentItem } = await container.item(IDLISTAOK, IDLISTAOK).read();
  if (!currentItem) throw new Error(`No se encontró la lista para activar con IDLISTAOK: ${IDLISTAOK}`);

  const updatedItem = {
    ...currentItem,
    ACTIVED: true,
    DELETED: false,
    MODUSER: user,
    MODDATE: new Date().toISOString(),
    HISTORY: [...(currentItem.HISTORY || []), { user, action: 'ACTIVATE', date: new Date().toISOString(), changes: { ACTIVED: true, DELETED: false } }]
  };

  const { resource: replacedItem } = await container.item(currentItem.id, currentItem.partitionKey).replace(updatedItem);
  return replacedItem;
}

async function GetZTPreciosListasBySKUIDCosmos(skuid) {
  if (!skuid) throw new Error('Falta parámetro SKUID');
  const container = await getPreciosListasCosmosContainer();
  const querySpec = { query: "SELECT * FROM c WHERE ARRAY_CONTAINS(c.SKUSIDS, @skuid) AND c.DELETED != true", parameters: [{ name: "@skuid", value: skuid }] };
  const { resources: items } = await container.items.query(querySpec).fetchAll();
  return items;
}

// ============================================
// MÉTODOS LOCALES CON BITÁCORA
// ============================================

async function GetAllMethod(bitacora, params, paramString, body, dbServer) {
  let data = DATA(); //Crea un objeto data vacío para llenar de información.

  // configurar contexto de data
  data.process        = 'Obtener todas las listas de precios';
  data.processType    = params.ProcessType || '';
  data.loggedUser     = params.LoggedUser || '';
  data.dbServer       = dbServer;
  data.server         = process.env.SERVER_NAME || '';
  data.api            = '/api/ztprecios‑listas/preciosListasCRUD';
  data.queryString    = paramString;

  // propagar en bitácora. Llena el objeto bitacora con la misma información que en data.
  bitacora.processType  = params.ProcessType || '';
  bitacora.loggedUser   = params.LoggedUser || '';
  bitacora.dbServer     = dbServer;
  bitacora.server       = process.env.SERVER_NAME || '';
  bitacora.process      = 'Obtener todas las listas de precios';

  try {
    let result; //Declara una variable vacía que va a guardar el resultado de la búsqueda.
    switch (dbServer) { //Ejecuta la función de base de datos según cuál BD se use.
      case 'MongoDB':
        result = await GetAllZTPreciosListasMongo();
        break;
      case 'CosmosDB':
        result = await GetAllZTPreciosListasCosmos();
        break;
      default:
        throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes   = result; //Agrega el resultado (array de listas) al objeto data.
    data.messageUSR = 'Listas obtenidas correctamente';
    data.messageDEV = 'GetAllZTPreciosListasMongo ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true); //Agrega el mensaje data a la bitacora con información de éxito.
    bitacora.success = true;
    return bitacora; //Retorna la bitácora completa con toda la información de la operación exitosa.

  } catch (error) {
    data.messageUSR = 'Error al obtener las listas de precios';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

async function GetOneMethod(bitacora, params, IDLISTAOK, dbServer) {
  let data = DATA();

  data.process        = 'Obtener una lista de precios';
  data.processType    = params.ProcessType || '';
  data.loggedUser     = params.LoggedUser || '';
  data.dbServer       = dbServer;
  data.server         = process.env.SERVER_NAME || '';
  data.api            = '/api/ztprecios‑listas/preciosListasCRUD';

  bitacora.processType  = params.ProcessType || '';
  bitacora.loggedUser   = params.LoggedUser || '';
  bitacora.dbServer     = dbServer;
  bitacora.server       = process.env.SERVER_NAME || '';
  bitacora.process      = 'Obtener una lista de precios';

  try {
    let result;
    switch (dbServer) {
      case 'MongoDB':
        result = await GetOneZTPreciosListaMongo(IDLISTAOK);
        break;
      case 'CosmosDB':
        result = await GetOneZTPreciosListaCosmos(IDLISTAOK);
        break;
      default:
        throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes    = result;
    data.messageUSR = 'Lista de precios obtenida correctamente';
    data.messageDEV = 'GetOneZTPreciosListaMongo ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;

  } catch (error) {
    data.messageUSR = 'Error al obtener la lista de precios';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

async function AddOneMethod(bitacora, params, body, req, dbServer) {
  let data = DATA();

  data.process        = 'Agregar una nueva lista de precios';
  data.processType    = params.ProcessType || '';
  data.loggedUser     = params.LoggedUser || '';
  data.dbServer       = dbServer;
  data.server         = process.env.SERVER_NAME || '';
  data.api            = '/api/ztprecios‑listas/preciosListasCRUD';

  bitacora.processType  = params.ProcessType || '';
  bitacora.loggedUser   = params.LoggedUser || '';
  bitacora.dbServer     = dbServer;
  bitacora.server       = process.env.SERVER_NAME || '';
  bitacora.process      = 'Agregar una nueva lista de precios';

  try {
    let result;
    switch (dbServer) {
      case 'MongoDB':
        result = await CreateZTPreciosListaMongo(body, params.LoggedUser);
        break;
      case 'CosmosDB':
        result = await CreateZTPreciosListaCosmos(body, params.LoggedUser);
        break;
      default:
        throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes    = result;
    data.messageUSR = 'Lista de precios creada correctamente';
    data.messageDEV = 'CreateZTPreciosListaMongo ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 201, true); // POST -> 201 Created
    bitacora.success = true;
    return bitacora;

  } catch (error) {
    data.messageUSR = 'Error al crear la lista de precios';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

async function UpdateOneMethod(bitacora, params, IDLISTAOK, req, user, dbServer) {
  let data = DATA();

  data.process        = 'Actualizar lista de precios';
  data.processType    = params.ProcessType || '';
  data.loggedUser     = params.LoggedUser || '';
  data.dbServer       = dbServer;
  data.server         = process.env.SERVER_NAME || '';
  data.api            = '/api/ztprecios‑listas/preciosListasCRUD';

  bitacora.processType  = params.ProcessType || '';
  bitacora.loggedUser   = params.LoggedUser || '';
  bitacora.dbServer     = dbServer;
  bitacora.server       = process.env.SERVER_NAME || '';
  bitacora.process      = 'Actualizar lista de precios';

  try {
    let result;
    switch (dbServer) {
      case 'MongoDB':
        result = await UpdateZTPreciosListaMongo(IDLISTAOK, req.req.body, user);
        break;
      case 'CosmosDB':
        result = await UpdateZTPreciosListaCosmos(IDLISTAOK, req.req.body, user);
        break;
      default:
        throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes    = result;
    data.messageUSR = 'Lista de precios actualizada correctamente';
    data.messageDEV = 'UpdateZTPreciosListaMongo ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;

  } catch (error) {
    data.messageUSR = 'Error al actualizar la lista de precios';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

async function DeleteLogicMethod(bitacora, params, IDLISTAOK, user, dbServer) {
  let data = DATA();

  data.process        = 'Borrado lógico de lista de precios';
  data.processType    = params.ProcessType || '';
  data.loggedUser     = params.LoggedUser || '';
  data.dbServer       = dbServer;
  data.server         = process.env.SERVER_NAME || '';
  data.api            = '/api/ztprecios‑listas/preciosListasCRUD';

  bitacora.processType  = params.ProcessType || '';
  bitacora.loggedUser   = params.LoggedUser || '';
  bitacora.dbServer     = dbServer;
  bitacora.server       = process.env.SERVER_NAME || '';
  bitacora.process      = 'Borrado lógico de lista de precios';

  try {
    let result;
    switch (dbServer) {
      case 'MongoDB':
        result = await DeleteLogicZTPreciosListaMongo(IDLISTAOK, params.LoggedUser);
        break;
      case 'CosmosDB':
        result = await DeleteLogicZTPreciosListaCosmos(IDLISTAOK, params.LoggedUser);
        break;
      default:
        throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes    = result;
    data.messageUSR = 'Lista de precios marcada como eliminada logicamente';
    data.messageDEV = 'DeleteLogicZTPreciosListaMongo ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;

  } catch (error) {
    if (error.message.includes('No se encontró')) {
      data.messageUSR = 'No se encontró la lista para eliminar';
      data.messageDEV = error.message;
      bitacora = AddMSG(bitacora, data, 'FAIL', 404, true);
    } else {
      data.messageUSR = 'Error al borrar logicamente la lista de precios';
      data.messageDEV = error.message;
      bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    }
    bitacora.success = false;
    return bitacora;
  }
}

async function DeleteHardMethod(bitacora, params, IDLISTAOK, dbServer) {
  let data = DATA();

  data.process        = 'Borrado permanente de lista de precios';
  data.processType    = params.ProcessType || '';
  data.loggedUser     = params.LoggedUser || '';
  data.dbServer       = dbServer;
  data.server         = process.env.SERVER_NAME || '';
  data.api            = '/api/ztprecios‑listas/preciosListasCRUD';

  bitacora.processType  = params.ProcessType || '';
  bitacora.loggedUser   = params.LoggedUser || '';
  bitacora.dbServer     = dbServer;
  bitacora.server       = process.env.SERVER_NAME || '';
  bitacora.process      = 'Borrado permanente de lista de precios';

  try {
    let result;
    switch (dbServer) {
      case 'MongoDB':
        result = await DeleteHardZTPreciosListaMongo(IDLISTAOK);
        break;
      case 'CosmosDB':
        result = await DeleteHardZTPreciosListaCosmos(IDLISTAOK);
        break;
      default:
        throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes    = result;
    data.messageUSR = 'Lista de precios eliminada permanentemente';
    data.messageDEV = 'DeleteHardZTPreciosListaMongo ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;

  } catch (error) {
    data.messageUSR = 'Error al eliminar permanentemente la lista de precios';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

async function ActivateOneMethod(bitacora, params, IDLISTAOK, user, dbServer) {
  let data = DATA();

  data.process        = 'Reactivar lista de precios';
  data.processType    = params.ProcessType || '';
  data.loggedUser     = params.LoggedUser || '';
  data.dbServer       = dbServer;
  data.server         = process.env.SERVER_NAME || '';
  data.api            = '/api/ztprecios‑listas/preciosListasCRUD';

  bitacora.processType  = params.ProcessType || '';
  bitacora.loggedUser   = params.LoggedUser || '';
  bitacora.dbServer     = dbServer;
  bitacora.server       = process.env.SERVER_NAME || '';
  bitacora.process      = 'Reactivar lista de precios';

  try {
    let result;
    switch (dbServer) {
      case 'MongoDB':
        result = await ActivateZTPreciosListaMongo(IDLISTAOK, params.LoggedUser);
        break;
      case 'CosmosDB':
        result = await ActivateZTPreciosListaCosmos(IDLISTAOK, params.LoggedUser);
        break;
      default:
        throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes    = result;
    data.messageUSR = 'Lista de precios activada correctamente';
    data.messageDEV = 'ActivateZTPreciosListaMongo ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;

  } catch (error) {
    data.messageUSR = 'Error al activar la lista de precios';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

async function GetBySKUIDMethod(bitacora, params, skuid, dbServer) {
  let data = DATA();

  // configurar contexto de data
  data.process        = 'Obtener listas de precios por SKUID';
  data.processType    = params.ProcessType || '';
  data.loggedUser     = params.LoggedUser || '';
  data.dbServer       = dbServer;
  data.server         = process.env.SERVER_NAME || '';
  data.api            = '/api/ztprecios‑listas/preciosListasCRUD';

  // propagar en bitácora
  bitacora.processType  = params.ProcessType || '';
  bitacora.loggedUser   = params.LoggedUser || '';
  bitacora.dbServer     = dbServer;
  bitacora.server       = process.env.SERVER_NAME || '';
  bitacora.process      = 'Obtener listas de precios por SKUID';

  try {
    let result;
    switch (dbServer) {
      case 'MongoDB':
        result = await GetZTPreciosListasBySKUIDMongo(skuid);
        break;
      case 'CosmosDB':
        result = await GetZTPreciosListasBySKUIDCosmos(skuid);
        break;
      default:
        throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes   = result;
    data.messageUSR = 'Listas obtenidas correctamente por SKUID';
    data.messageDEV = 'GetZTPreciosListasBySKUIDMongo ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;

  } catch (error) {
    data.messageUSR = 'Error al obtener las listas por SKUID';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

// ============================================
// FUNCIÓN PRINCIPAL CRUD
// ============================================
async function ZTPreciosListasCRUD(req) {
  let bitacora = BITACORA();
  let data     = DATA();

  try {
    const params     = req.req?.query || {};
    const body       = req.req?.body;
    const paramString= params ? new URLSearchParams(params).toString().trim() : '';
    const { ProcessType, LoggedUser, DBServer, IDLISTAOK, skuid } = params;

    // validación de parámetros obligatorios: ProcessType y LoggedUser
    if (!ProcessType) {
      data.process     = 'Validación de parámetros obligatorios';
      data.messageUSR  = 'Falta parámetro obligatorio: ProcessType';
      data.messageDEV  = 'ProcessType es requerido para ejecutar la API';
      bitacora         = AddMSG(bitacora, data, 'FAIL', 400, true);
      bitacora.finalRes= true;
      return FAIL(bitacora);
    }

    if (!LoggedUser) {
      data.process     = 'Validación de parámetros obligatorios';
      data.messageUSR  = 'Falta parámetro obligatorio: LoggedUser';
      data.messageDEV  = 'LoggedUser es requerido para trazabilidad del sistema';
      bitacora         = AddMSG(bitacora, data, 'FAIL', 400, true);
      bitacora.finalRes= true;
      return FAIL(bitacora);
    }

    const dbServer = DBServer || 'MongoDB'; // default
    bitacora.processType  = ProcessType;
    bitacora.loggedUser   = LoggedUser;
    bitacora.dbServer     = dbServer;
    bitacora.queryString  = paramString;
    bitacora.method       = req.req?.method || 'UNKNOWN';
    bitacora.api          = '/api/ztprecios‑listas/preciosListasCRUD';
    bitacora.server       = process.env.SERVER_NAME || 'No especificado';

    switch (ProcessType) {
      case 'GetAll':
        bitacora = await GetAllMethod(bitacora, params, paramString, body, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      case 'GetOne':
        if (!IDLISTAOK) {
          data.process     = 'Validación de parámetro IDLISTAOK';
          data.messageUSR  = 'Falta IDLISTAOK';
          data.messageDEV  = 'Parámetro IDLISTAOK requerido';
          bitacora         = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes= true;
          return FAIL(bitacora);
        }
        bitacora = await GetOneMethod(bitacora, params, IDLISTAOK, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      case 'AddOne':
        bitacora = await AddOneMethod(bitacora, params, body, req, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      case 'UpdateOne':
        if (!IDLISTAOK) {
          data.process     = 'Validación de parámetro IDLISTAOK';
          data.messageUSR  = 'Falta IDLISTAOK';
          data.messageDEV  = 'Parámetro IDLISTAOK requerido';
          bitacora         = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes= true;
          return FAIL(bitacora);
        }
        bitacora = await UpdateOneMethod(bitacora, params, IDLISTAOK, req, LoggedUser, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      case 'DeleteLogic':
        if (!IDLISTAOK) {
          data.process     = 'Validación de parámetro IDLISTAOK';
          data.messageUSR  = 'Falta IDLISTAOK';
          data.messageDEV  = 'Parámetro IDLISTAOK requerido';
          bitacora         = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes= true;
          return FAIL(bitacora);
        }
        bitacora = await DeleteLogicMethod(bitacora, params, IDLISTAOK, LoggedUser, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      case 'DeleteHard':
        if (!IDLISTAOK) {
          data.process     = 'Validación de parámetro IDLISTAOK';
          data.messageUSR  = 'Falta IDLISTAOK';
          data.messageDEV  = 'Parámetro IDLISTAOK requerido';
          bitacora         = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes= true;
          return FAIL(bitacora);
        }
        bitacora = await DeleteHardMethod(bitacora, params, IDLISTAOK, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      case 'ActivateOne':
        if (!IDLISTAOK) {
          data.process     = 'Validación de parámetro IDLISTAOK';
          data.messageUSR  = 'Falta IDLISTAOK';
          data.messageDEV  = 'Parámetro IDLISTAOK requerido';
          bitacora         = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes= true;
          return FAIL(bitacora);
        }
        bitacora = await ActivateOneMethod(bitacora, params, IDLISTAOK, LoggedUser, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      case 'GetBySKUID':
        if (!skuid) {
          data.process     = 'Validación de parámetro skuid';
          data.messageUSR  = 'Falta skuid';
          data.messageDEV  = 'Parámetro skuid requerido';
          bitacora         = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes= true;
          return FAIL(bitacora);
        }
        bitacora = await GetBySKUIDMethod(bitacora, params, skuid, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      default:
        data.process     = 'Validación de ProcessType';
        data.messageUSR  = 'ProcessType inválido o no especificado';
        data.messageDEV  = `Valor inválido: ${ProcessType}`;
        bitacora         = AddMSG(bitacora, data, 'FAIL', 400, true);
        bitacora.finalRes= true;
        return FAIL(bitacora);
    }

    return OK(bitacora);

  } catch (error) {
    data.process        = 'Catch principal ZTPreciosListasCRUD';
    data.messageUSR     = 'Ocurrió un error inesperado en el endpoint';
    data.messageDEV     = error.message;
    data.stack          = process.env.NODE_ENV === 'development' ? error.stack : undefined;
    bitacora            = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.finalRes   = true;
    return FAIL(bitacora);
  }
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
  ZTPreciosListasCRUD,
  GetAllZTPreciosListasMongo,
  GetOneZTPreciosListaMongo,
  CreateZTPreciosListaMongo,
  UpdateZTPreciosListaMongo,
  DeleteLogicZTPreciosListaMongo,
  DeleteHardZTPreciosListaMongo,
  ActivateZTPreciosListaMongo,
  GetZTPreciosListasBySKUIDMongo,
  // Cosmos DB Functions
  GetAllZTPreciosListasCosmos,
  GetOneZTPreciosListaCosmos,
  CreateZTPreciosListaCosmos,
  UpdateZTPreciosListaCosmos,
  DeleteLogicZTPreciosListaCosmos,
  DeleteHardZTPreciosListaCosmos,
  ActivateZTPreciosListaCosmos,
  GetZTPreciosListasBySKUIDCosmos
};
