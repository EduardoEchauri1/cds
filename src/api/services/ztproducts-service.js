/**
 * @author: EchauriMu
 */
const mongoose = require('mongoose');
const ZTProduct = require('../models/mongodb/ztproducts');
const { getCosmosDatabase } = require('../../config/connectToMongoDB.config');

const { OK, FAIL, BITACORA, DATA, AddMSG } = require('../../middlewares/respPWA.handler');
const { saveWithAudit } = require('../../helpers/audit-timestap');

/** UTIL: OBTENER PAYLOAD DESDE CDS/EXPRESS - EchauriMu */
//----------------------------------------------------------------
function getPayload(req) {
  let payload = req.data || req.req?.body || null;

  if (payload) {
    const cosmosReadOnlyProps = ['_rid', '_self', '_etag', '_attachments', '_ts'];
    const cleanedPayload = { ...payload };
    cosmosReadOnlyProps.forEach(prop => delete cleanedPayload[prop]);
    payload = cleanedPayload;
  }

  return payload;
}

/** UTIL: OBTENER CONTENEDOR DE COSMOS DB - EchauriMu */
//----------------------------------------------------------------
async function getCosmosContainer(containerName, partitionKeyPath) {
  const database = getCosmosDatabase();
  if (!database) {
    throw new Error('La conexión con Cosmos DB no está disponible.');
  }
  const { container } = await database.containers.createIfNotExists({ id: containerName, partitionKey: { paths: [partitionKeyPath] } });
  return container;
}

//----------------------------------------------------------------
async function getProductsCosmosContainer() {
    return getCosmosContainer('ZTPRODUCTS', '/SKUID');
  }

/** CRUD BÁSICO (MONGO PURO) - Capa 1 - EchauriMu */
//----------------------------------------------------------------
async function GetAllZTProducts() {
  
  return await ZTProduct.find({}).lean();
}

//----------------------------------------------------------------
async function GetOneZTProduct(skuid) {
  if (!skuid) throw new Error('Falta parámetro SKUID');
  const doc = await ZTProduct.findOne({ SKUID: skuid, ACTIVED: true, DELETED: false }).lean();
  if (!doc) throw new Error('No se encontró el producto');
  return doc;
}

//----------------------------------------------------------------
async function AddOneZTProduct(payload, user) {
  if (!payload) throw new Error('No se recibió payload. Verifica Content-Type: application/json');

  const required = ['SKUID', 'DESSKU', 'IDUNIDADMEDIDA'];
  const missing = required.filter((k) => payload[k] === undefined || payload[k] === null || payload[k] === '');
  if (missing.length) throw new Error(`Faltan campos obligatorios: ${missing.join(', ')}`);

  // Evitar duplicados
  const exists = await ZTProduct.findOne({ SKUID: payload.SKUID }).lean();
  if (exists) throw new Error('Ya existe un producto con ese SKUID');

  const data = {
    SKUID: payload.SKUID,
    PRODUCTNAME: payload.PRODUCTNAME,
    DESSKU: payload.DESSKU,
    MARCA: payload.MARCA || '',
    CATEGORIAS: payload.CATEGORIAS || [],
    IDUNIDADMEDIDA  : payload.IDUNIDADMEDIDA,
    BARCODE         : payload.BARCODE || '',
    INFOAD          : payload.INFOAD || '',
    ACTIVED         : payload.ACTIVED ?? true,
    DELETED         : payload.DELETED ?? false,
  };

  const created = await saveWithAudit(ZTProduct, {}, data, user, 'CREATE');
  return created;
}

//----------------------------------------------------------------
async function UpdateOneZTProduct(skuid, cambios, user) {
  if (!skuid) throw new Error('Falta parámetro SKUID');
  if (!cambios || Object.keys(cambios).length === 0) throw new Error('No se enviaron datos para actualizar');

  if (cambios.CATEGORIAS && typeof cambios.CATEGORIAS === 'string') {
    try {
      cambios.CATEGORIAS = JSON.parse(cambios.CATEGORIAS);
    } catch (e) {
      throw new Error('El campo CATEGORIAS no es un JSON de array válido.');
    }
  }

  const filter = { SKUID: skuid };
  const updateData = { ...cambios };
  const updated = await saveWithAudit(ZTProduct, filter, updateData, user, 'UPDATE');
  return updated;
}

