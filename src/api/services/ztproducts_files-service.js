/**
 * @author: EchauriMu
 */

/** IMPORTS - EchauriMu */
//----------------------------------------------------------------
const { getCosmosDatabase } = require('../../config/connectToMongoDB.config');
const axios = require('axios');
const { ZTProduct_FILES } = require('../models/mongodb/ztproducts_files');
const { OK, FAIL, BITACORA, DATA, AddMSG } = require('../../middlewares/respPWA.handler');const { handleUploadZTProductFileCDS, handleUpdateZTProductFileCDS, handleDeleteZTProductFileCDS } = require('../../helpers/azureUpload.helper');
const { saveWithAudit } = require('../../helpers/audit-timestap');
const { StorageSharedKeyCredential, BlobSASPermissions, generateBlobSASQueryParameters } = require('@azure/storage-blob');

/** UTIL: OBTENER PAYLOAD DESDE CDS/EXPRESS - EchauriMu */
//----------------------------------------------------------------
function getPayload(req) {
  return req.data || null;
}

/** UTIL: OBTENER CONTENEDOR DE COSMOS DB - EchauriMu */
//----------------------------------------------------------------
async function getCosmosFilesContainer() {
  const database = getCosmosDatabase();
  if (!database) {
    throw new Error('La conexión con Cosmos DB no está disponible.');
  }
  const containerName = 'ZTPRODUCTS_FILES';
  const { container } = await database.containers.createIfNotExists({ id: containerName, partitionKey: { paths: ["/FILEID"] } });
  return container;
}

/**
 * Agrega URLs con SAS a una lista de archivos o a un solo archivo.
 * @param {Array|Object} files - Uno o más documentos de archivo.
 * @returns {Promise<Array|Object>} El/los documento(s) con la propiedad FILE actualizada a una URL con SAS.
 */
async function addSasUrlToFiles(files) {
  if (!files) return files;

  const accountName = process.env.AZURE_ACCOUNT_NAME;
  const accountKey = process.env.AZURE_ACCOUNT_KEY;
  const containerName = process.env.AZURE_CONTAINER_NAME;

  if (!accountName || !accountKey || !containerName) {
    // Si no hay credenciales, devuelve los archivos tal cual para no romper la funcionalidad.
    console.warn('Faltan credenciales de Azure para generar SAS URLs. Se devolverán URLs públicas.');
    return files;
  }

  const sharedKey = new StorageSharedKeyCredential(accountName, accountKey);
  const isArray = Array.isArray(files);
  const filesToProcess = isArray ? files : [files];

  const processedFiles = filesToProcess.map(file => {
    if (!file || !file.FILE) return file;

    // 1. Obtener la subcadena que representa la ruta completa del blob
    // Ejemplo: file.FILE = https://storage3bps.blob.core.windows.net/files3bps/ecommerce/.../archivo.jpg
    const containerSegment = `/${containerName}/`;
    const containerIndex = file.FILE.indexOf(containerSegment);

    if (containerIndex === -1) {
        console.warn(`No se encontró el segmento del contenedor ${containerName} en la URL del archivo.`);
        return file;
    }

    // Extrae todo lo que sigue al nombre del contenedor (ej: 'ecommerce/.../archivo.jpg')
    const blobNameWithFolder = file.FILE.substring(containerIndex + containerSegment.length).split('?')[0];
    const blobName = decodeURIComponent(blobNameWithFolder);

    const sasToken = generateBlobSASQueryParameters({
      containerName,
      blobName, // <-- ESTE ES EL NOMBRE COMPLETO CON LA RUTA DE CARPETAS
      permissions: BlobSASPermissions.parse("r"), // Permiso de solo lectura
      startsOn: new Date(new Date().valueOf() - 5 * 60 * 1000), // 5 min en el pasado por clock skew
      expiresOn: new Date(Date.now() + 30 * 60 * 1000) // 30 minutos de validez
    }, sharedKey).toString();

    // 3. Devolver la URL pública limpia más el token SAS
    return { ...file, FILE: `${file.FILE.split('?')[0]}?${sasToken}` };
  });

  return isArray ? processedFiles : processedFiles[0];
}


