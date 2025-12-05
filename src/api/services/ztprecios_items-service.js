const { getCosmosDatabase } = require('../../config/connectToMongoDB.config');
const { ZTPrecios_ITEMS } = require('../models/mongodb/ztprecios_items');
const { OK, FAIL, BITACORA, DATA, AddMSG } = require('../../middlewares/respPWA.handler');
const { saveWithAudit } = require('../../helpers/audit-timestap');

function getPayload(req) {
  return req.data || req.req?.body || null;
}

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

async function getPreciosItemsCosmosContainer() {
  return getCosmosContainer('ZTPRECIOS_ITEMS', '/IdPrecioOK');
}

async function GetAllZTPreciosItems() {
  return await ZTPrecios_ITEMS.find({ DELETED: { $ne: true } }).lean();
}

async function GetOneZTPreciosItem(IdPrecioOK) {
  if (!IdPrecioOK) throw new Error('Falta parámetro IdPrecioOK');
  const doc = await ZTPrecios_ITEMS.findOne({ IdPrecioOK }).lean();
  if (!doc) throw new Error('No se encontró el precio');
  return doc;
}

async function AddOneZTPreciosItem(payload, user) {
  if (!payload) throw new Error('No se recibió payload');

  const required = ['IdPrecioOK', 'IdListaOK', 'SKUID', 'IdPresentaOK', 'Precio'];
  const missing = required.filter(k => payload[k] === undefined || payload[k] === null || payload[k] === '');
  if (missing.length) throw new Error(`Faltan campos obligatorios: ${missing.join(', ')}`);

  const dup = await ZTPrecios_ITEMS.findOne({ IdPrecioOK: payload.IdPrecioOK }).lean();
  if (dup) throw new Error('Ya existe un precio con ese IdPrecioOK');

  const data = {
    IdPrecioOK: payload.IdPrecioOK,
    IdListaOK: payload.IdListaOK,
    SKUID: payload.SKUID,
    IdPresentaOK: payload.IdPresentaOK,
    IdTipoFormulaOK: payload.IdTipoFormulaOK ?? null,
    Formula: payload.Formula ?? "",
    CostoIni: payload.CostoIni ?? 0,
    CostoFin: payload.CostoFin ?? 0,
    Precio: payload.Precio,
    ACTIVED: payload.ACTIVED ?? true,
    DELETED: payload.DELETED ?? false,
  };

  const created = await saveWithAudit(ZTPrecios_ITEMS, {}, data, user, 'CREATE');
  return created;
}

async function UpdateOneZTPreciosItem(IdPrecioOK, cambios, user) {
  if (!IdPrecioOK) throw new Error('Falta parámetro IdPrecioOK');
  if (!cambios || Object.keys(cambios).length === 0) throw new Error('No se enviaron datos para actualizar');

  const filter = { IdPrecioOK };
  const updated = await saveWithAudit(ZTPrecios_ITEMS, filter, cambios, user, 'UPDATE');
  return updated;
}

async function DeleteLogicZTPreciosItem(IdPrecioOK, user) {
  if (!IdPrecioOK) throw new Error('Falta parámetro IdPrecioOK');
  const filter = { IdPrecioOK };
  const data = { ACTIVED: false, DELETED: true };
  const res = await saveWithAudit(ZTPrecios_ITEMS, filter, data, user, 'UPDATE');
  return res;
}

async function DeleteHardZTPreciosItem(IdPrecioOK) {
  if (!IdPrecioOK) throw new Error('Falta parámetro IdPrecioOK');
  const eliminado = await ZTPrecios_ITEMS.findOneAndDelete({ IdPrecioOK });
  if (!eliminado) throw new Error('No se encontró el precio para eliminar');
  return { mensaje: 'Precio eliminado permanentemente', IdPrecioOK };
}

async function ActivateOneZTPreciosItem(IdPrecioOK, user) {
  if (!IdPrecioOK) throw new Error('Falta parámetro IdPrecioOK');
  const filter = { IdPrecioOK };
  const data = { ACTIVED: true, DELETED: false };
  const res = await saveWithAudit(ZTPrecios_ITEMS, filter, data, user, 'UPDATE');
  return res;
}

async function GetZTPreciosItemsByIdPresentaOK(idPresentaOK) {
  if (!idPresentaOK) throw new Error('Falta parámetro IdPresentaOK');
  return await ZTPrecios_ITEMS.find({ IdPresentaOK: idPresentaOK, DELETED: { $ne: true } }).lean();
}

async function GetAllZTPreciosItemsCosmos() {
  const container = await getPreciosItemsCosmosContainer();
  const query = "SELECT * from c WHERE c.DELETED != true";
  const { resources: items } = await container.items.query(query).fetchAll();
  return items;
}