//----------------------------------------------------------------
async function DeleteLogicZTProduct(skuid, user) {
  if (!skuid) throw new Error('Falta parámetro SKUID');
  const filter = { SKUID: skuid, ACTIVED: true, DELETED: false };
  const data   = { ACTIVED: false, DELETED: true };
  const res = await saveWithAudit(ZTProduct, filter, data, user, 'UPDATE');
  return res;
}

//----------------------------------------------------------------
async function DeleteHardZTProduct(skuid) {
  if (!skuid) throw new Error('Falta parámetro SKUID');
  const eliminado = await ZTProduct.findOneAndDelete({ SKUID: skuid });
  if (!eliminado) throw new Error('No se encontró el producto para eliminar');
  return { mensaje: 'Producto eliminado permanentemente', SKUID: skuid };
}

//----------------------------------------------------------------
async function ActivateOneZTProduct(skuid, user) {
  if (!skuid) throw new Error('Falta parámetro SKUID');
  const filter = { SKUID: skuid };
  const data   = { ACTIVED: true, DELETED: false };
  const res = await saveWithAudit(ZTProduct, filter, data, user, 'UPDATE');
  return res;
}

/** CRUD MASIVO (MONGO PURO) - Capa 1 - EchauriMu */
//----------------------------------------------------------------
async function ActivateManyZTProducts(skuids, user) {
  if (!skuids || !Array.isArray(skuids) || skuids.length === 0) throw new Error('Se requiere un array de skuids.');
  const filter = { SKUID: { $in: skuids } };
  const update = { $set: { ACTIVED: true, DELETED: false, MODUSER: user, MODDATE: new Date() } };
  return await ZTProduct.updateMany(filter, update);
}

//----------------------------------------------------------------
async function DeleteLogicManyZTProducts(skuids, user) {
  if (!skuids || !Array.isArray(skuids) || skuids.length === 0) throw new Error('Se requiere un array de skuids.');
  const filter = { SKUID: { $in: skuids } };
  const update = { $set: { ACTIVED: false, DELETED: true, MODUSER: user, MODDATE: new Date() } };
  return await ZTProduct.updateMany(filter, update);
}

//----------------------------------------------------------------
async function DeleteHardManyZTProducts(skuids) {
  if (!skuids || !Array.isArray(skuids) || skuids.length === 0) throw new Error('Se requiere un array de skuids.');
  const filter = { SKUID: { $in: skuids } };
  return await ZTProduct.deleteMany(filter);
}

/** CRUD BÁSICO (COSMOS DB SDK) - Capa 1 - EchauriMu */
//----------------------------------------------------------------
async function GetAllZTProductsCosmos() {
  const container = await getProductsCosmosContainer();
  const { resources: items } = await container.items.query("SELECT * from c").fetchAll();
  return items;
}

//----------------------------------------------------------------
async function GetOneZTProductCosmos(skuid) {
  if (!skuid) throw new Error('Falta parámetro SKUID');
  const container = await getProductsCosmosContainer();
  const { resource: item } = await container.item(skuid, skuid).read();
  if (!item) throw new Error('No se encontró el producto');
  return item;
}

//----------------------------------------------------------------
async function AddOneZTProductCosmos(payload, user) {
  if (!payload) throw new Error('No se recibió payload. Verifica Content-Type: application/json');

  const required = ['SKUID', 'DESSKU', 'IDUNIDADMEDIDA'];
  const missing = required.filter((k) => !payload[k]);
  if (missing.length) throw new Error(`Faltan campos obligatorios: ${missing.join(', ')}`);

  const container = await getProductsCosmosContainer();

  const { resource: existing } = await container.item(payload.SKUID, payload.SKUID).read().catch(() => ({}));
  if (existing) throw new Error('Ya existe un producto con ese SKUID');

  const newItem = {
    id: payload.SKUID,
    partitionKey: payload.SKUID,
    ...payload,
    ACTIVED: payload.ACTIVED ?? true,
    DELETED: payload.DELETED ?? false,
    REGUSER: user,
    REGDATE: new Date().toISOString(),
    HISTORY: [{
      event: 'CREATE',
      user: user,
      date: new Date().toISOString(),
      changes: payload
    }]
  };

  const { resource: createdItem } = await container.items.create(newItem);
  return createdItem;
}

