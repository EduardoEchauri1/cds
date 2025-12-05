/**
 * Archivo: ztcategorias-service.js
 * Autor: Bayron Arciniega
 */
/** IMPORTS
 * Autor: Bayron Arciniega
 */
const { getCosmosDatabase } = require('../../config/connectToMongoDB.config');
const ZTCATEGORIAS = require('../models/mongodb/ztcategorias');
const { OK, FAIL, BITACORA, DATA, AddMSG } = require('../../middlewares/respPWA.handler');
const { saveWithAudit } = require('../../helpers/audit-timestap');

/** Función: getPayload - Util: payload desde CDS/Express
 * Autor: Bayron Arciniega
 */
function getPayload(req) {
  return req.data || req.req?.body || null;
}

/** UTIL: Obtener contenedor de Cosmos DB
 * Autor: Bayron Arciniega
 */
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

/** Helper específico para este servicio: getCategoriasCosmosContainer
 * Autor: Bayron Arciniega
 */
async function getCategoriasCosmosContainer() {
  return getCosmosContainer('ZTCATEGORIAS', '/CATID');
}

/** OPERACIONES MONGO
 * Autor: Bayron Arciniega
 */
/** Función: GetAllZTCategorias
 * Autor: Bayron Arciniega
 */
async function GetAllZTCategorias() {
  return await ZTCATEGORIAS.find({ DELETED: { $ne: true } }).lean();
}

/** Función: GetOneZTCategoria
 * Autor: Bayron Arciniega
 */
async function GetOneZTCategoria(catid) {
  if (!catid) throw new Error('Falta parámetro catid');
  const doc = await ZTCATEGORIAS.findOne({ CATID: catid }).lean();
  if (!doc) throw new Error('No se encontró la categoría');
  return doc;
}

/** Función: AddOneZTCategoria
 * Autor: Bayron Arciniega
 */
async function AddOneZTCategoria(payload, user) {
  if (!payload) throw new Error('No se recibió payload');

  /** Inyectar el usuario logueado si no viene en el body
   * Autor: Bayron Arciniega
   */
  if (!payload.REGUSER && user) {
    payload.REGUSER = user;
  }

  const required = ['CATID', 'Nombre', 'REGUSER'];
  const missing = required.filter(k => !payload[k]);
  if (missing.length) throw new Error(`Faltan campos obligatorios: ${missing.join(', ')}`);

  const dup = await ZTCATEGORIAS.findOne({ CATID: payload.CATID }).lean();
  if (dup) throw new Error('Ya existe una categoría con ese CATID');

  const data = {
    CATID: payload.CATID,
    Nombre: payload.Nombre,
    PadreCATID: payload.PadreCATID ?? null,
    ACTIVED: payload.ACTIVED ?? true,
    DELETED: payload.DELETED ?? false,
    REGUSER: payload.REGUSER
    /** Nota: REGDATE y HISTORY se llenan por hook
     * Autor: Bayron Arciniega
     */
  };

  const created = await saveWithAudit(ZTCATEGORIAS, {}, data, payload.REGUSER, 'CREATE');
  return created;
}


/** Función: UpdateOneZTCategoria
 * Autor: Bayron Arciniega
 */
async function UpdateOneZTCategoria(catid, cambios, user) {
  if (!catid) throw new Error('Falta parámetro catid');
  if (!cambios || Object.keys(cambios).length === 0) throw new Error('No se enviaron datos para actualizar');

  /** Prevención de colisión de CATID al actualizar.
   * Si se intenta cambiar el CATID, verificar que no exista en otro documento.
   * Autor: Bayron Arciniega
   */
  if (cambios.CATID && cambios.CATID !== catid) {
    const dup = await ZTCATEGORIAS.findOne({ CATID: cambios.CATID }).lean();
    if (dup) throw new Error(`El nuevo CATID '${cambios.CATID}' ya está en uso por otra categoría.`);
  }

  const filter = { CATID: catid };
  const updated = await saveWithAudit(ZTCATEGORIAS, filter, cambios, user, 'UPDATE');
  return updated;
}