async function GetOneZTPreciosItemCosmos(IdPrecioOK) {
  if (!IdPrecioOK) throw new Error('Falta parámetro IdPrecioOK');
  const container = await getPreciosItemsCosmosContainer();
  const { resource: item } = await container.item(IdPrecioOK, IdPrecioOK).read();
  if (!item) {
    throw new Error('No se encontró el precio');
  }
  return item;
}

async function AddOneZTPreciosItemCosmos(payload, user) {
  if (!payload) throw new Error('No se recibió payload');

  const required = ['IdPrecioOK', 'IdListaOK', 'SKUID', 'IdPresentaOK', 'Precio'];
  const missing = required.filter(k => payload[k] === undefined || payload[k] === null || payload[k] === '');
  if (missing.length) throw new Error(`Faltan campos obligatorios: ${missing.join(', ')}`);

  const container = await getPreciosItemsCosmosContainer();
  const { resource: existing } = await container.item(payload.IdPrecioOK, payload.IdPrecioOK).read().catch(() => ({}));
  if (existing) throw new Error(`Ya existe un precio con el IdPrecioOK: ${payload.IdPrecioOK}`);

  const newItem = {
    id: payload.IdPrecioOK,
    partitionKey: payload.IdPrecioOK,
    ...payload,
    ACTIVED: payload.ACTIVED ?? true,
    DELETED: payload.DELETED ?? false,
    REGUSER: user,
    REGDATE: new Date().toISOString(),
    HISTORY: [{
      user: user,
      event: "CREATE",
      date: new Date().toISOString(),
      changes: payload
    }]
  };
  const { resource: createdItem } = await container.items.create(newItem);
  return createdItem;
}

async function UpdateOneZTPreciosItemCosmos(IdPrecioOK, cambios, user) {
  if (!IdPrecioOK) throw new Error('Falta parámetro IdPrecioOK');
  if (!cambios || Object.keys(cambios).length === 0) throw new Error('No se enviaron datos para actualizar');

  const container = await getPreciosItemsCosmosContainer();
  const { resource: currentItem } = await container.item(IdPrecioOK, IdPrecioOK).read();
  if (!currentItem) throw new Error(`No se encontró el precio para actualizar con IdPrecioOK: ${IdPrecioOK}`);

  const updatedItem = {
    ...currentItem,
    ...cambios,
    id: currentItem.id,
    partitionKey: currentItem.partitionKey,
    MODUSER: user,
    MODDATE: new Date().toISOString(),
    HISTORY: [...(currentItem.HISTORY || []), { user, action: 'UPDATE', date: new Date().toISOString(), changes: cambios }]
  };
  const { resource: replacedItem } = await container.item(currentItem.id, currentItem.partitionKey).replace(updatedItem);
  return replacedItem;
}