//----------------------------------------------------------------
async function UpdateOneZTProductCosmos(req, skuid, user) {
  const cambios = getPayload(req);

  if (!skuid) throw new Error('Falta parámetro SKUID');
  if (!cambios || Object.keys(cambios).length === 0) throw new Error('No se enviaron datos para actualizar');

  const container = await getProductsCosmosContainer();

  const querySpec = {
    query: "SELECT * FROM c WHERE c.id = @skuid",
    parameters: [{ name: "@skuid", value: skuid }]
  };
  const { resources: items } = await container.items.query(querySpec).fetchAll();

  if (!items || items.length === 0) {
    throw new Error(`No se encontró el producto para actualizar con SKUID: ${skuid}`);
  }
  const currentItem = items[0];

  const currentPartitionKey = currentItem.SKUID;

  if (cambios.CATEGORIAS && typeof cambios.CATEGORIAS === 'string') {
    try {
      cambios.CATEGORIAS = JSON.parse(cambios.CATEGORIAS);
    } catch (e) {
      throw new Error('El campo CATEGORIAS no es un JSON de array válido.');
    }
  }

  const updatedItem = {
    ...currentItem,
    ...cambios,
    id: currentItem.id,
    SKUID: currentItem.SKUID,
    partitionKey: currentItem.SKUID,
  };

  updatedItem.MODUSER = user;
  updatedItem.MODDATE = new Date().toISOString();

  updatedItem.HISTORY = updatedItem.HISTORY || [];
  updatedItem.HISTORY.push({
    event: 'UPDATE',
    user: user,
    date: new Date().toISOString(),
    changes: cambios
  });

  const { resource: replacedItem } = await container
    .item(currentItem.id, currentPartitionKey)
    .replace(updatedItem);

  return replacedItem;
}

//----------------------------------------------------------------
async function DeleteLogicZTProductCosmos(skuid, user) {
  if (!skuid) throw new Error('Falta parámetro SKUID');

  const container = await getProductsCosmosContainer();

  const querySpec = {
    query: "SELECT * FROM c WHERE c.id = @skuid AND c.DELETED = false",
    parameters: [{ name: "@skuid", value: skuid }]
  };
  const { resources: items } = await container.items.query(querySpec).fetchAll();

  if (!items || items.length === 0) {
    throw new Error(`No se encontró el producto activo para borrado lógico con SKUID: ${skuid}`);
  }
  const currentItem = items[0];
  const currentPartitionKey = currentItem.SKUID;

  const updatedItem = {
    ...currentItem,
    ACTIVED: false,
    DELETED: true,
    MODUSER: user,
    MODDATE: new Date().toISOString(),
  };

  updatedItem.HISTORY = updatedItem.HISTORY || [];
  updatedItem.HISTORY.push({
    event: 'DELETE_LOGIC',
    user: user,
    date: new Date().toISOString(),
    changes: { ACTIVED: false, DELETED: true }
  });

  const { resource: replacedItem } = await container
    .item(currentItem.id, currentPartitionKey)
    .replace(updatedItem);

  return replacedItem;
}

//----------------------------------------------------------------
async function DeleteHardZTProductCosmos(skuid) {
  if (!skuid) throw new Error('Falta parámetro SKUID');
  const container = await getProductsCosmosContainer();
  const { resource: deletedItem } = await container.item(skuid, skuid).delete();
  if (!deletedItem) throw new Error('No se encontró el producto para eliminar permanentemente');
  return { mensaje: 'Producto eliminado permanentemente de Cosmos DB', SKUID: skuid };
}

//----------------------------------------------------------------
async function ActivateOneZTProductCosmos(skuid, user) {
  if (!skuid) throw new Error('Falta parámetro SKUID');
  const container = await getProductsCosmosContainer();

  const { resource: currentItem } = await container.item(skuid, skuid).read();
  if (!currentItem) throw new Error(`No se encontró el producto para activar con SKUID: ${skuid}`);

  const updatedItem = {
    ...currentItem,
    ACTIVED: true,
    DELETED: false,
    MODUSER: user,
    MODDATE: new Date().toISOString(),
    HISTORY: [...(currentItem.HISTORY || []), { event: 'ACTIVATE', user, date: new Date().toISOString(), changes: { ACTIVED: true, DELETED: false } }]
  };

  const { resource: replacedItem } = await container
    .item(currentItem.id, currentItem.SKUID)
    .replace(updatedItem);
  return replacedItem;
}