/** Función: DeleteLogicZTCategoria
 * Autor: Bayron Arciniega
 */
async function DeleteLogicZTCategoria(catid, user) {
  if (!catid) throw new Error('Falta parámetro catid');
  const filter = { CATID: catid };
  const data = { ACTIVED: false, DELETED: true };
  const res = await saveWithAudit(ZTCATEGORIAS, filter, data, user, 'UPDATE');
  return res;
}

/** Función: DeleteHardZTCategoria
 * Autor: Bayron Arciniega
 */
async function DeleteHardZTCategoria(catid) {
  if (!catid) throw new Error('Falta parámetro catid');
  const eliminado = await ZTCATEGORIAS.findOneAndDelete({ CATID: catid });
  if (!eliminado) throw new Error('No se encontró la categoría para eliminar');
  return { mensaje: 'Categoría eliminada permanentemente', CATID: catid };
}

/** Función: ActivateZTCategoria
 * Autor: Bayron Arciniega
 */
async function ActivateZTCategoria(catid, user) {
  if (!catid) throw new Error('Falta parámetro catid');
  const filter = { CATID: catid };
  const data = { ACTIVED: true, DELETED: false };
  const res = await saveWithAudit(ZTCATEGORIAS, filter, data, user, 'UPDATE');
  return res;
}

/** OPERACIONES COSMOS DB
 * Autor: Bayron Arciniega
 */
/** Función: GetAllZTCategoriasCosmos
 * Autor: Bayron Arciniega
 */
async function GetAllZTCategoriasCosmos() {
  const container = await getCategoriasCosmosContainer();
  const query = "SELECT * from c WHERE c.DELETED != true";
  const { resources: items } = await container.items.query(query).fetchAll();
  return items;
}

/** Función: GetOneZTCategoriaCosmos
 * Autor: Bayron Arciniega
 */
async function GetOneZTCategoriaCosmos(catid) {
  if (!catid) throw new Error('Falta parámetro catid');
  const container = await getCategoriasCosmosContainer();
  const { resource: item } = await container.item(catid, catid).read();
  if (!item) throw new Error('No se encontró la categoría');
  return item;
}

/** Función: AddOneZTCategoriaCosmos
 * Autor: Bayron Arciniega
 */
async function AddOneZTCategoriaCosmos(payload, user) {
  if (!payload) throw new Error('No se recibió payload');

  /** Inyectar el usuario logueado si no viene en el body
   * Autor: Bayron Arciniega
   */
  if (!payload.REGUSER && user) {
    payload.REGUSER = user;
  }

  const required = ['CATID', 'Nombre', 'REGUSER'];
  const missing = required.filter(k => !payload[k]);
  if (missing.length) throw new Error(`Faltan campos obligatorios: ${missing.join(', ')}`);

  const container = await getCategoriasCosmosContainer();

  const { resource: existing } = await container.item(payload.CATID, payload.CATID).read().catch(() => ({}));
  if (existing) throw new Error(`Ya existe una categoría con el CATID: ${payload.CATID}`);

  const newItem = {
    id: payload.CATID,
    partitionKey: payload.CATID,
    CATID: payload.CATID,
    Nombre: payload.Nombre,
    PadreCATID: payload.PadreCATID ?? null,
    ACTIVED: payload.ACTIVED ?? true,
    DELETED: payload.DELETED ?? false,
    REGUSER: payload.REGUSER,
    REGDATE: new Date().toISOString(),
    HISTORY: [{
      user: payload.REGUSER,
      event: "CREATE",
      date: new Date().toISOString(),
      changes: { CATID: payload.CATID, Nombre: payload.Nombre, PadreCATID: payload.PadreCATID }
    }]
  };

  const { resource: createdItem } = await container.items.create(newItem);
  return createdItem;
}

/** Función: UpdateOneZTCategoriaCosmos
 * Autor: Bayron Arciniega
 */