/** HANDLER: UPLOAD DE ARCHIVOS (POST) - EchauriMu */
//----------------------------------------------------------------
async function ZTProductFilesUploadHandler(req, loggedUser) {
  try {
    const payload = getPayload(req);
    if (!payload) {
      return { error: true, message: 'No se recibió payload. Verifica Content-Type: application/json' };
    }
    const { fileBase64, SKUID, FILETYPE, originalname, mimetype, ...rest } = payload;

    if (!fileBase64 || !SKUID || !FILETYPE || !loggedUser) {
      return { error: true, message: 'Faltan campos requeridos: fileBase64, SKUID, FILETYPE, y el usuario logueado (LoggedUser).' };
    }
    let fileBuffer;
    try {
      const cleanBase64 = fileBase64.replace(/^data:([A-Za-z-+\/]+);base64,/, '').replace(/\r?\n|\r/g, '');
      fileBuffer = Buffer.from(cleanBase64, 'base64');
    } catch (err) {
      return { error: true, message: 'Archivo base64 inválido', details: err.message };
    }

    const file = {
      buffer: fileBuffer,
      originalname: originalname || 'upload.bin',
      mimetype: mimetype || 'application/octet-stream',
    };

    const result = await handleUploadZTProductFileCDS(file, { SKUID, FILETYPE, ...rest }, loggedUser);
    return result.data || result;

  } catch (error) {
    return { error: true, message: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined };
  }
}

/** HANDLER: UPDATE DE ARCHIVOS (PUT) - EchauriMu */
//----------------------------------------------------------------
async function ZTProductFilesUpdateHandler(req, fileid, loggedUser) {
  try {
    const payload = getPayload(req);
    if (!payload) return { error: true, message: 'No se recibió payload para actualización' };

    const { fileBase64, originalname, mimetype, ...rest } = payload;
    if (!fileBase64) return { error: true, message: 'Falta fileBase64 en el payload' };

    const cleanBase64 = fileBase64.replace(/^data:([A-Za-z-+\/]+);base64,/, '').replace(/\r?\n|\r/g, '');
    const fileBuffer = Buffer.from(cleanBase64, 'base64');

    const file = {
      buffer: fileBuffer,
      originalname: originalname || 'update.bin',
      mimetype: mimetype || 'application/octet-stream',
    };

    const result = await handleUpdateZTProductFileCDS(fileid, file, rest, loggedUser);
    return result.data || result;

  } catch (error) {
    return { error: true, message: error.message };
  }
}

/** CRUD BÁSICO: GET - EchauriMu */
//----------------------------------------------------------------
async function GetAllZTProductFiles() {
  return await ZTProduct_FILES.find().lean();
}

//----------------------------------------------------------------
async function GetOneZTProductFile(fileid) {
  if (!fileid) throw new Error('Falta parámetro FILEID');
  const file = await ZTProduct_FILES.findOne({ FILEID: fileid }).lean();
  if (!file) throw new Error('No se encontró el archivo');
  return file;
}

/** CRUD: GET FILES BY SKUID - EchauriMu */
//----------------------------------------------------------------
async function GetZTProductFilesBySKUID(skuid) {
  if (!skuid) throw new Error('Falta parámetro SKUID');
  return await ZTProduct_FILES.find({ SKUID: skuid }).lean();
}



/** CRUD: GET FILES BY IdPresentaOK - EchauriMu */
//----------------------------------------------------------------
async function GetZTProductFilesByIdPresentaOK(idPresentaOK) {
  if (!idPresentaOK) throw new Error('Falta parámetro IdPresentaOK');
  return await ZTProduct_FILES.find({ IdPresentaOK: idPresentaOK }).lean();
}

/** CRUD BÁSICO (COSMOS DB SDK) - EchauriMu */
//----------------------------------------------------------------
async function GetAllZTProductFilesCosmos() {
  const container = await getCosmosFilesContainer();
  const { resources: items } = await container.items.query("SELECT * from c WHERE c.DELETED != true").fetchAll();
  return items;
}

