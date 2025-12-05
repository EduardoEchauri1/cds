/*
 * ============================================
 * MÓDULO: SERVICIO DE PROMOCIONES
 * ============================================
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * Descripción: Servicio completo para gestión de promociones
 * con soporte para MongoDB y Cosmos DB
 * ============================================
 */

const { getCosmosDatabase } = require('../../config/connectToMongoDB.config');
const mongoose = require('mongoose');
const ZTPromociones = require('../models/mongodb/ztpromociones');
const { OK, FAIL, BITACORA, DATA, AddMSG } = require('../../middlewares/respPWA.handler');
const { saveWithAudit } = require('../../helpers/audit-timestap');

/* ============================================
 * SECCIÓN: UTILIDADES
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ============================================ */
function getPayload(req) {                                  
  const payload = req.req?.body || req.data || null;  
  return payload;
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

async function getPromocionesCosmosContainer() {
  return getCosmosContainer('ZTPROMOCIONES', '/IdPromoOK');
}

/* ============================================
 * SECCIÓN: ENDPOINT PRINCIPAL
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ============================================ */
async function crudZTPromociones(req) {
  
  let bitacora = BITACORA();
  let data = DATA();  

  try {
    const params = req.req?.query || {};
    const body = req.req?.body;
    const paramString = params ? new URLSearchParams(params).toString().trim() : '';
    const { ProcessType, LoggedUser, DBServer, IdPromoOK } = params;
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

    const dbServer = DBServer || 'MongoDB';
    bitacora.processType = ProcessType;
    bitacora.loggedUser = LoggedUser;
    bitacora.dbServer = dbServer;
    bitacora.queryString = paramString;
    bitacora.method = req.req?.method || 'UNKNOWN';
    bitacora.api = '/api/ztpromociones/crudPromociones';
    bitacora.server = process.env.SERVER_NAME || 'No especificado';

    switch (ProcessType) {
      case 'GetAll':
        bitacora = await GetPromocionMethod(bitacora, params, paramString, body, req, dbServer);
        if (!bitacora.success) {
          bitacora.finalRes = true;
          if (req?.error) {
            req.error(bitacora.status, bitacora.messageDEV);
          }
          return FAIL(bitacora);
        }
        break;
        
      case 'GetOne':
        if (!IdPromoOK) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: IdPromoOK';
          data.messageDEV = 'IdPromoOK es requerido para la operación GetOne';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          if (req?.error) {
            req.error(400, data.messageDEV);
          }
          return FAIL(bitacora);
        }
        bitacora = await GetPromocionMethod(bitacora, params, paramString, body, req, dbServer);
        if (!bitacora.success) {
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        break;
        
      case 'AddOne':
        bitacora = await AddPromocionMethod(bitacora, params, paramString, body, req, dbServer);
        if (!bitacora.success) {
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        break;

      case 'UpdateOne':
        if (!IdPromoOK) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: IdPromoOK';
          data.messageDEV = 'IdPromoOK es requerido para la operación UpdateOne';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await UpdatePromocionMethod(bitacora, params, paramString, body, req, LoggedUser, dbServer);
        if (!bitacora.success) {
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        break;

      case 'DeleteLogic':
        if (!IdPromoOK) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: IdPromoOK';
          data.messageDEV = 'IdPromoOK es requerido para la operación DeleteLogic';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await DeletePromocionMethod(bitacora, { ...params, paramString }, IdPromoOK, req, LoggedUser, dbServer);
        if (!bitacora.success) {
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        break;

      case 'DeleteHard':
        if (!IdPromoOK) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: IdPromoOK';
          data.messageDEV = 'IdPromoOK es requerido para la operación DeleteHard';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await DeletePromocionMethod(bitacora, { ...params, paramString }, IdPromoOK, req, LoggedUser, dbServer);
        if (!bitacora.success) {
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        break;

      case 'ActivateOne':
        if (!IdPromoOK) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: IdPromoOK';
          data.messageDEV = 'IdPromoOK es requerido para la operación ActivateOne';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        const activateParams = { ...params, operation: 'activate' };
        bitacora = await UpdatePromocionMethod(bitacora, activateParams, paramString, body, req, LoggedUser, dbServer);
        if (!bitacora.success) {
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        break;
        
      default:
        data.process = 'Validación de ProcessType';
        data.messageUSR = 'ProcessType inválido o no especificado';
        data.messageDEV = 'ProcessType debe ser uno de: GetAll, GetOne, AddOne, UpdateOne, DeleteLogic, DeleteHard, ActivateOne';
        bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
        bitacora.finalRes = true;
        return FAIL(bitacora);
    }

    return OK(bitacora);
    
  } catch (error) {
    if (bitacora.finalRes) {
      return FAIL(bitacora);
    }

    data.process = 'Catch principal crudZTPromociones';
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

/* ============================================
 * SECCIÓN: OPERACIONES MONGODB
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ============================================ */

/* ------------------------------------------
 * FUNCIÓN: GetAllZTPromociones
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ------------------------------------------ */
async function GetAllZTPromociones() {
  return await ZTPromociones.find({}).sort({ DELETED: 1, REGDATE: -1 }).lean();
}

/* ------------------------------------------
 * FUNCIÓN: GetOneZTPromocion
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ------------------------------------------ */
async function GetOneZTPromocion(idPromoOK) {
  if (!idPromoOK) throw new Error('IdPromoOK es requerido');
  const promo = await ZTPromociones.findOne({ IdPromoOK: idPromoOK, ACTIVED: true, DELETED: false }).lean();
  if (!promo) throw new Error(`No se encontró la promoción con IdPromoOK: ${idPromoOK}`);
  return promo;
}

/* ------------------------------------------
 * FUNCIÓN: AddOneZTPromocion
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ------------------------------------------ */
async function AddOneZTPromocion(payload, user) {
  const required = ['IdPromoOK', 'Titulo', 'FechaIni', 'FechaFin'];
  const missing = required.filter(k => !payload[k]);
  if (missing.length) throw new Error(`Faltan campos obligatorios: ${missing.join(', ')}`);
  if (!user) throw new Error('Usuario requerido para auditoría');
  
  const existe = await ZTPromociones.findOne({ IdPromoOK: payload.IdPromoOK }).lean();
  if (existe) throw new Error(`Ya existe una promoción con IdPromoOK: ${payload.IdPromoOK}`);
  
  const hasProducts = payload.ProductosAplicables && payload.ProductosAplicables.length > 0;
  
  if (!hasProducts) {
    throw new Error('Debe especificar al menos un producto aplicable');
  }
  
  const tipoDescuento = payload.TipoDescuento || 'PORCENTAJE';
  if (tipoDescuento === 'PORCENTAJE') {
    if (!payload.DescuentoPorcentaje || payload.DescuentoPorcentaje <= 0 || payload.DescuentoPorcentaje > 100) {
      throw new Error('Debe especificar un porcentaje de descuento válido entre 1 y 100');
    }
  } else if (tipoDescuento === 'MONTO_FIJO') {
    if (!payload.DescuentoMonto || payload.DescuentoMonto <= 0) {
      throw new Error('Debe especificar un monto de descuento válido mayor a 0');
    }
  }
  
  const fechaIni = new Date(payload.FechaIni);
  const fechaFin = new Date(payload.FechaFin);
  if (fechaFin <= fechaIni) {
    throw new Error('La fecha fin debe ser posterior a la fecha inicio');
  }
  
  const promoData = { 
    ...payload, 
    ACTIVED: payload.ACTIVED ?? true, 
    DELETED: payload.DELETED ?? false,
    TipoDescuento: tipoDescuento,
    PermiteAcumulacion: payload.PermiteAcumulacion ?? false,
    LimiteUsos: payload.LimiteUsos || null,
    UsosActuales: 0
  };
  
  return await saveWithAudit(ZTPromociones, {}, promoData, user, 'CREATE');
}

/* ------------------------------------------
 * FUNCIÓN: UpdateOneZTPromocion
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ------------------------------------------ */
async function UpdateOneZTPromocion(idPromoOK, payload, user) {
  if (!idPromoOK) throw new Error('IdPromoOK es requerido');
  if (!user) throw new Error('Usuario requerido para auditoría');
  
  const existingPromo = await ZTPromociones.findOne({ 
    IdPromoOK: idPromoOK, 
    DELETED: false 
  }).lean();
  
  if (!existingPromo) {
    throw new Error(`No se encontró la promoción con IdPromoOK: ${idPromoOK}`);
  }
  
  const updateData = {
    ...payload,
    MODUSER: user,
    MODDATE: new Date()
  };
  
  if (updateData.FechaIni || updateData.FechaFin) {
    const fechaIni = new Date(updateData.FechaIni || existingPromo.FechaIni);
    const fechaFin = new Date(updateData.FechaFin || existingPromo.FechaFin);
    
    if (fechaFin <= fechaIni) {
      throw new Error('La fecha fin debe ser posterior a la fecha inicio');
    }
  }
  
  if (updateData.TipoDescuento || updateData.DescuentoPorcentaje !== undefined || updateData.DescuentoMonto !== undefined) {
    const tipoDescuento = updateData.TipoDescuento || existingPromo.TipoDescuento;
    
    if (tipoDescuento === 'PORCENTAJE') {
      if (updateData.DescuentoPorcentaje !== undefined) {
        const descuento = updateData.DescuentoPorcentaje;
        if (descuento <= 0 || descuento > 100) {
          throw new Error('El porcentaje de descuento debe estar entre 1 y 100');
        }
      }
    } else if (tipoDescuento === 'MONTO_FIJO') {
      if (updateData.DescuentoMonto !== undefined) {
        const descuento = updateData.DescuentoMonto;
        if (descuento <= 0) {
          throw new Error('El monto de descuento debe ser mayor a 0');
        }
      }
    }
  }
  
  if (updateData.ProductosAplicables !== undefined) {
    const hasProducts = updateData.ProductosAplicables && updateData.ProductosAplicables.length > 0;
    
    if (!hasProducts) {
      throw new Error('Debe especificar al menos un producto aplicable');
    }
  }
  
  const filter = { IdPromoOK: idPromoOK, DELETED: false };
  const promo = await saveWithAudit(ZTPromociones, filter, updateData, user, 'UPDATE');
  
  if (!promo) {
    throw new Error(`No se pudo actualizar la promoción con IdPromoOK: ${idPromoOK}`);
  }
  
  return promo;
}

/* ------------------------------------------
 * FUNCIÓN: DeleteLogicZTPromocion
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ------------------------------------------ */
async function DeleteLogicZTPromocion(idPromoOK, user) {
  if (!idPromoOK) throw new Error('IdPromoOK es requerido');
  if (!user) throw new Error('Usuario requerido para auditoría');
  
  const ids = Array.isArray(idPromoOK) ? idPromoOK : [idPromoOK];
  const results = [];
  const errors = [];
  
  for (const id of ids) {
    try {
      const filter = { IdPromoOK: id, DELETED: false };
      const deleteData = { DELETED: true, ACTIVED: false };
      const promo = await saveWithAudit(ZTPromociones, filter, deleteData, user, 'UPDATE');
      if (!promo) {
        errors.push({ IdPromoOK: id, error: `No se encontró la promoción con IdPromoOK: ${id}` });
      } else {
        results.push(promo);
      }
    } catch (error) {
      errors.push({ IdPromoOK: id, error: error.message });
    }
  }
  
  if (!Array.isArray(idPromoOK)) {
    if (errors.length > 0) throw new Error(errors[0].error);
    return results[0];
  }
  
  return {
    success: results.length,
    failed: errors.length,
    results: results,
    errors: errors
  };
}

/* ------------------------------------------
 * FUNCIÓN: DeleteHardZTPromocion
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ------------------------------------------ */
async function DeleteHardZTPromocion(idPromoOK) {
  if (!idPromoOK) throw new Error('IdPromoOK es requerido');
  
  const ids = Array.isArray(idPromoOK) ? idPromoOK : [idPromoOK];
  const results = [];
  const errors = [];
  
  for (const id of ids) {
    try {
      const promo = await ZTPromociones.findOneAndDelete({ IdPromoOK: id }).lean();
      if (!promo) {
        errors.push({ IdPromoOK: id, error: `No se encontró la promoción con IdPromoOK: ${id}` });
      } else {
        results.push(promo);
      }
    } catch (error) {
      errors.push({ IdPromoOK: id, error: error.message });
    }
  }
  
  if (!Array.isArray(idPromoOK)) {
    if (errors.length > 0) throw new Error(errors[0].error);
    return results[0];
  }
  
  return {
    success: results.length,
    failed: errors.length,
    results: results,
    errors: errors
  };
}

/* ------------------------------------------
 * FUNCIÓN: ActivateOneZTPromocion
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ------------------------------------------ */
async function ActivateOneZTPromocion(idPromoOK, user) {
  if (!idPromoOK) throw new Error('IdPromoOK es requerido');
  
  const ids = Array.isArray(idPromoOK) ? idPromoOK : [idPromoOK];
  const results = [];
  const errors = [];
  
  for (const id of ids) {
    try {
      const promo = await ZTPromociones.findOneAndUpdate(
        { IdPromoOK: id },
        { ACTIVED: true, DELETED: false },
        { new: true, lean: true }
      );
      if (!promo) {
        errors.push({ IdPromoOK: id, error: `No se encontró la promoción con IdPromoOK: ${id}` });
      } else {
        results.push(promo);
      }
    } catch (error) {
      errors.push({ IdPromoOK: id, error: error.message });
    }
  }
  
  if (!Array.isArray(idPromoOK)) {
    if (errors.length > 0) throw new Error(errors[0].error);
    return results[0];
  }
  
  return {
    success: results.length,
    failed: errors.length,
    results: results,
    errors: errors
  };
}

/* ============================================
 * SECCIÓN: OPERACIONES COSMOS DB
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ============================================ */

/* ------------------------------------------
 * FUNCIÓN: GetAllZTPromocionesCosmos
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ------------------------------------------ */
async function GetAllZTPromocionesCosmos() {
  const container = await getPromocionesCosmosContainer();
  const query = "SELECT * from c";
  const { resources: items } = await container.items.query(query).fetchAll();

  items.sort((a, b) => {
    if (a.DELETED !== b.DELETED) {
      return a.DELETED ? 1 : -1;
    }
    return new Date(b.REGDATE) - new Date(a.REGDATE);
  });

  return items;
}

/* ------------------------------------------
 * FUNCIÓN: GetOneZTPromocionCosmos
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ------------------------------------------ */
async function GetOneZTPromocionCosmos(idPromoOK) {
  if (!idPromoOK) throw new Error('IdPromoOK es requerido');
  const container = await getPromocionesCosmosContainer();
  const { resource: item } = await container.item(idPromoOK, idPromoOK).read();
  if (!item || item.DELETED === true) throw new Error(`No se encontró la promoción con IdPromoOK: ${idPromoOK}`);
  return item;
}

/* ------------------------------------------
 * FUNCIÓN: AddOneZTPromocionCosmos
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ------------------------------------------ */
async function AddOneZTPromocionCosmos(payload, user) {
  const required = ['IdPromoOK', 'Titulo', 'FechaIni', 'FechaFin'];
  const missing = required.filter(k => !payload[k]);
  if (missing.length) throw new Error(`Faltan campos obligatorios: ${missing.join(', ')}`);
  if (!user) throw new Error('Usuario requerido para auditoría');

  const container = await getPromocionesCosmosContainer();

  const { resource: existing } = await container.item(payload.IdPromoOK, payload.IdPromoOK).read().catch(() => ({}));
  if (existing) throw new Error(`Ya existe una promoción con IdPromoOK: ${payload.IdPromoOK}`);

  if (!payload.ProductosAplicables || payload.ProductosAplicables.length === 0) {
    throw new Error('Debe especificar al menos un producto aplicable');
  }
  const tipoDescuento = payload.TipoDescuento || 'PORCENTAJE';
  if (tipoDescuento === 'PORCENTAJE' && (!payload.DescuentoPorcentaje || payload.DescuentoPorcentaje <= 0 || payload.DescuentoPorcentaje > 100)) {
    throw new Error('Debe especificar un porcentaje de descuento válido entre 1 y 100');
  }
  if (tipoDescuento === 'MONTO_FIJO' && (!payload.DescuentoMonto || payload.DescuentoMonto <= 0)) {
    throw new Error('Debe especificar un monto de descuento válido mayor a 0');
  }
  if (new Date(payload.FechaFin) <= new Date(payload.FechaIni)) {
    throw new Error('La fecha fin debe ser posterior a la fecha inicio');
  }

  const newItem = {
    id: payload.IdPromoOK,
    partitionKey: payload.IdPromoOK,
    ...payload,
    ACTIVED: payload.ACTIVED ?? true,
    DELETED: payload.DELETED ?? false,
    TipoDescuento: tipoDescuento,
    PermiteAcumulacion: payload.PermiteAcumulacion ?? false,
    LimiteUsos: payload.LimiteUsos || null,
    UsosActuales: 0,
    REGUSER: user,
    REGDATE: new Date().toISOString(),
    HISTORY: [{
      user: user,
      action: 'CREATE',
      date: new Date().toISOString(),
      changes: payload
    }]
  };

  const { resource: createdItem } = await container.items.create(newItem);

  return createdItem;
}

/* ------------------------------------------
 * FUNCIÓN: UpdateOneZTPromocionCosmos
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ------------------------------------------ */
async function UpdateOneZTPromocionCosmos(idPromoOK, payload, user) {
  if (!idPromoOK) throw new Error('IdPromoOK es requerido');
  if (!user) throw new Error('Usuario requerido para auditoría');

  const container = await getPromocionesCosmosContainer();
  const { resource: currentItem } = await container.item(idPromoOK, idPromoOK).read();
  if (!currentItem || currentItem.DELETED) throw new Error(`No se encontró la promoción con IdPromoOK: ${idPromoOK}`);

  const updatedItem = {
    ...currentItem,
    ...payload,
    id: currentItem.id,
    partitionKey: currentItem.partitionKey,
    MODUSER: user,
    MODDATE: new Date().toISOString(),
    HISTORY: [...(currentItem.HISTORY || []), { user, action: 'UPDATE', date: new Date().toISOString(), changes: payload }]
  };

  const { resource: replacedItem } = await container.item(currentItem.id, currentItem.partitionKey).replace(updatedItem);
  return replacedItem;
}

/* ------------------------------------------
 * FUNCIÓN: DeleteLogicZTPromocionCosmos
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ------------------------------------------ */
async function DeleteLogicZTPromocionCosmos(idPromoOK, user) {
  if (!idPromoOK) throw new Error('IdPromoOK es requerido');
  if (!user) throw new Error('Usuario requerido para auditoría');

  const container = await getPromocionesCosmosContainer();
  
  const ids = Array.isArray(idPromoOK) ? idPromoOK : [idPromoOK];
  const results = [];
  const errors = [];
  
  for (const id of ids) {
    try {
      const { resource: currentItem } = await container.item(id, id).read();
      if (!currentItem || currentItem.DELETED) {
        errors.push({ IdPromoOK: id, error: `No se encontró la promoción con IdPromoOK: ${id}` });
        continue;
      }

      const updatedItem = {
        ...currentItem,
        ACTIVED: false,
        DELETED: true,
        MODUSER: user,
        MODDATE: new Date().toISOString(),
        HISTORY: [...(currentItem.HISTORY || []), { user, action: 'DELETE_LOGIC', date: new Date().toISOString(), changes: { ACTIVED: false, DELETED: true } }]
      };

      const { resource: replacedItem } = await container.item(currentItem.id, currentItem.partitionKey).replace(updatedItem);
      results.push(replacedItem);
    } catch (error) {
      errors.push({ IdPromoOK: id, error: error.message });
    }
  }
  
  if (!Array.isArray(idPromoOK)) {
    if (errors.length > 0) throw new Error(errors[0].error);
    return results[0];
  }
  
  return {
    success: results.length,
    failed: errors.length,
    results: results,
    errors: errors
  };
}

/* ------------------------------------------
 * FUNCIÓN: DeleteHardZTPromocionCosmos
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ------------------------------------------ */
async function DeleteHardZTPromocionCosmos(idPromoOK) {
  if (!idPromoOK) throw new Error('IdPromoOK es requerido');
  const container = await getPromocionesCosmosContainer();
  

  const ids = Array.isArray(idPromoOK) ? idPromoOK : [idPromoOK];
  const results = [];
  const errors = [];
  
  for (const id of ids) {
    try {
      await container.item(id, id).delete();
      results.push({ mensaje: 'Promoción eliminada permanentemente de Cosmos DB', IdPromoOK: id });
    } catch (error) {
      errors.push({ IdPromoOK: id, error: error.message });
    }
  }
  
  if (!Array.isArray(idPromoOK)) {
    if (errors.length > 0) throw new Error(errors[0].error);
    return results[0];
  }
  
  return {
    success: results.length,
    failed: errors.length,
    results: results,
    errors: errors
  };
}

/* ------------------------------------------
 * FUNCIÓN: ActivateOneZTPromocionCosmos
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ------------------------------------------ */
async function ActivateOneZTPromocionCosmos(idPromoOK, user) {
  if (!idPromoOK) throw new Error('IdPromoOK es requerido');
  const container = await getPromocionesCosmosContainer();
  

  const ids = Array.isArray(idPromoOK) ? idPromoOK : [idPromoOK];
  const results = [];
  const errors = [];
  
  for (const id of ids) {
    try {
      const { resource: currentItem } = await container.item(id, id).read();
      if (!currentItem) {
        errors.push({ IdPromoOK: id, error: `No se encontró la promoción con IdPromoOK: ${id}` });
        continue;
      }

      const updatedItem = {
        ...currentItem,
        ACTIVED: true,
        DELETED: false,
        MODUSER: user,
        MODDATE: new Date().toISOString(),
        HISTORY: [...(currentItem.HISTORY || []), { user, action: 'ACTIVATE', date: new Date().toISOString(), changes: { ACTIVED: true, DELETED: false } }]
      };

      const { resource: replacedItem } = await container.item(currentItem.id, currentItem.partitionKey).replace(updatedItem);
      results.push(replacedItem);
    } catch (error) {
      errors.push({ IdPromoOK: id, error: error.message });
    }
  }
  
  if (!Array.isArray(idPromoOK)) {
    if (errors.length > 0) throw new Error(errors[0].error);
    return results[0];
  }
  
  return {
    success: results.length,
    failed: errors.length,
    results: results,
    errors: errors
  };
}

/* ============================================
 * SECCIÓN: MÉTODOS CONBITÁCORA
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ============================================ */

async function GetPromocionMethod(bitacora, params, paramString, body, req, dbServer) {
    let data = DATA();
    
    data.process = 'Obtener promoción(es)';
    data.processType = params.ProcessType || '';
    data.loggedUser = params.LoggedUser || '';
    data.dbServer = dbServer;
    data.server = process.env.SERVER_NAME || ''; 
    data.api = '/api/ztpromociones/crudPromociones';
    data.queryString = paramString;
    
    bitacora.processType = params.ProcessType || '';
    bitacora.loggedUser = params.LoggedUser || '';
    bitacora.dbServer = dbServer;
    bitacora.server = process.env.SERVER_NAME || '';
    bitacora.process = 'Obtener promoción(es)';
    
    try {
        const processType = params.ProcessType;
        
        if (processType === 'GetAll') {
            bitacora.process = "Obtener todas las PROMOCIONES";
            data.process = "Consulta de todas las promociones";
            data.method = "GET";
            data.api = "/api/ztpromociones/crudPromociones?ProcessType=GetAll";
            data.principal = true;

            let promociones;
            switch (dbServer) {
                case 'MongoDB':
                    promociones = await GetAllZTPromociones();
                    break;
                case 'CosmosDB':
                    promociones = await GetAllZTPromocionesCosmos();
                    break;
                default:
                    throw new Error(`DBServer no soportado: ${dbServer}`);
            }
            
            data.dataRes = promociones;
            data.messageUSR = `Se obtuvieron ${promociones.length} promociones correctamente`;
            data.messageDEV = 'GetAllZTPromociones ejecutado sin errores';
            bitacora = AddMSG(bitacora, data, 'OK', 200, true);
            
        } else if (processType === 'GetOne') {
            bitacora.process = "Obtener UNA PROMOCIÓN";
            data.process = "Consulta de promoción específica";
            data.method = "GET";
            data.api = "/api/ztpromociones/crudPromociones?ProcessType=GetOne";
            data.principal = true;

            const idPromoOK = params.IdPromoOK;
            
            if (!idPromoOK) {
                data.messageUSR = "ID de promoción requerido";
                data.messageDEV = "IdPromoOK es requerido para obtener una promoción";
                bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
                bitacora.success = false;
                return bitacora;
            }

            let promocion;
            switch (dbServer) {
                case 'MongoDB':
                    promocion = await GetOneZTPromocion(idPromoOK);
                    break;
                case 'CosmosDB':
                    promocion = await GetOneZTPromocionCosmos(idPromoOK);
                    break;
                default:
                    throw new Error(`DBServer no soportado: ${dbServer}`);
            }
            
            data.dataRes = promocion;
            data.messageUSR = "Promoción encontrada correctamente";
            data.messageDEV = `Promoción con IdPromoOK ${idPromoOK} encontrada`;
            bitacora = AddMSG(bitacora, data, 'OK', 200, true);
        }
        
        bitacora.success = true;
        

        if (req?.http?.res) {
            req.http.res.status(200);
        }
        
        return bitacora;
        
    } catch (error) {
        if (error.message.includes('No se encontró') || error.message.includes('no encontrado')) {
            data.messageUSR = 'Promoción no encontrada';
            data.messageDEV = error.message;
            bitacora = AddMSG(bitacora, data, 'FAIL', 404, true);
        } else {
            data.messageUSR = 'Error al obtener la(s) promoción(es)';
            data.messageDEV = error.message;
            bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
        }
        data.stack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
        bitacora.success = false;
        return bitacora;
    }
}

/* ------------------------------------------
 * FUNCIÓN: AddPromocionMethod
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ------------------------------------------ */
async function AddPromocionMethod(bitacora, params, paramString, body, req, dbServer) {
    let data = DATA();
    
    data.process = 'Agregar promoción';
    data.processType = params.ProcessType || '';
    data.loggedUser = params.LoggedUser || '';
    data.dbServer = dbServer;
    data.server = process.env.SERVER_NAME || '';
    data.api = '/api/ztpromociones/crudPromociones';
    data.method = "POST";
    data.principal = true;
    data.queryString = paramString;
    

    bitacora.processType = params.ProcessType || '';
    bitacora.loggedUser = params.LoggedUser || '';
    bitacora.dbServer = dbServer;
    bitacora.server = process.env.SERVER_NAME || ''; 
    bitacora.process = 'Agregar promoción';
    bitacora.api = '/api/ztpromociones/crudPromociones';
    bitacora.queryString = paramString;
    
    try {
        let result;
        switch (dbServer) {
            case 'MongoDB':
                result = await AddOneZTPromocion(getPayload(req), params.LoggedUser);
                break;
            case 'CosmosDB':
                result = await AddOneZTPromocionCosmos(getPayload(req), params.LoggedUser);
                break;
            default:
                throw new Error(`DBServer no soportado: ${dbServer}`);
        }
        
        data.dataRes = result;
        data.messageUSR = 'Promoción creada exitosamente';
        data.messageDEV = 'AddOneZTPromocion ejecutado sin errores';
        bitacora = AddMSG(bitacora, data, 'OK', 201, true);
        bitacora.success = true;
        
        if (req?.http?.res) {
            req.http.res.status(201);
            const id = (result && (result.IdPromoOK)) || '';
            if (id) {
                req.http.res.set('Location', `/api/ztpromociones/Promociones('${id}')`);
            }
        }
        
        return bitacora;
        
    } catch (error) {
        if (error.message.includes('Faltan campos') || error.message.includes('Ya existe')) {
            data.messageUSR = 'Error al crear la promoción - datos no válidos';
            data.messageDEV = error.message;
            bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
        } else {
            data.messageUSR = 'Error al crear la promoción';
            data.messageDEV = error.message;
            bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
        }
        bitacora.success = false;
        return bitacora;
    }
}

/* ------------------------------------------
 * FUNCIÓN: UpdatePromocionMethod
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ------------------------------------------ */
async function UpdatePromocionMethod(bitacora, params, paramString, body, req, user, dbServer) {
    let data = DATA();
    
    data.process = 'Actualizar promoción';
    data.processType = params.ProcessType || '';
    data.loggedUser = params.LoggedUser || '';
    data.dbServer = dbServer;
    data.server = process.env.SERVER_NAME || ''; 
    data.api = '/api/ztpromociones/crudPromociones';
    data.method = "PUT";
    data.principal = true;
    data.queryString = paramString;
    

    bitacora.processType = params.ProcessType || '';
    bitacora.loggedUser = params.LoggedUser || '';
    bitacora.dbServer = dbServer;
    bitacora.server = process.env.SERVER_NAME || '';
    bitacora.process = 'Actualizar promoción';
    bitacora.api = '/api/ztpromociones/crudPromociones';
    bitacora.queryString = paramString;
    
    try {
        let result;
        const idPromoOK = params.IdPromoOK;
        const isActivate = params.operation === 'activate' || params.type === 'activate';
        
        switch (dbServer) {
            case 'MongoDB':
                if (isActivate) {
                    result = await ActivateOneZTPromocion(idPromoOK, user);
                } else {
                    result = await UpdateOneZTPromocion(
                        idPromoOK,
                        getPayload(req),
                        user
                    );
                }
                break;
            case 'CosmosDB':
                if (isActivate) {
                    result = await ActivateOneZTPromocionCosmos(idPromoOK, user);
                } else {
                    result = await UpdateOneZTPromocionCosmos(idPromoOK, getPayload(req), user);
                }
                break;
            default:
                throw new Error(`DBServer no soportado: ${dbServer}`);
        }
        
        data.dataRes = result;
        data.messageUSR = isActivate ? 'Promoción activada exitosamente' : 'Promoción actualizada exitosamente';
        data.messageDEV = isActivate ? 'ActivateOneZTPromocion ejecutado sin errores' : 'UpdateOneZTPromocion ejecutado sin errores';
        bitacora = AddMSG(bitacora, data, 'OK', 200, true);
        bitacora.success = true;
        

        if (req?.http?.res) {
            req.http.res.status(200);
        }
        
        return bitacora;
        
    } catch (error) {
        if (error.message.includes('No se encontró') || error.message.includes('no encontrado')) {
            data.messageUSR = 'Error al actualizar la promoción - promoción no encontrada';
            data.messageDEV = error.message;
            bitacora = AddMSG(bitacora, data, 'FAIL', 404, true);
        } else if (error.message.includes('Faltan campos') || error.message.includes('no válido')) {
            data.messageUSR = 'Error al actualizar la promoción - datos no válidos';
            data.messageDEV = error.message;
            bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
        } else {
            data.messageUSR = 'Error al actualizar la promoción';
            data.messageDEV = error.message;
            bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
        }
        bitacora.success = false;
        return bitacora;
    }
}

/* ------------------------------------------
 * FUNCIÓN: DeletePromocionMethod
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ------------------------------------------ */
async function DeletePromocionMethod(bitacora, params, IdPromoOK, req, user, dbServer) {
    let data = DATA();
    
    data.process = 'Eliminar promoción';
    data.processType = params.ProcessType || '';
    data.loggedUser = params.LoggedUser || '';
    data.dbServer = dbServer;
    data.server = process.env.SERVER_NAME || '';
    data.api = '/api/ztpromociones/crudPromociones';
    data.method = "DELETE";
    data.principal = true;
    data.queryString = params.paramString || '';
    
    bitacora.processType = params.ProcessType || '';
    bitacora.loggedUser = params.LoggedUser || '';
    bitacora.dbServer = dbServer;
    bitacora.server = process.env.SERVER_NAME || '';
    bitacora.process = 'Eliminar promoción';
    bitacora.api = '/api/ztpromociones/crudPromociones';
    bitacora.queryString = params.paramString || '';
    
    try {
        let result;
        const isHardDelete = params.ProcessType === 'DeleteHard';
        
        switch (dbServer) {
            case 'MongoDB':
                if (isHardDelete) {
                    result = await DeleteHardZTPromocion(IdPromoOK);
                } else {
                    result = await DeleteLogicZTPromocion(IdPromoOK, user);
                }
                break;
            case 'CosmosDB':
                if (isHardDelete) {
                    result = await DeleteHardZTPromocionCosmos(IdPromoOK);
                } else {
                    result = await DeleteLogicZTPromocionCosmos(IdPromoOK, user);
                }
                break;
            default:
                throw new Error(`DBServer no soportado: ${dbServer}`);
        }
        
        data.dataRes = result;
        data.messageUSR = isHardDelete ? 'Promoción eliminada físicamente' : 'Promoción eliminada lógicamente';
        data.messageDEV = isHardDelete ? 'DeleteHardZTPromocion ejecutado sin errores' : 'DeleteLogicZTPromocion ejecutado sin errores';
        bitacora = AddMSG(bitacora, data, 'OK', 200, true);
        bitacora.success = true;
        

        if (req?.http?.res) {
            req.http.res.status(200);
        }
        
        return bitacora;
        
    } catch (error) {
        if (error.message.includes('No se encontró') || error.message.includes('no encontrado')) {
            data.messageUSR = 'Error al eliminar la promoción - promoción no encontrada';
            data.messageDEV = error.message;
            bitacora = AddMSG(bitacora, data, 'FAIL', 404, true);
        } else {
            data.messageUSR = 'Error al eliminar la promoción';
            data.messageDEV = error.message;
            bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
        }
        bitacora.success = false;
        return bitacora;
    }
}

/* ============================================
 * SECCIÓN: UTILIDADES DE CONEXIÓN
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ============================================ */

/* ------------------------------------------
 * FUNCIÓN: GetConnectionByDbServer
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ------------------------------------------ */
async function GetConnectionByDbServer(dbServer) {
  switch (dbServer) {
    case 'MongoDB':
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI);
      }
      return mongoose.connection;
      
    case 'HANA':
      throw new Error('HANA no implementado');
      
    case 'AzureCosmos':
      throw new Error('Azure Cosmos no implementado');
      
    default:
      throw new Error(`DBServer no soportado: ${dbServer}`);
  }
}

/* ============================================
 * SECCIÓN: EXPORTS
 * Autores: LAURA PANIAGUA y ALBERTO PARDO
 * ============================================ */
module.exports = {
    crudZTPromociones,
    GetAllZTPromociones,
    GetOneZTPromocion,
    AddOneZTPromocion,
    UpdateOneZTPromocion,
    DeleteLogicZTPromocion,
    DeleteHardZTPromocion,
    ActivateOneZTPromocion,
    GetAllZTPromocionesCosmos,
    GetOneZTPromocionCosmos,
    AddOneZTPromocionCosmos,
    UpdateOneZTPromocionCosmos,
    DeleteLogicZTPromocionCosmos,
    DeleteHardZTPromocionCosmos,
    ActivateOneZTPromocionCosmos
};