async function UpdateOneZTCategoriaCosmos(catid, cambios, user) {
  if (!catid) throw new Error('Falta parámetro catid');
  if (!cambios || Object.keys(cambios).length === 0) throw new Error('No se enviaron datos para actualizar');

  const container = await getCategoriasCosmosContainer();
  const { resource: currentItem } = await container.item(catid, catid).read();
  if (!currentItem) throw new Error(`No se encontró la categoría para actualizar con CATID: ${catid}`);

  if (cambios.CATID && cambios.CATID !== catid) {
    const { resource: existing } = await container.item(cambios.CATID, cambios.CATID).read().catch(() => ({}));
    if (existing) throw new Error(`El nuevo CATID '${cambios.CATID}' ya está en uso por otra categoría.`);
  }

  const updatedItem = {
    ...currentItem,
    ...cambios,
    /** El ID no debe cambiar en una actualización
     * Autor: Bayron Arciniega
     */
    id: currentItem.id,
    /** La clave de partición no debe cambiar
     * Autor: Bayron Arciniega
     */
    partitionKey: currentItem.partitionKey,
    MODUSER: user,
    MODDATE: new Date().toISOString(),
    HISTORY: [...(currentItem.HISTORY || []), { user, action: 'UPDATE', date: new Date().toISOString(), changes: cambios }]
  };

  const { resource: replacedItem } = await container.item(currentItem.id, currentItem.partitionKey).replace(updatedItem);
  return replacedItem;
}

/** Función: DeleteLogicZTCategoriaCosmos
 * Autor: Bayron Arciniega
 */