//----------------------------------------------------------------
async function GetOneZTProductFileCosmos(fileid) {
  if (!fileid) throw new Error('Falta parámetro FILEID');
  const container = await getCosmosFilesContainer();
  const { resource: item } = await container.item(fileid, fileid).read();
  if (!item) throw new Error('No se encontró el archivo en Cosmos DB');
  return item;
}

//----------------------------------------------------------------
async function GetZTProductFilesBySKUIDCosmos(skuid) {
  if (!skuid) throw new Error('Falta parámetro SKUID');
  const container = await getCosmosFilesContainer();
  const querySpec = {
    query: "SELECT * FROM c WHERE c.SKUID = @skuid AND c.DELETED != true",
    parameters: [{ name: "@skuid", value: skuid }]
  };
  const { resources: items } = await container.items.query(querySpec).fetchAll();
  return items;
}

//----------------------------------------------------------------
async function GetZTProductFilesByIdPresentaOKCosmos(idPresentaOK) {
  if (!idPresentaOK) throw new Error('Falta parámetro IdPresentaOK');
  const container = await getCosmosFilesContainer();
  const querySpec = {
    query: "SELECT * FROM c WHERE c.IdPresentaOK = @idPresentaOK AND c.DELETED != true",
    parameters: [{ name: "@idPresentaOK", value: idPresentaOK }]
  };
  const { resources: items } = await container.items.query(querySpec).fetchAll();
  return items;
}

/** CRUD BÁSICO: DELETE / ACTIVATE - EchauriMu */
//----------------------------------------------------------------
async function DeleteZTProductFileLogic(fileid, user) {
  if (!fileid) throw new Error('Falta parámetro FILEID');
  const filter = { FILEID: fileid };
  const data = { ACTIVED: false, DELETED: true };
  const action = 'UPDATE';
  return await saveWithAudit(ZTProduct_FILES, filter, data, user, action);
}

//----------------------------------------------------------------
async function DeleteZTProductFileHard(fileid) {
  if (!fileid) throw new Error('Falta parámetro FILEID');
  const eliminado = await ZTProduct_FILES.findOneAndDelete({ FILEID: fileid });
  if (!eliminado) throw new Error('No se encontró el archivo para eliminar');
  return { mensaje: 'Archivo eliminado permanentemente', FILEID: fileid };
}

//----------------------------------------------------------------
async function ActivateZTProductFile(fileid, user) {
  if (!fileid) throw new Error('Falta parámetro FILEID');
  const filter = { FILEID: fileid };
  const data = { ACTIVED: true, DELETED: false };
  const action = 'UPDATE';
  return await saveWithAudit(ZTProduct_FILES, filter, data, user, action);
}