/** CRUD MASIVO (COSMOS DB SDK) - Capa 1 - EchauriMu */
//----------------------------------------------------------------
async function ActivateManyZTProductsCosmos(skuids, user) {
  if (!skuids || !Array.isArray(skuids) || skuids.length === 0) throw new Error('Se requiere un array de skuids.');
  const container = await getProductsCosmosContainer();
  const operations = skuids.map(skuid => ({
    id: skuid,
    partitionKey: skuid,
    operationType: 'Patch',
    patchOperations: [
      { op: 'set', path: '/ACTIVED', value: true },
      { op: 'set', path: '/DELETED', value: false },
      { op: 'set', path: '/MODUSER', value: user },
      { op: 'set', path: '/MODDATE', value: new Date().toISOString() }
    ]
  }));
  const results = await Promise.all(operations.map(op => container.item(op.id, op.partitionKey).patch(op.patchOperations)));
  return { modifiedCount: results.length };
}

//----------------------------------------------------------------
async function DeleteLogicManyZTProductsCosmos(skuids, user) {
  if (!skuids || !Array.isArray(skuids) || skuids.length === 0) throw new Error('Se requiere un array de skuids.');
  const container = await getProductsCosmosContainer();
  const operations = skuids.map(skuid => ({
    id: skuid,
    partitionKey: skuid,
    operationType: 'Patch',
    patchOperations: [
      { op: 'set', path: '/ACTIVED', value: false },
      { op: 'set', path: '/DELETED', value: true },
      { op: 'set', path: '/MODUSER', value: user },
      { op: 'set', path: '/MODDATE', value: new Date().toISOString() }
    ]
  }));
  const results = await Promise.all(operations.map(op => container.item(op.id, op.partitionKey).patch(op.patchOperations)));
  return { modifiedCount: results.length };
}

//----------------------------------------------------------------
async function DeleteHardManyZTProductsCosmos(skuids) {
  if (!skuids || !Array.isArray(skuids) || skuids.length === 0) throw new Error('Se requiere un array de skuids.');
  const container = await getProductsCosmosContainer();
  const deletePromises = skuids.map(skuid => container.item(skuid, skuid).delete());
  const results = await Promise.all(deletePromises);
  return { deletedCount: results.length };
}