async function DeleteLogicZTPreciosItemCosmos(IdPrecioOK, user) {
  if (!IdPrecioOK) throw new Error('Falta parámetro IdPrecioOK');
  const container = await getPreciosItemsCosmosContainer();
  const { resource: currentItem } = await container.item(IdPrecioOK, IdPrecioOK).read();
  if (!currentItem) throw new Error(`No se encontró el precio para borrado lógico con IdPrecioOK: ${IdPrecioOK}`);

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

async function DeleteHardZTPreciosItemCosmos(IdPrecioOK) {
  if (!IdPrecioOK) throw new Error('Falta parámetro IdPrecioOK');
  const container = await getPreciosItemsCosmosContainer();
  await container.item(IdPrecioOK, IdPrecioOK).delete();
  return { mensaje: 'Precio eliminado permanentemente de Cosmos DB', IdPrecioOK };
}

async function ActivateOneZTPreciosItemCosmos(IdPrecioOK, user) {
  if (!IdPrecioOK) throw new Error('Falta parámetro IdPrecioOK');
  const container = await getPreciosItemsCosmosContainer();
  const { resource: currentItem } = await container.item(IdPrecioOK, IdPrecioOK).read();
  if (!currentItem) throw new Error(`No se encontró el precio para activar con IdPrecioOK: ${IdPrecioOK}`);

  const updatedItem = { ...currentItem, ACTIVED: true, DELETED: false, MODUSER: user, MODDATE: new Date().toISOString(), HISTORY: [...(currentItem.HISTORY || []), { user, action: 'ACTIVATE', date: new Date().toISOString(), changes: { ACTIVED: true, DELETED: false } }] };
  const { resource: replacedItem } = await container.item(currentItem.id, currentItem.partitionKey).replace(updatedItem);
  return replacedItem;
}

async function GetZTPreciosItemsByIdPresentaOKCosmos(idPresentaOK) {
  if (!idPresentaOK) throw new Error('Falta parámetro IdPresentaOK');
  const container = await getPreciosItemsCosmosContainer();
  const querySpec = { query: "SELECT * FROM c WHERE c.IdPresentaOK = @idPresentaOK AND c.DELETED != true", parameters: [{ name: "@idPresentaOK", value: idPresentaOK }] };
  const { resources: items } = await container.items.query(querySpec).fetchAll();
  return items;
}

async function GetAllMethod(bitacora, req, params, paramString, body, dbServer) {
  let data = DATA();
  data.process = 'Obtener todos los precios';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || '';
  data.method       = req.req?.method || 'No Especificado';
  data.api = '/api/ztprecios-items/preciosItemsCRUD';
  data.queryString = paramString;

  bitacora.processType = data.processType;
  bitacora.loggedUser  = data.loggedUser;
  bitacora.dbServer    = dbServer;
  bitacora.server      = data.server;
  bitacora.process     = data.process;

  try {
    let docs;
    switch (dbServer) {
      case 'MongoDB': 
        docs = await GetAllZTPreciosItems(); 
        break;
      case 'CosmosDB':
        docs = await GetAllZTPreciosItemsCosmos();
        break;
      default: throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes = docs;
    data.messageUSR = 'Precios obtenidos correctamente';
    data.messageDEV = 'GetAllZTPreciosItems ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;

  } catch (error) {
    data.messageUSR = 'Error al obtener los precios';
    data.messageDEV = error.message;
    data.stack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

async function GetOneMethod(bitacora, params, IdPrecioOK, dbServer) {
  let data = DATA();
  data.process = 'Obtener un precio';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || '';
  data.api = '/api/ztprecios-items/preciosItemsCRUD';

  bitacora.processType = data.processType;
  bitacora.loggedUser  = data.loggedUser;
  bitacora.dbServer    = dbServer;
  bitacora.server      = data.server;
  bitacora.process     = data.process;

  try {
    let doc;
    switch (dbServer) {
      case 'MongoDB': 
        doc = await GetOneZTPreciosItem(IdPrecioOK); 
        break;
      case 'CosmosDB':
        doc = await GetOneZTPreciosItemCosmos(IdPrecioOK);
        break;
      default: throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes = doc;
    data.messageUSR = 'Precio obtenido correctamente';
    data.messageDEV = 'GetOneZTPreciosItem ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;

  } catch (error) {
    data.messageUSR = 'Error al obtener el precio';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', error.message.includes('No se encontró') ? 404 : 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

async function AddOneMethod(bitacora, params, body, req, dbServer) {
  let data = DATA();
  data.process = 'Agregar precio';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || '';
  data.api = '/api/ztprecios-items/preciosItemsCRUD';

  bitacora.processType = data.processType;
  bitacora.loggedUser  = data.loggedUser;
  bitacora.dbServer    = dbServer;
  bitacora.server      = data.server;
  bitacora.process     = data.process;

  try {
    let result;
    switch (dbServer) {
      case 'MongoDB': 
        result = await AddOneZTPreciosItem(getPayload(req), params.LoggedUser); 
        break;
      case 'CosmosDB':
        result = await AddOneZTPreciosItemCosmos(getPayload(req), params.LoggedUser);
        break;
      default: throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes = result;
    data.messageUSR = 'Precio creado correctamente';
    data.messageDEV = 'AddOne ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 201, true);
    bitacora.success = true;

    if (req?.http?.res) {
      req.http.res.status(201);
      const id = (result && (result.IdPrecioOK || result?.data?.IdPrecioOK)) || '';
      if (id) {
        req.http.res.set('Location', `/api/ztprecios-items/Precios('${id}')`);
      }
    }
    return bitacora;

  } catch (error) {
    data.messageUSR = 'Error al crear el precio';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

async function UpdateOneMethod(bitacora, params, IdPrecioOK, req, user, dbServer) {
  let data = DATA();
  data.process = 'Actualizar precio';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || '';
  data.api = '/api/ztprecios-items/preciosItemsCRUD';

  bitacora.processType = data.processType;
  bitacora.loggedUser  = data.loggedUser;
  bitacora.dbServer    = dbServer;
  bitacora.server      = data.server;
  bitacora.process     = data.process;

  try {
    let result;
    switch (dbServer) {
      case 'MongoDB': 
        result = await UpdateOneZTPreciosItem(IdPrecioOK, getPayload(req), user); 
        break;
      case 'CosmosDB':
        result = await UpdateOneZTPreciosItemCosmos(IdPrecioOK, getPayload(req), user);
        break;
      default: throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes = result;
    data.messageUSR = 'Precio actualizado correctamente';
    data.messageDEV = 'UpdateOne ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;

  } catch (error) {
    data.messageUSR = 'Error al actualizar el precio';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', error.message.includes('No se encontró') ? 404 : 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

async function DeleteLogicMethod(bitacora, params, IdPrecioOK, user, dbServer) {
  let data = DATA();
  data.process = 'Borrado lógico de precio';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || '';
  data.api = '/api/ztprecios-items/preciosItemsCRUD';

  bitacora.processType = data.processType;
  bitacora.loggedUser  = data.loggedUser;
  bitacora.dbServer    = dbServer;
  bitacora.server      = data.server;
  bitacora.process     = data.process;

  try {
    let result;
    switch (dbServer) {
      case 'MongoDB': 
        result = await DeleteLogicZTPreciosItem(IdPrecioOK, user); 
        break;
      case 'CosmosDB':
        result = await DeleteLogicZTPreciosItemCosmos(IdPrecioOK, user);
        break;
      default: throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes = result;
    data.messageUSR = 'Precio borrado lógicamente';
    data.messageDEV = 'DeleteLogic ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;

  } catch (error) {
    if (error.message.includes('No se encontró')) {
      data.messageUSR = 'No se encontró el precio especificado para borrar.';
      data.messageDEV = error.message;
      bitacora = AddMSG(bitacora, data, 'FAIL', 404, true);
    } else {
      data.messageUSR = 'Error al borrar lógicamente el precio';
      data.messageDEV = error.message;
      bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    }
    bitacora.success = false;
    return bitacora;
  }
}

async function DeleteHardMethod(bitacora, params, IdPrecioOK, dbServer) {
  let data = DATA();
  data.process = 'Borrado permanente de precio';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || '';
  data.api = '/api/ztprecios-items/preciosItemsCRUD';

  bitacora.processType = data.processType;
  bitacora.loggedUser  = data.loggedUser;
  bitacora.dbServer    = dbServer;
  bitacora.server      = data.server;
  bitacora.process     = data.process;

  try {
    let result;
    switch (dbServer) {
      case 'MongoDB': 
        result = await DeleteHardZTPreciosItem(IdPrecioOK); 
        break;
      case 'CosmosDB':
        result = await DeleteHardZTPreciosItemCosmos(IdPrecioOK);
        break;
      default: throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes = result;
    data.messageUSR = 'Precio borrado permanentemente';
    data.messageDEV = 'DeleteHard ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;

  } catch (error) {
    data.messageUSR = 'Error al borrar permanentemente el precio';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

async function ActivateOneMethod(bitacora, params, IdPrecioOK, user, dbServer) {
  let data = DATA();
  data.process = 'Activar precio';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || '';
  data.api = '/api/ztprecios-items/preciosItemsCRUD';

  bitacora.processType = data.processType;
  bitacora.loggedUser  = data.loggedUser;
  bitacora.dbServer    = dbServer;
  bitacora.server      = data.server;
  bitacora.process     = data.process;

  try {
    let result;
    switch (dbServer) {
      case 'MongoDB': 
        result = await ActivateOneZTPreciosItem(IdPrecioOK, user); 
        break;
      case 'CosmosDB':
        result = await ActivateOneZTPreciosItemCosmos(IdPrecioOK, user);
        break;
      default: throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes = result;
    data.messageUSR = 'Precio activado correctamente';
    data.messageDEV = 'Activate ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;

  } catch (error) {
    data.messageUSR = 'Error al activar el precio';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

async function GetByIdPresentaOKMethod(bitacora, req, params, idPresentaOK, dbServer) {
  let data = DATA();

  data.process = 'Obtener precios por IdPresentaOK';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || '';
  data.method = req.req?.method || 'No Especificado';
  data.api = '/api/ztprecios-items/preciosItemsCRUD';

  bitacora.processType = params.ProcessType || '';
  bitacora.loggedUser = params.LoggedUser || '';
  bitacora.dbServer = dbServer;
  bitacora.server = process.env.SERVER_NAME || '';
  bitacora.process = 'Obtener precios por IdPresentaOK';

  try {
    let items;
    switch (dbServer) {
      case 'MongoDB':
        items = await GetZTPreciosItemsByIdPresentaOK(idPresentaOK);
        break;
      case 'CosmosDB':
        items = await GetZTPreciosItemsByIdPresentaOKCosmos(idPresentaOK);
        break;
      default:
        throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes = items;
    data.messageUSR = 'Precios obtenidos correctamente por Presentación';
    data.messageDEV = 'GetZTPreciosItemsByIdPresentaOK ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;
  } catch (error) {
    data.messageUSR = 'Error al obtener los precios por Presentación';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

async function ZTPreciosItemsCRUD(req) {
  let bitacora = BITACORA();
  let data = DATA();

  try {
    const params = req.req?.query || {};
    const body = req.req?.body;
    const paramString = params ? new URLSearchParams(params).toString().trim() : '';
    const { ProcessType, LoggedUser, DBServer, IdPrecioOK, idPresentaOK } = params;

    if (!ProcessType) {
      data.process = 'Validación de parámetros obligatorios';
      data.messageUSR = 'Falta parámetro obligatorio: ProcessType';
      data.messageDEV = 'Valores válidos: GetAll, GetOne, GetByIdPresentaOK, AddOne, UpdateOne, DeleteLogic, DeleteHard, ActivateOne';
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
    bitacora.loggedUser  = LoggedUser;
    bitacora.dbServer    = dbServer;
    bitacora.queryString = paramString;
    bitacora.method      = req.req?.method || 'UNKNOWN';
    bitacora.api         = '/api/ztproducts-presentaciones/productsPresentacionesCRUD';
    bitacora.server      = process.env.SERVER_NAME || 'No especificado';

    switch (ProcessType) {
      case 'GetAll':
        bitacora = await GetAllMethod(bitacora, req, params, paramString, body, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      case 'GetOne':
        if (!IdPrecioOK) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: IdPrecioOK';
          data.messageDEV = 'IdPrecioOK es requerido para GetOne';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await GetOneMethod(bitacora, params, IdPrecioOK, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      case 'AddOne':
        bitacora = await AddOneMethod(bitacora, params, body, req, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      case 'UpdateOne':
        if (!IdPrecioOK) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: IdPrecioOK';
          data.messageDEV = 'IdPrecioOK es requerido para UpdateOne';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await UpdateOneMethod(bitacora, params, IdPrecioOK, req, LoggedUser, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      case 'DeleteLogic':
        if (!IdPrecioOK) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: IdPrecioOK';
          data.messageDEV = 'IdPrecioOK es requerido para DeleteLogic';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await DeleteLogicMethod(bitacora, params, IdPrecioOK, LoggedUser, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      case 'DeleteHard':
        if (!IdPrecioOK) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: IdPrecioOK';
          data.messageDEV = 'IdPrecioOK es requerido para DeleteHard';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await DeleteHardMethod(bitacora, params, IdPrecioOK, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      case 'ActivateOne':
        if (!IdPrecioOK) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: IdPrecioOK';
          data.messageDEV = 'IdPrecioOK es requerido para ActivateOne';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await ActivateOneMethod(bitacora, params, IdPrecioOK, LoggedUser, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      case 'GetByIdPresentaOK':
        if (!idPresentaOK) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: idPresentaOK';
          data.messageDEV = 'idPresentaOK es requerido para GetByIdPresentaOK';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await GetByIdPresentaOKMethod(bitacora, req, params, idPresentaOK, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;

      default:
        data.process = 'Validación de ProcessType';
        data.messageUSR = 'ProcessType inválido o no especificado';
        data.messageDEV = 'Debe ser: GetAll, GetOne, GetByIdPresentaOK, AddOne, UpdateOne, DeleteLogic, DeleteHard, ActivateOne';
        bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
        bitacora.finalRes = true;
        return FAIL(bitacora);
    }

    return OK(bitacora);

  } catch (error) {
    if (!bitacora.finalRes) {
    let data = DATA();
    data.process = 'Catch principal ZTPreciosItemsCRUD';
    data.messageUSR = 'Ocurrió un error inesperado en el endpoint';
    data.messageDEV = error.message;
    data.stack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
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

module.exports = {
  ZTPreciosItemsCRUD,

  GetAllZTPreciosItems,
  GetOneZTPreciosItem,
  AddOneZTPreciosItem,
  UpdateOneZTPreciosItem,
  DeleteLogicZTPreciosItem,
  DeleteHardZTPreciosItem,
  ActivateOneZTPreciosItem,
  GetZTPreciosItemsByIdPresentaOK,
  GetAllZTPreciosItemsCosmos,
  GetOneZTPreciosItemCosmos,
  AddOneZTPreciosItemCosmos,
  UpdateOneZTPreciosItemCosmos,
  DeleteLogicZTPreciosItemCosmos,
  DeleteHardZTPreciosItemCosmos,
  ActivateOneZTPreciosItemCosmos,
  GetZTPreciosItemsByIdPresentaOKCosmos
  };