async function DeleteLogicZTCategoriaCosmos(catid, user) {
  if (!catid) throw new Error('Falta parámetro catid');
  const container = await getCategoriasCosmosContainer();
  const { resource: currentItem } = await container.item(catid, catid).read();
  if (!currentItem) throw new Error(`No se encontró la categoría para borrado lógico con CATID: ${catid}`);

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

/** Función: DeleteHardZTCategoriaCosmos
 * Autor: Bayron Arciniega
 */
async function DeleteHardZTCategoriaCosmos(catid) {
  if (!catid) throw new Error('Falta parámetro catid');
  const container = await getCategoriasCosmosContainer();
  await container.item(catid, catid).delete();
  return { mensaje: 'Categoría eliminada permanentemente de Cosmos DB', CATID: catid };
}

/** Función: ActivateZTCategoriaCosmos
 * Autor: Bayron Arciniega
 */
async function ActivateZTCategoriaCosmos(catid, user) {
  if (!catid) throw new Error('Falta parámetro catid');
  const container = await getCategoriasCosmosContainer();
  const { resource: currentItem } = await container.item(catid, catid).read();
  if (!currentItem) throw new Error(`No se encontró la categoría para activar con CATID: ${catid}`);

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

/** MÉTODOS con BITÁCORA (patrón)
 * Autor: Bayron Arciniega
 */
/** Función: GetAllMethod - MÉTODOS con BITÁCORA
 * Autor: Bayron Arciniega
 */
async function GetAllMethod(bitacora, req, params, paramString, body, dbServer) {
  let data = DATA();
  data.process = 'Obtener todas las categorías';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || '';
  data.method = req.req?.method || 'No Especificado';
  data.api = '/api/ztcategorias/categoriasCRUD';
  data.queryString = paramString;

  bitacora.processType = data.processType;
  bitacora.loggedUser = data.loggedUser;
  bitacora.dbServer = dbServer;
  bitacora.server = data.server;
  bitacora.process = data.process;

  try {
    let docs;
    switch (dbServer) {
      case 'MongoDB': docs = await GetAllZTCategorias(); break;
      case 'CosmosDB': docs = await GetAllZTCategoriasCosmos(); break;
      default: throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes = docs;
    data.messageUSR = 'Categorías obtenidas correctamente';
    data.messageDEV = 'GetAllZTCategorias ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;
  } catch (error) {
    data.messageUSR = 'Error al obtener las categorías';
    data.messageDEV = error.message;
    data.stack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

/** Función: GetOneMethod - MÉTODOS con BITÁCORA
 * Autor: Bayron Arciniega
 */
async function GetOneMethod(bitacora, params, catid, dbServer) {
  let data = DATA();
  data.process = 'Obtener una categoría';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || '';
  data.api = '/api/ztcategorias/categoriasCRUD';

  bitacora.processType = data.processType;
  bitacora.loggedUser = data.loggedUser;
  bitacora.dbServer = dbServer;
  bitacora.server = data.server;
  bitacora.process = data.process;

  try {
    let doc;
    switch (dbServer) {
      case 'MongoDB': doc = await GetOneZTCategoria(catid); break;
      case 'CosmosDB': doc = await GetOneZTCategoriaCosmos(catid); break;
      default: throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes = doc;
    data.messageUSR = 'Categoría obtenida correctamente';
    data.messageDEV = 'GetOneZTCategoria ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;
  } catch (error) {
    data.messageUSR = 'Error al obtener la categoría';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', error.message.includes('No se encontró') ? 404 : 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

/** Función: AddOneMethod - MÉTODOS con BITÁCORA
 * Autor: Bayron Arciniega
 */
async function AddOneMethod(bitacora, params, body, req, dbServer) {
  let data = DATA();
  data.process = 'Agregar categoría';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || '';
  data.api = '/api/ztcategorias/categoriasCRUD';

  bitacora.processType = data.processType;
  bitacora.loggedUser = data.loggedUser;
  bitacora.dbServer = dbServer;
  bitacora.server = data.server;
  bitacora.process = data.process;

  try {
    let result;
    switch (dbServer) {
      case 'MongoDB': result = await AddOneZTCategoria(getPayload(req), params.LoggedUser); break;
      case 'CosmosDB': result = await AddOneZTCategoriaCosmos(getPayload(req), params.LoggedUser); break;
      default: throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes = result;
    data.messageUSR = 'Categoría creada correctamente';
    data.messageDEV = 'AddOne ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 201, true);
    bitacora.success = true;

    if (req?.http?.res) {
      req.http.res.status(201);
      const id = (result && (result.CATID || result?.data?.CATID)) || '';
      if (id) {
        req.http.res.set('Location', `/api/ztcategorias/Categorias('${id}')`);
      }
    }
    return bitacora;
  } catch (error) {
    data.messageUSR = 'Error al crear la categoría';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

/** Función: UpdateOneMethod - MÉTODOS con BITÁCORA
 * Autor: Bayron Arciniega
 */
async function UpdateOneMethod(bitacora, params, catid, req, user, dbServer) {
  let data = DATA();
  data.process = 'Actualizar categoría';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || '';
  data.api = '/api/ztcategorias/categoriasCRUD';

  bitacora.processType = data.processType;
  bitacora.loggedUser = data.loggedUser;
  bitacora.dbServer = dbServer;
  bitacora.server = data.server;
  bitacora.process = data.process;

  try {
    let result;
    switch (dbServer) {
      case 'MongoDB': result = await UpdateOneZTCategoria(catid, getPayload(req), user); break;
      case 'CosmosDB': result = await UpdateOneZTCategoriaCosmos(catid, getPayload(req), user); break;
      default: throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes = result;
    data.messageUSR = 'Categoría actualizada correctamente';
    data.messageDEV = 'UpdateOne ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;
  } catch (error) {
    data.messageUSR = 'Error al actualizar la categoría';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', error.message.includes('No se encontró') ? 404 : 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

/** Función: DeleteLogicMethod - MÉTODOS con BITÁCORA
 * Autor: Bayron Arciniega
 */
async function DeleteLogicMethod(bitacora, params, catid, user, dbServer) {
  let data = DATA();
  data.process = 'Borrado lógico de categoría';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || '';
  data.api = '/api/ztcategorias/categoriasCRUD';

  bitacora.processType = data.processType;
  bitacora.loggedUser = data.loggedUser;
  bitacora.dbServer = dbServer;
  bitacora.server = data.server;
  bitacora.process = data.process;

  try {
    let result;
    switch (dbServer) {
      case 'MongoDB': result = await DeleteLogicZTCategoria(catid, user); break;
      case 'CosmosDB': result = await DeleteLogicZTCategoriaCosmos(catid, user); break;
      default: throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes = result;
    data.messageUSR = 'Categoría borrada lógicamente';
    data.messageDEV = 'DeleteLogic ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;
  } catch (error) {
    if (error.message.includes('No se encontró')) {
      data.messageUSR = 'No se encontró la categoría especificada para borrar.';
      data.messageDEV = error.message;
      bitacora = AddMSG(bitacora, data, 'FAIL', 404, true);
    } else {
      data.messageUSR = 'Error al borrar lógicamente la categoría';
      data.messageDEV = error.message;
      bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    }
    bitacora.success = false;
    return bitacora;
  }
}

/** Función: DeleteHardMethod - MÉTODOS con BITÁCORA
 * Autor: Bayron Arciniega
 */
async function DeleteHardMethod(bitacora, params, catid, dbServer) {
  let data = DATA();
  data.process = 'Borrado permanente de categoría';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || '';
  data.api = '/api/ztcategorias/categoriasCRUD';

  bitacora.processType = data.processType;
  bitacora.loggedUser = data.loggedUser;
  bitacora.dbServer = dbServer;
  bitacora.server = data.server;
  bitacora.process = data.process;

  try {
    let result;
    switch (dbServer) {
      case 'MongoDB': result = await DeleteHardZTCategoria(catid); break;
      case 'CosmosDB': result = await DeleteHardZTCategoriaCosmos(catid); break;
      default: throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes = result;
    data.messageUSR = 'Categoría borrada permanentemente';
    data.messageDEV = 'DeleteHard ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;
  } catch (error) {
    data.messageUSR = 'Error al borrar permanentemente la categoría';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

/** Función: ActivateOneMethod - MÉTODOS con BITÁCORA
 * Autor: Bayron Arciniega
 */
async function ActivateOneMethod(bitacora, params, catid, user, dbServer) {
  let data = DATA();
  data.process = 'Activar categoría';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || '';
  data.api = '/api/ztcategorias/categoriasCRUD';

  bitacora.processType = data.processType;
  bitacora.loggedUser = data.loggedUser;
  bitacora.dbServer = dbServer;
  bitacora.server = data.server;
  bitacora.process = data.process;

  try {
    let result;
    switch (dbServer) {
      case 'MongoDB': result = await ActivateZTCategoria(catid, user); break;
      case 'CosmosDB': result = await ActivateZTCategoriaCosmos(catid, user); break;
      default: throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes = result;
    data.messageUSR = 'Categoría activada correctamente';
    data.messageDEV = 'Activate ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;
  } catch (error) {
    data.messageUSR = 'Error al activar la categoría';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

/** ORQUESTADOR PRINCIPAL - ZTCategoriasCRUD
 * Autor: Bayron Arciniega
 */
async function ZTCategoriasCRUD(req) {
  let bitacora = BITACORA();
  let data = DATA();

  try {
    const params = req.req?.query || {};
    const body = req.req?.body;
    const paramString = params ? new URLSearchParams(params).toString().trim() : '';

    /** Soporte: catid puede venir en mayúsculas o minúsculas
     * Autor: Bayron Arciniega
     */
    const catid = params.catid || params.CATID || undefined;
    const { ProcessType, LoggedUser, DBServer } = params;

    if (!ProcessType) {
      data.process = 'Validación de parámetros obligatorios';
      data.messageUSR = 'Falta parámetro obligatorio: ProcessType';
      data.messageDEV = 'Valores válidos: GetAll, GetOne, AddOne, UpdateOne, DeleteLogic, DeleteHard, ActivateOne';
      bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
      bitacora.finalRes = true;
      return FAIL(bitacora);
    }
    if (!LoggedUser) {
      data.process = 'Validación de parámetros obligatorios';
      data.messageUSR = 'Falta parámetro obligatorio: LoggedUser';
      data.messageDEV = 'LoggedUser es requerido para trazabilidad del sistema';
      bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
      bitacora.finalRes = true;
      return FAIL(bitacora);
    }

    const dbServer = DBServer || 'MongoDB';
    bitacora.processType = ProcessType;
    bitacora.loggedUser = LoggedUser;
    bitacora.dbServer = dbServer;
    bitacora.queryString = paramString;
    bitacora.method = req.req?.method || 'UNKNOWN';
    bitacora.api = '/api/ztcategorias/categoriasCRUD';
    bitacora.server = process.env.SERVER_NAME || 'No especificado';

    switch (ProcessType) {
      case 'GetAll':
        bitacora = await GetAllMethod(bitacora, req, params, paramString, body, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      case 'GetOne':
        if (!catid) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: CATID';
          data.messageDEV = 'CATID es requerido para GetOne';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await GetOneMethod(bitacora, params, catid, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      case 'AddOne':
        bitacora = await AddOneMethod(bitacora, params, body, req, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      case 'UpdateOne':
        if (!catid) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: CATID';
          data.messageDEV = 'CATID es requerido para UpdateOne';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await UpdateOneMethod(bitacora, params, catid, req, LoggedUser, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      case 'DeleteLogic':
        if (!catid) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: CATID';
          data.messageDEV = 'CATID es requerido para DeleteLogic';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await DeleteLogicMethod(bitacora, params, catid, LoggedUser, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      case 'DeleteHard':
        if (!catid) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: CATID';
          data.messageDEV = 'CATID es requerido para DeleteHard';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await DeleteHardMethod(bitacora, params, catid, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      case 'ActivateOne':
        if (!catid) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: CATID';
          data.messageDEV = 'CATID es requerido para ActivateOne';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await ActivateOneMethod(bitacora, params, catid, LoggedUser, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      default:
        data.process = 'Validación de ProcessType';
        data.messageUSR = 'ProcessType inválido o no especificado';
        data.messageDEV = 'Debe ser: GetAll, GetOne, AddOne, UpdateOne, DeleteLogic, DeleteHard, ActivateOne';
        bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
        bitacora.finalRes = true;
        return FAIL(bitacora);
    }

    return OK(bitacora);
  } catch (error) {
    if (bitacora.finalRes) {
      let dataCatch = DATA();
      dataCatch.process = 'Catch principal ZTCategoriasCRUD';
      dataCatch.messageUSR = 'Ocurrió un error inesperado en el endpoint';
      dataCatch.messageDEV = error.message;
      dataCatch.stack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
      bitacora = AddMSG(bitacora, dataCatch, 'FAIL', 500, true);
      bitacora.finalRes = true;
    }
    req.error({
      code: 'Internal-Server-Error',
      status: bitacora.status || 500,
      message: bitacora.messageUSR,
      target: bitacora.messageDEV,
      numericSeverity: 1,
      innererror: bitacora
    });
    return FAIL(bitacora);
  }
}

/** EXPORTS
 * Autor: Bayron Arciniega
 */
module.exports = {
  ZTCategoriasCRUD,

  GetAllZTCategorias,
  GetOneZTCategoria,
  AddOneZTCategoria,
  UpdateOneZTCategoria,
  DeleteLogicZTCategoria,
  DeleteHardZTCategoria,
  ActivateZTCategoria,
  /** Cosmos DB Functions
   * Autor: Bayron Arciniega
   */
  GetAllZTCategoriasCosmos,
  GetOneZTCategoriaCosmos,
  AddOneZTCategoriaCosmos,
  UpdateOneZTCategoriaCosmos,
  DeleteLogicZTCategoriaCosmos,
  DeleteHardZTCategoriaCosmos,
  ActivateZTCategoriaCosmos
};