/** CRUD Products Service with Bitacora - EchauriMu */
//----------------------------------------------------------------
async function crudZTProducts(req) {
  
  let bitacora = BITACORA();
  let data = DATA();
  
  try {
    const params = { ...(req.req?.query || {}), ...(req.data || {}), ...(req.req?.body || {}) };
    const body = getPayload(req);
    const paramString = new URLSearchParams(params).toString().trim();

    const { ProcessType, LoggedUser, DBServer, skuid, skuidList } = params;
    const dbServer = DBServer || 'MongoDB';

    if (!ProcessType) {
      data.process = 'Validación de parámetros obligatorios';
      data.messageUSR = 'Falta parámetro obligatorio: ProcessType';
      data.messageDEV = 'ProcessType es requerido para ejecutar la API. Valores válidos: GetAll, GetOne, AddOne, UpdateOne, DeleteLogic, DeleteHard, ActivateOne';
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
    
    bitacora.processType = ProcessType;
    bitacora.loggedUser = LoggedUser;
    bitacora.dbServer = dbServer;
    bitacora.queryString = paramString;
    bitacora.method = req.req?.method || 'UNKNOWN';
    bitacora.api = '/api/ztproducts/crudProducts';
    bitacora.server = process.env.SERVER_NAME || 'No especificado';

    switch (ProcessType) {
      case 'GetAll':
        bitacora = await GetProductMethod(bitacora, params, paramString, body, dbServer);
        if (!bitacora.success) {
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        break;
        
      case 'GetOne':
        if (!skuid) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: skuid';
          data.messageDEV = 'skuid es requerido para la operación GetOne';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await GetProductMethod(bitacora, params, paramString, body, dbServer);
        if (!bitacora.success) {
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        break;
        
      case 'AddOne':
        bitacora = await AddProductMethod(bitacora, params, paramString, body, req, dbServer);
        if (!bitacora.success) {
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        break;
      case 'UpdateOne':
        if (!skuid) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: skuid';
          data.messageDEV = 'skuid es requerido para la operación UpdateOne';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await UpdateProductMethod(bitacora, params, paramString, body, req, LoggedUser, dbServer);
        if (!bitacora.success) {
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        break;

      case 'DeleteLogic':
        if (!skuid) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: skuid';
          data.messageDEV = 'skuid es requerido para la operación DeleteLogic';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await DeleteProductMethod(
          bitacora,
          { ...params, paramString, ProcessType: 'DeleteLogic' },
          skuid,
          LoggedUser,
          dbServer
        );
        if (!bitacora.success) {
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }

        break;

      case 'DeleteHard':
        if (!skuid) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: skuid';
          data.messageDEV = 'skuid es requerido para la operación DeleteHard';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await DeleteProductMethod(
          bitacora,
          { ...params, paramString, ProcessType: 'DeleteHard' },
          skuid,
          LoggedUser,
          dbServer
        );
        if (!bitacora.success) {
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        break;

      case 'ActivateOne':
        if (!skuid) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: skuid';
          data.messageDEV = 'skuid es requerido para la operación ActivateOne';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }

        bitacora = await UpdateProductMethod(
          bitacora,
          { ...params, operation: 'activate' },
          paramString,
          body,
          req,
          LoggedUser,
          dbServer
        );

        if (!bitacora.success) {
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }

        break;
        
      case 'ActivateMany': {
        if (!skuidList || !Array.isArray(skuidList) || skuidList.length === 0) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta el array de SKUs para la operación masiva.';
          data.messageDEV = 'Se requiere un array "skuidList" en el body para ActivateMany.';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await ActivateManyMethod(bitacora, params, LoggedUser, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;
      }

      case 'DeactivateMany': {
        if (!skuidList || !Array.isArray(skuidList) || skuidList.length === 0) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta el array de SKUs para la operación masiva.';
          data.messageDEV = 'Se requiere un array "skuidList" en el body para DeactivateMany.';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await DeactivateManyMethod(bitacora, params, LoggedUser, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;
      }

      case 'DeleteHardMany': {
        if (!skuidList || !Array.isArray(skuidList) || skuidList.length === 0) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta el array de SKUs para la operación masiva.';
          data.messageDEV = 'Se requiere un array "skuidList" en el body para DeleteHardMany.';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await DeleteHardManyMethod(bitacora, params, dbServer);
        if (!bitacora.success) { bitacora.finalRes = true; return FAIL(bitacora); }
        break;
      }

      default:
        data.process = 'Validación de ProcessType';
        data.messageUSR = 'ProcessType inválido o no especificado';
        data.messageDEV = `ProcessType debe ser uno de: GetAll, GetOne, AddOne, UpdateOne, DeleteLogic, DeleteHard, ActivateOne, ActivateMany, DeactivateMany, DeleteHardMany`;
        bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
        bitacora.finalRes = true;
        return FAIL(bitacora);
    }

    
    return OK(bitacora);
    
  } catch (error) {
    if (bitacora.finalRes) {
      return FAIL(bitacora);
    }
    
    data.process = 'Catch principal crudZTProducts';
    data.messageUSR = 'Ocurrió un error inesperado en el endpoint';
    data.messageDEV = error.message;
    data.stack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.finalRes = true;
    
    if (req?.error) {
      req.error({
        code: 'Internal-Server-Error',
        status: bitacora.status || 500,
        message: bitacora.messageUSR || data.messageUSR,
        target: bitacora.messageDEV || data.messageDEV,
        numericSeverity: 1,
        innererror: bitacora
      });
    }
    
    return FAIL(bitacora);
  }
}

/** Methods for each operation with Bitacora - Capa 2 - EchauriMu */
//----------------------------------------------------------------

async function GetProductMethod(bitacora, params, paramString, body, dbServer) {
    let data = DATA();
    
    data.process = 'Obtener producto(s)';
    data.processType = params.ProcessType || '';
    data.loggedUser = params.LoggedUser || '';
    data.dbServer = dbServer;
    data.server = process.env.SERVER_NAME || '';
    data.api = '/api/ztproducts/crudProducts';
    data.queryString = paramString;
    
    bitacora.processType = params.ProcessType || '';
    bitacora.loggedUser = params.LoggedUser || '';
    bitacora.dbServer = dbServer;
    bitacora.server = process.env.SERVER_NAME || '';
    bitacora.process = 'Obtener producto(s)';
    
    try {
        const processType = params.ProcessType;
        
        if (processType === 'GetAll') {
            bitacora.process = "Obtener todos los PRODUCTOS";
            data.process = "Consulta de todos los productos";
            data.method = "GET";
            data.api = "/api/ztproducts/crudProducts?ProcessType=GetAll";
            data.principal = true;

            let productos;
            switch (dbServer) {
                case 'MongoDB':
                    productos = await GetAllZTProducts();
                    break;
                case 'CosmosDB':                    
                    productos = await GetAllZTProductsCosmos();
                    break;
                default:
                    throw new Error(`DBServer no soportado: ${dbServer}`);
            }
            
            data.dataRes = productos;
            data.messageUSR = `Se obtuvieron ${productos.length} productos correctamente`;
            data.messageDEV = 'GetAllZTProducts ejecutado sin errores';
            bitacora = AddMSG(bitacora, data, 'OK', 200, true);
            
        } else if (processType === 'GetOne') {
            bitacora.process = "Obtener UN PRODUCTO";
            data.process = "Consulta de producto específico";
            data.method = "GET";
            data.api = "/api/ztproducts/crudProducts?ProcessType=GetOne";
            data.principal = true;

            const skuid = params.skuid || params.SKUID;
            
            if (!skuid) {
                data.messageUSR = "ID de producto requerido";
                data.messageDEV = "SKUID es requerido para obtener un producto";
                bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
                bitacora.success = false;
                return bitacora;
            }

            let producto;
            switch (dbServer) {
                case 'MongoDB':
                    producto = await GetOneZTProduct(skuid);
                    break;
                case 'CosmosDB':
                    producto = await GetOneZTProductCosmos(skuid);
                    break;
                default:
                    throw new Error(`DBServer no soportado: ${dbServer}`);
            }
            
            data.dataRes = producto;
            data.messageUSR = "Producto encontrado correctamente";
            data.messageDEV = `Producto con SKUID ${skuid} encontrado`;
            bitacora = AddMSG(bitacora, data, 'OK', 200, true);
        }
        
        bitacora.success = true;
        return bitacora;
        
    } catch (error) {
        if (error.message.includes('No se encontró') || error.message.includes('no encontrado')) {
            data.messageUSR = 'Producto no encontrado';
            data.messageDEV = error.message;
            bitacora = AddMSG(bitacora, data, 'FAIL', 404, true);
        } else {
            data.messageUSR = 'Error al obtener el/los producto(s)';
            data.messageDEV = error.message;
            bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
        }
        data.stack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
        bitacora.success = false;
        return bitacora;
    }
}

//----------------------------------------------------------------
async function AddProductMethod(bitacora, params, paramString, body, req, dbServer) {
    let data = DATA();
    
    data.process = 'Agregar producto';
    data.processType = params.ProcessType || '';
    data.loggedUser = params.LoggedUser || '';
    data.dbServer = dbServer;
    data.server = process.env.SERVER_NAME || '';
    data.api = '/api/ztproducts/crudProducts';
    data.method = "POST";
    data.principal = true;
    data.queryString = paramString;
    
    bitacora.processType = params.ProcessType || '';
    bitacora.loggedUser = params.LoggedUser || '';
    bitacora.dbServer = dbServer;
    bitacora.server = process.env.SERVER_NAME || '';
    bitacora.process = 'Agregar producto';
    bitacora.api = '/api/ztproducts/crudProducts';
    bitacora.queryString = paramString;
    
    try {
        let result;
        switch (dbServer) {
            case 'MongoDB':
                result = await AddOneZTProduct(getPayload(req), params.LoggedUser);
                break;
            case 'CosmosDB':
                result = await AddOneZTProductCosmos(getPayload(req), params.LoggedUser);
                break;
            default:
                throw new Error(`DBServer no soportado: ${dbServer}`);
        }
        
        data.dataRes = result;
        data.messageUSR = 'Producto creado exitosamente';
        data.messageDEV = 'AddOneZTProduct ejecutado sin errores';
        bitacora = AddMSG(bitacora, data, 'OK', 201, true);
        bitacora.success = true;
        
        if (req?.http?.res) {
            req.http.res.status(201);
            const id = (result && (result.SKUID)) || '';
            if (id) {
                req.http.res.set('Location', `/api/ztproducts/Products('${id}')`);
            }
        }
        
        return bitacora;
        
    } catch (error) {
        if (error.message.includes('Faltan campos') || error.message.includes('Ya existe')) {
            data.messageUSR = 'Error al crear el producto - datos no válidos';
            data.messageDEV = error.message;
            bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
        } else {
            data.messageUSR = 'Error al crear el producto';
            data.messageDEV = error.message;
            bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
        }
        bitacora.success = false;
        return bitacora;
    }
}

//----------------------------------------------------------------
async function UpdateProductMethod(bitacora, params, paramString, body, req, user, dbServer) {
    let data = DATA();
    
    data.process = 'Actualizar producto';
    data.processType = params.ProcessType || '';
    data.loggedUser = params.LoggedUser || '';
    data.dbServer = dbServer;
    data.server = process.env.SERVER_NAME || '';
    data.api = '/api/ztproducts/crudProducts';
    data.method = "PUT";
    data.principal = true;
    data.queryString = paramString;
    
    bitacora.processType = params.ProcessType || '';
    bitacora.loggedUser = params.LoggedUser || '';
    bitacora.dbServer = dbServer;
    bitacora.server = process.env.SERVER_NAME || '';
    bitacora.process = 'Actualizar producto';
    bitacora.api = '/api/ztproducts/crudProducts';
    bitacora.queryString = paramString;
    
    try {
        let result;
        const skuid = params.skuid || params.SKUID;
        const isActivate = params.operation === 'activate' || params.type === 'activate';
        
        switch (dbServer) {
            case 'MongoDB':
                if (isActivate) {
                    result = await ActivateOneZTProduct(skuid, user);
                } else {
                    result = await UpdateOneZTProduct(skuid, getPayload(req), user);
                }
                break;
            case 'CosmosDB':
                if (isActivate) {
                    result = await ActivateOneZTProductCosmos(skuid, user);
                } else {
                    result = await UpdateOneZTProductCosmos(req, skuid, user);
                }
                break;
            default:
                throw new Error(`DBServer no soportado: ${dbServer}`);
        }

        data.dataRes = result;
        data.messageUSR = isActivate ? 'Producto activado exitosamente' : 'Producto actualizado exitosamente';
        data.messageDEV = isActivate ? 'ActivateOneZTProduct ejecutado sin errores' : 'UpdateOneZTProduct ejecutado sin errores';
        bitacora = AddMSG(bitacora, data, 'OK', 200, true);
        bitacora.success = true;
        
        return bitacora;
        
    } catch (error) {
        if (error.message.includes('No se encontró') || error.message.includes('no encontrado')) {
            data.messageUSR = 'Error al actualizar el producto - producto no encontrado';
            data.messageDEV = error.message;
            bitacora = AddMSG(bitacora, data, 'FAIL', 404, true);
        } else if (error.message.includes('Faltan campos') || error.message.includes('no válido')) {
            data.messageUSR = 'Error al actualizar el producto - datos no válidos';
            data.messageDEV = error.message;
            bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
        } else {
            data.messageUSR = 'Error al actualizar el producto';
            data.messageDEV = error.message;
            bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
        }
        bitacora.success = false;
        return bitacora;
    }
}

//----------------------------------------------------------------
async function DeleteProductMethod(bitacora, params, skuid, user, dbServer) {
    let data = DATA();
    
    data.process = 'Eliminar producto';
    data.processType = params.ProcessType || '';
    data.loggedUser = params.LoggedUser || '';
    data.dbServer = dbServer;
    data.server = process.env.SERVER_NAME || '';
    data.api = '/api/ztproducts/crudProducts';
    data.method = "DELETE";
    data.principal = true;
    data.queryString = params.paramString || '';
    
    bitacora.processType = params.ProcessType || '';
    bitacora.loggedUser = params.LoggedUser || '';
    bitacora.dbServer = dbServer;
    bitacora.server = process.env.SERVER_NAME || '';
    bitacora.process = 'Eliminar producto';
    bitacora.api = '/api/ztproducts/crudProducts';
    bitacora.queryString = params.paramString || '';
    
    try {
        let result;
        const processType = params.ProcessType;

        switch (dbServer) {
            case 'MongoDB':
                if (processType === 'DeleteHard') {
                    result = await DeleteHardZTProduct(skuid);
                } else {
                    result = await DeleteLogicZTProduct(skuid, user);
                }
                break;
            case 'CosmosDB':
                if (processType === 'DeleteHard') {
                    result = await DeleteHardZTProductCosmos(skuid);
                } else {
                    result = await DeleteLogicZTProductCosmos(skuid, user);
                }
                break;
            default:
                throw new Error(`DBServer no soportado: ${dbServer}`);
        }
        
        data.dataRes = result;
        data.messageUSR = processType === 'DeleteHard' ? 'Producto eliminado físicamente' : 'Producto eliminado lógicamente';
        data.messageDEV = `${processType} ejecutado sin errores para ${dbServer}`;
        bitacora = AddMSG(bitacora, data, 'OK', 200, true);
        bitacora.success = true;
        
        return bitacora;
        
    } catch (error) {
        if (error.message.includes('No se encontró') || error.message.includes('no encontrado')) {
            data.messageUSR = 'Error al eliminar el producto - producto no encontrado';
            data.messageDEV = error.message;
            bitacora = AddMSG(bitacora, data, 'FAIL', 404, true);
        } else {
            data.messageUSR = 'Error al eliminar el producto';
            data.messageDEV = error.message;
            bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
        }
        bitacora.success = false;
        return bitacora;
    }
}

//----------------------------------------------------------------
async function ActivateManyMethod(bitacora, params, user, dbServer) {
  let data = DATA();
  data.process = 'Activación masiva de productos';
  data.processType = params.ProcessType;
  data.loggedUser = user;
  data.dbServer = dbServer;
  data.api = '/api/ztproducts/crudProducts';

  bitacora.processType = data.processType;
  bitacora.loggedUser = data.loggedUser;
  bitacora.dbServer = dbServer;
  bitacora.process = data.process;

  try {
    const skuids = params.skuidList;
    let result;
    switch (dbServer) {
      case 'MongoDB':
        result = await ActivateManyZTProducts(skuids, user);
        break;
      case 'CosmosDB':
        result = await ActivateManyZTProductsCosmos(skuids, user);
        break;
      default:
        throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes = result;
    data.messageUSR = `Operación completada. Productos afectados: ${result.modifiedCount || result.nModified || 0}`;
    data.messageDEV = 'ActivateMany ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;

  } catch (error) {
    data.messageUSR = 'Error en la activación masiva de productos';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

//----------------------------------------------------------------
async function DeactivateManyMethod(bitacora, params, user, dbServer) {
  let data = DATA();
  data.process = 'Desactivación (borrado lógico) masiva de productos';
  data.processType = params.ProcessType;
  data.loggedUser = user;
  data.dbServer = dbServer;
  data.api = '/api/ztproducts/crudProducts';

  bitacora.processType = data.processType;
  bitacora.loggedUser = data.loggedUser;
  bitacora.dbServer = dbServer;
  bitacora.process = data.process;

  try {
    const skuids = params.skuidList;
    let result;
    switch (dbServer) {
      case 'MongoDB':
        result = await DeleteLogicManyZTProducts(skuids, user);
        break;
      case 'CosmosDB':
        result = await DeleteLogicManyZTProductsCosmos(skuids, user);
        break;
      default:
        throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes = result;
    data.messageUSR = `Operación completada. Productos desactivados: ${result.modifiedCount || result.nModified || 0}`;
    data.messageDEV = 'DeactivateMany (DeleteLogicMany) ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;

  } catch (error) {
    data.messageUSR = 'Error en la desactivación masiva de productos';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

//----------------------------------------------------------------
async function DeleteHardManyMethod(bitacora, params, dbServer) {
  let data = DATA();
  data.process = 'Borrado físico masivo de productos';
  data.processType = params.ProcessType;
  data.loggedUser = params.LoggedUser;
  data.dbServer = dbServer;
  data.api = '/api/ztproducts/crudProducts';

  bitacora.processType = data.processType;
  bitacora.loggedUser = data.loggedUser;
  bitacora.dbServer = dbServer;
  bitacora.process = data.process;

  try {
    const skuids = params.skuidList;
    let result;
    switch (dbServer) {
      case 'MongoDB':
        result = await DeleteHardManyZTProducts(skuids);
        break;
      case 'CosmosDB':
        result = await DeleteHardManyZTProductsCosmos(skuids);
        break;
      default:
        throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    data.dataRes = result;
    data.messageUSR = `Operación completada. Productos eliminados permanentemente: ${result.deletedCount || 0}`;
    data.messageDEV = 'DeleteHardMany ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;

  } catch (error) {
    data.messageUSR = 'Error en el borrado físico masivo de productos';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}


module.exports = {
    crudZTProducts,
    GetAllZTProducts,
    GetOneZTProduct,
    AddOneZTProduct,
    UpdateOneZTProduct,
    DeleteLogicZTProduct,
    DeleteHardZTProduct,
    ActivateOneZTProduct,
    // Cosmos DB Functions
    DeleteLogicZTProductCosmos,
    DeleteHardZTProductCosmos,
    ActivateOneZTProductCosmos,
    ActivateManyZTProducts,
    DeleteLogicManyZTProducts,
    DeleteHardManyZTProducts,
    ActivateManyZTProductsCosmos,
    DeleteLogicManyZTProductsCosmos,
    DeleteHardManyZTProductsCosmos
};