/** FUNCION PRINCIPAL CRUD - EchauriMu */
//----------------------------------------------------------------
async function ZTProductFilesCRUD(req) {
  let bitacora = BITACORA();
  let data = DATA();
  
  try {
    const params = req.req?.query || {};
    const body = req.req?.body;
    const paramString = params ? new URLSearchParams(params).toString().trim() : '';
    const { ProcessType, LoggedUser, DBServer, fileid, skuid } = params;
    
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
    bitacora.api = '/api/ztproducts-files/productsFilesCRUD';
    bitacora.server = process.env.SERVER_NAME || 'No especificado';

    switch (ProcessType) {
      case 'GetAll':
        bitacora = await GetAllMethod(bitacora, req, params, paramString, body, dbServer);
        if (!bitacora.success) {
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        break;
        
      case 'GetOne':
        if (!fileid) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: fileid';
          data.messageDEV = 'fileid es requerido para la operación GetOne';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await GetOneMethod(bitacora, req, params, fileid, dbServer);
        if (!bitacora.success) {
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        break;
        
      case 'AddOne':
        bitacora = await AddOneMethod(bitacora, req, params, body, dbServer);
        if (!bitacora.success) {
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        break;
        
      case 'UpdateOne':
        if (!fileid) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: fileid';
          data.messageDEV = 'fileid es requerido para la operación UpdateOne';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await UpdateOneMethod(bitacora, req, params, fileid, LoggedUser, dbServer);
        if (!bitacora.success) {
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        break;
        
      case 'DeleteLogic':
        if (!fileid) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: fileid';
          data.messageDEV = 'fileid es requerido para la operación DeleteLogic';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await DeleteLogicMethod(bitacora, req, params, fileid, LoggedUser, dbServer);
        if (!bitacora.success) {
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        break;
        
      case 'DeleteHard':
        if (!fileid) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: fileid';
          data.messageDEV = 'fileid es requerido para la operación DeleteHard';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await DeleteHardMethod(bitacora, req, params, fileid, dbServer);
        if (!bitacora.success) {
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        break;
        
      case 'ActivateOne':
        if (!fileid) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: fileid';
          data.messageDEV = 'fileid es requerido para la operación ActivateOne';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await ActivateOneMethod(bitacora, req, params, fileid, LoggedUser, dbServer);
        if (!bitacora.success) {
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        break;
        
      case 'GetBySKUID':
        if (!skuid) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: skuid';
          data.messageDEV = 'skuid es requerido para la operación GetBySKUID';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await GetBySKUIDMethod(bitacora, req, params, skuid, dbServer);
        if (!bitacora.success) {
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        break;
        
      case 'GetByIdPresentaOK':
        if (!params.idPresentaOK) {
          data.process = 'Validación de parámetros';
          data.messageUSR = 'Falta parámetro obligatorio: idPresentaOK';
          data.messageDEV = 'idPresentaOK es requerido para la operación GetByIdPresentaOK';
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          bitacora.finalRes = true;
          return FAIL(bitacora);
        }
        bitacora = await GetByIdPresentaOKMethod(bitacora, req, params, params.idPresentaOK, dbServer);
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
  }  catch (error) {
    if (!bitacora.finalRes) {
        data.process = 'Catch principal ZTProductFilesCRUD (Error Inesperado)';
        data.messageUSR = 'Ocurrió un error inesperado en el endpoint';
        data.messageDEV = error.message;
        
        bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    } 

    req.error({
        code: 'Internal-Server-Error',
        status: bitacora.status || 500, // Usar el status final de la bitácora
        message: bitacora.messageUSR,
        target: bitacora.messageDEV,
        numericSeverity: 1,
        innererror: bitacora
    });

    return FAIL(bitacora);
}

}

/** MÉTODOS LOCALES CON BITÁCORA - EchauriMu */
//----------------------------------------------------------------
async function GetAllMethod(bitacora, req, params, paramString, body, dbServer) {
  let data = DATA();
  
  data.process = 'Obtener todos los archivos';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || ''; // eslint-disable-line
  data.method = req.req?.method || 'No Especificado';
  data.api = '/api/ztproducts-files/productsFilesCRUD';
  data.queryString = paramString;
  
  bitacora.processType = params.ProcessType || '';
  bitacora.loggedUser = params.LoggedUser || '';
  bitacora.dbServer = dbServer;
  bitacora.server = process.env.SERVER_NAME || '';
  bitacora.process = 'Obtener todos los archivos';
  
  try {
    let files;
    switch (dbServer) {
      case 'MongoDB':
        files = await GetAllZTProductFiles();
        break;
      case 'CosmosDB':
        files = await GetAllZTProductFilesCosmos();
        break;
      default:
        throw new Error(`DBServer no soportado: ${dbServer}`);
    }
    
    // Generar SAS URLs para los archivos
    data.dataRes = await addSasUrlToFiles(files);
    data.messageUSR = 'Archivos obtenidos correctamente';
    data.messageDEV = 'GetAllZTProductFiles ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;
    
  } catch (error) {
    data.messageUSR = 'Error al obtener los archivos';
    data.messageDEV = error.message;
    data.stack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

//----------------------------------------------------------------
async function GetOneMethod(bitacora, req, params, fileid, dbServer) {
  let data = DATA();
  
  data.process = 'Obtener un archivo';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || ''; // eslint-disable-line
  data.method = req.req?.method || 'No Especificado';
  data.api = '/api/ztproducts-files/productsFilesCRUD';
  
  bitacora.processType = params.ProcessType || '';
  bitacora.loggedUser = params.LoggedUser || '';
  bitacora.dbServer = dbServer;
  bitacora.server = process.env.SERVER_NAME || '';
  bitacora.process = 'Obtener un archivo';
  
  try {
    let file;
    switch (dbServer) {
      case 'MongoDB':
        file = await GetOneZTProductFile(fileid);
        break;
      case 'CosmosDB':
        file = await GetOneZTProductFileCosmos(fileid);
        break;
      default:
        throw new Error(`DBServer no soportado: ${dbServer}`);
    }
    
    // Generar SAS URL para el archivo
    data.dataRes = await addSasUrlToFiles(file);
    data.messageUSR = 'Archivo obtenido correctamente';
    data.messageDEV = 'GetOneZTProductFile ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;
    
  } catch (error) {
    data.messageUSR = 'Error al obtener el archivo';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

//----------------------------------------------------------------
async function AddOneMethod(bitacora, req, params, body, dbServer) {
  let data = DATA();
  
  data.process = 'Agregar archivo';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || ''; // eslint-disable-line
  data.method = req.req?.method || 'No Especificado';
  data.api = '/api/ztproducts-files/productsFilesCRUD';
  
  bitacora.processType = params.ProcessType || '';
  bitacora.loggedUser = params.LoggedUser || '';
  bitacora.dbServer = dbServer;
  bitacora.server = process.env.SERVER_NAME || '';
  bitacora.process = 'Agregar archivo';
  
  try {
    let result;
    switch (dbServer) {
      case 'MongoDB':
        result = await ZTProductFilesUploadHandler(req, params.LoggedUser);
        break;
      case 'HANA':
        throw new Error('HANA no implementado aún para AddOne');
      default:
        throw new Error(`DBServer no soportado: ${dbServer}`);
    }
    
    data.dataRes = result;
    data.messageUSR = 'Archivo subido correctamente';
    data.messageDEV = 'Upload ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 201, true);
    bitacora.success = true;
    return bitacora;
    
  } catch (error) {
    data.messageUSR = 'Error al subir el archivo';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

//----------------------------------------------------------------
async function UpdateOneMethod(bitacora, req, params, fileid, user, dbServer) {
  let data = DATA();
  
  data.process = 'Actualizar archivo';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || ''; // eslint-disable-line
  data.method = req.req?.method || 'No Especificado';
  data.api = '/api/ztproducts-files/productsFilesCRUD';
  
  bitacora.processType = params.ProcessType || '';
  bitacora.loggedUser = params.LoggedUser || '';
  bitacora.dbServer = dbServer;
  bitacora.server = process.env.SERVER_NAME || '';
  bitacora.process = 'Actualizar archivo';
  
  try {
    let result;
    switch (dbServer) {
      case 'MongoDB':
        result = await ZTProductFilesUpdateHandler(req, fileid, user);
        break;
      case 'HANA':
        throw new Error('HANA no implementado aún para UpdateOne');
      default:
        throw new Error(`DBServer no soportado: ${dbServer}`);
    }
    
    data.dataRes = result;
    data.messageUSR = 'Archivo actualizado correctamente';
    data.messageDEV = 'Update ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;
    
  } catch (error) {
    data.messageUSR = 'Error al actualizar el archivo';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

//----------------------------------------------------------------
async function DeleteLogicMethod(bitacora, req, params, fileid, user, dbServer) {
  let data = DATA();
  
  data.process = 'Borrado lógico de archivo';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || ''; // eslint-disable-line
  data.method = req.req?.method || 'No Especificado';
  data.api = '/api/ztproducts-files/productsFilesCRUD';
  
  bitacora.processType = params.ProcessType || '';
  bitacora.loggedUser = params.LoggedUser || '';
  bitacora.dbServer = dbServer;
  bitacora.server = process.env.SERVER_NAME || '';
  bitacora.process = 'Borrado lógico de archivo';
  
  try {
    let result;
    switch (dbServer) {
      case 'MongoDB':
        result = await DeleteZTProductFileLogic(fileid, user);
        break;
      case 'HANA':
        throw new Error('HANA no implementado aún para DeleteLogic');
      default:
        throw new Error(`DBServer no soportado: ${dbServer}`);
    }
    
    data.dataRes = result;
    data.messageUSR = 'Archivo borrado lógicamente';
    data.messageDEV = 'DeleteLogic ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;
    
  } catch (error) {
    if (error.message.includes('No se encontró el archivo')) {
      data.messageUSR = 'No se encontró el archivo especificado para borrar.';
      data.messageDEV = error.message;
      bitacora = AddMSG(bitacora, data, 'FAIL', 404, true);
    } else {
      data.messageUSR = 'Error al borrar lógicamente el archivo';
      data.messageDEV = error.message;
      bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    }
    bitacora.success = false;
    return bitacora;
  }
}

//----------------------------------------------------------------
async function DeleteHardMethod(bitacora, req, params, fileid, dbServer) {
  let data = DATA();
  
  data.process = 'Borrado permanente de archivo';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || ''; // eslint-disable-line
  data.method = req.req?.method || 'No Especificado';
  data.api = '/api/ztproducts-files/productsFilesCRUD';
  
  bitacora.processType = params.ProcessType || '';
  bitacora.loggedUser = params.LoggedUser || '';
  bitacora.dbServer = dbServer;
  bitacora.server = process.env.SERVER_NAME || '';
  bitacora.process = 'Borrado permanente de archivo';
  
  try {
    let result;
    // 1. Primero, buscamos el archivo para obtener la URL del blob.
    const fileToDelete = await ZTProduct_FILES.findOne({ FILEID: fileid }).lean();
    if (!fileToDelete) {
      throw new Error(`No se encontró archivo con FILEID: ${fileid} para eliminar.`);
    }

    // 2. Usamos una parte de la lógica de handleDeleteZTProductFileCDS para borrar solo el blob.
    const AZURE_BLOB_SAS_URL = process.env.AZURE_BLOB_SAS_URL;
    if (!AZURE_BLOB_SAS_URL) {
      throw new Error('La variable de entorno AZURE_BLOB_SAS_URL no está definida.');
    }
    const blobUrl = fileToDelete.FILE;
    const blobName = blobUrl.substring(blobUrl.lastIndexOf('/') + 1);
    const azureDeleteUrl = `${AZURE_BLOB_SAS_URL.split('?')[0]}/${blobName}?${AZURE_BLOB_SAS_URL.split('?')[1]}`;

    // Intentamos borrar el blob. Si falla (excepto si es 404), lanzará un error.
    // Si es 404, significa que ya no existía, lo cual está bien, podemos proceder a borrar el registro de la BD.
    await axios.delete(azureDeleteUrl).catch(error => {
      if (error.response && error.response.status !== 404) {
        // Si el error no es 404, lanzamos el error para detener la operación.
        throw new Error(`Error al eliminar el blob de Azure: ${error.message}`);
      }
    });

    // 3. Ahora sí, eliminamos el documento de la base de datos FÍSICAMENTE.
    result = await DeleteZTProductFileHard(fileid);

    data.dataRes = result;
    data.messageUSR = 'Archivo borrado permanentemente';
    data.messageDEV = 'DeleteHard ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;
    
  } catch (error) {
    data.messageUSR = 'Error al borrar permanentemente el archivo';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

//----------------------------------------------------------------
async function ActivateOneMethod(bitacora, req, params, fileid, user, dbServer) {
  let data = DATA();
  
  data.process = 'Activar archivo';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || ''; // eslint-disable-line
  data.method = req.req?.method || 'No Especificado';
  data.api = '/api/ztproducts-files/productsFilesCRUD';
  
  bitacora.processType = params.ProcessType || '';
  bitacora.loggedUser = params.LoggedUser || '';
  bitacora.dbServer = dbServer;
  bitacora.server = process.env.SERVER_NAME || '';
  bitacora.process = 'Activar archivo';
  
  try {
    let result;
    switch (dbServer) {
      case 'MongoDB':
        result = await ActivateZTProductFile(fileid, user);
        break;
      case 'HANA':
        throw new Error('HANA no implementado aún para ActivateOne');
      default:
        throw new Error(`DBServer no soportado: ${dbServer}`);
    }
    
    data.dataRes = result;
    data.messageUSR = 'Archivo activado correctamente';
    data.messageDEV = 'Activate ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;
    
  } catch (error) {
    data.messageUSR = 'Error al activar el archivo';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

//----------------------------------------------------------------
async function GetBySKUIDMethod(bitacora, req, params, skuid, dbServer) {
  let data = DATA();

  data.process = 'Obtener archivos por SKUID';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || '';
  data.method = req.req?.method || 'No Especificado';
  data.api = '/api/ztproducts-files/productsFilesCRUD';

  bitacora.processType = params.ProcessType || '';
  bitacora.loggedUser = params.LoggedUser || '';
  bitacora.dbServer = dbServer;
  bitacora.server = process.env.SERVER_NAME || '';
  bitacora.process = 'Obtener archivos por SKUID';

  try {
    let files;
    switch (dbServer) {
      case 'MongoDB':
        files = await GetZTProductFilesBySKUID(skuid);
        break;
      case 'CosmosDB':
        files = await GetZTProductFilesBySKUIDCosmos(skuid);
        break;
      default:
        throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    // Generar SAS URLs para los archivos
    data.dataRes = await addSasUrlToFiles(files);
    data.messageUSR = 'Archivos obtenidos correctamente por SKUID';
    data.messageDEV = 'GetZTProductFilesBySKUID ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;

  } catch (error) {
    data.messageUSR = 'Error al obtener los archivos por SKUID';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

//----------------------------------------------------------------
async function GetByIdPresentaOKMethod(bitacora, req, params, idPresentaOK, dbServer) {
  let data = DATA();

  data.process = 'Obtener archivos por IdPresentaOK';
  data.processType = params.ProcessType || '';
  data.loggedUser = params.LoggedUser || '';
  data.dbServer = dbServer;
  data.server = process.env.SERVER_NAME || '';
  data.method = req.req?.method || 'No Especificado';
  data.api = '/api/ztproducts-files/productsFilesCRUD';

  bitacora.processType = params.ProcessType || '';
  bitacora.loggedUser = params.LoggedUser || '';
  bitacora.dbServer = dbServer;
  bitacora.server = process.env.SERVER_NAME || '';
  bitacora.process = 'Obtener archivos por IdPresentaOK';

  try {
    let files;
    switch (dbServer) {
      case 'MongoDB':
        files = await GetZTProductFilesByIdPresentaOK(idPresentaOK);
        break;
      case 'CosmosDB':
        files = await GetZTProductFilesByIdPresentaOKCosmos(idPresentaOK);
        break;
      default:
        throw new Error(`DBServer no soportado: ${dbServer}`);
    }

    // Generar SAS URLs para los archivos
    data.dataRes = await addSasUrlToFiles(files);
    data.messageUSR = 'Archivos obtenidos correctamente por IdPresentaOK';
    data.messageDEV = 'GetZTProductFilesByIdPresentaOK ejecutado sin errores';
    bitacora = AddMSG(bitacora, data, 'OK', 200, true);
    bitacora.success = true;
    return bitacora;

  } catch (error) {
    data.messageUSR = 'Error al obtener los archivos por IdPresentaOK';
    data.messageDEV = error.message;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    bitacora.success = false;
    return bitacora;
  }
}

/** EXPORTS - EchauriMu */
//----------------------------------------------------------------
module.exports = {
  ZTProductFilesCRUD,
  GetAllZTProductFiles,
  GetOneZTProductFile,
  DeleteZTProductFileLogic,
  DeleteZTProductFileHard,
  ActivateZTProductFile,
  ZTProductFilesUploadHandler,
  GetZTProductFilesBySKUID,
  GetZTProductFilesByIdPresentaOK
};
