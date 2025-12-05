const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { ZTProduct_FILES } = require('../api/models/mongodb/ztproducts_files');
const { getCosmosDatabase } = require('../config/connectToMongoDB.config');
const { saveWithAudit } = require('./audit-timestap');
const { generateBlobUploadSAS } = require('./generateSAS.helper');

async function getCosmosFilesContainer() {
  const database = getCosmosDatabase();
  if (!database) {
    throw new Error('La conexión con Cosmos DB no está disponible.');
  }
  const containerName = 'ZTPRODUCTS_FILES';
  const { container } = await database.containers.createIfNotExists({ id: containerName, partitionKey: { paths: ["/FILEID"] } });
  return container;
}

async function handleUploadZTProductFileCDS(file, body, user, dbServer = 'MongoDB') {
  if (!file) {
    return { status: 400, data: { error: 'No se recibió archivo.' } };
  }

  const { SKUID, FILETYPE, PRINCIPAL, SECUENCE, INFOAD, IdPresentaOK } = body;
  if (!SKUID || !FILETYPE || !user) {
    return { status: 400, data: { error: 'Faltan campos requeridos: SKUID, FILETYPE, y el usuario.' } };
  }

  try {
    // Crear nombre único para el archivo
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    const uniqueFilename = `${baseName}_${uniqueId}${ext}`;
    const { uploadUrl: azureUrl, publicUrl } = await generateBlobUploadSAS(uniqueFilename);

    // Obtener buffer del archivo
    let fileBuffer;
    if (file.buffer) {
      fileBuffer = file.buffer;
    } else if (file.path) {
      fileBuffer = await fs.readFile(file.path);
    } else {
      throw new Error('No se proporcionó buffer ni path para el archivo');
    }

    // Subir archivo a Azure Blob Storage
    await axios.put(azureUrl, fileBuffer, {
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': file.mimetype
      }
    });

    // Guardar documento en MongoDB
    const fileData = {
      id: uniqueId, // Usamos 'id' para Cosmos DB y 'FILEID' como alias
      SKUID,
      IdPresentaOK: IdPresentaOK || null,
      FILETYPE,
      FILE: publicUrl,
      PRINCIPAL: PRINCIPAL === 'true' || PRINCIPAL === true,
      SECUENCE: SECUENCE ? Number(SECUENCE) : 0, // eslint-disable-line
      INFOAD: INFOAD || '',
      ACTIVED: true,
      DELETED: false
    };

    let fileDoc;
    if (dbServer === 'CosmosDB') {
      const container = await getCosmosFilesContainer();

      // Verificación de existencia para evitar conflictos (409)
      const { resource: existing } = await container.item(fileData.id, fileData.id).read().catch(() => ({}));
      if (existing) throw new Error(`Error de concurrencia: Ya existe un archivo con el ID generado '${fileData.id}'. Intente de nuevo.`);

      const newItem = {
        ...fileData,
        FILEID: fileData.id, // Mantenemos FILEID por consistencia
        partitionKey: fileData.id, // Clave de partición es el propio FILEID/id
        REGUSER: user,
        REGDATE: new Date().toISOString(),
        HISTORY: [{
          event: 'CREATE',
          user: user,
          date: new Date().toISOString(),
          changes: fileData
        }]
      };
      const { resource: createdItem } = await container.items.create(newItem);
      fileDoc = createdItem;
    } else {
      // Lógica original para MongoDB
      fileData.FILEID = fileData.id;
      fileDoc = await saveWithAudit(ZTProduct_FILES, null, fileData, user, 'CREATE');
    }

    // Borrar archivo temporal si existe
    if (file.path) {
      await fs.unlink(file.path).catch(() => {});
    }

    return {
      status: 201,
      data: { url: publicUrl, file: fileDoc }
    };
  } catch (error) {
    // Borrar archivo temporal si existe
    if (file.path) {
      await fs.unlink(file.path).catch(() => {});
    }

    // Manejo de errores de Axios/Azure
    if (error.response) {
      return {
        status: error.response.status,
        data: {
          error: 'Error al subir archivo a Azure',
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        }
      };
    } else if (error.request) {
      return {
        status: 500,
        data: { error: 'No hubo respuesta de Azure' }
      };
    } else {
      return {
        status: 500,
        data: { error: 'Error inesperado al subir archivo', message: error.message }
      };
    }
  }
}



async function handleUpdateZTProductFileCDS(fileid, file, body, user, dbServer = 'MongoDB') {
  // 1. Buscar archivo existente
  let existingFile;
  if (dbServer === 'CosmosDB') {
    const container = await getCosmosFilesContainer();
    // Lectura directa (point-read) usando el ID y la clave de partición, que son el mismo valor.
    const { resource: item } = await container.item(fileid, fileid).read().catch(() => ({}));
    existingFile = item;
  } else {
    existingFile = await ZTProduct_FILES.findOne({ FILEID: fileid }).lean();
  }

  if (!existingFile) {
    throw new Error(`No se encontró archivo con FILEID: ${fileid}`);
  }

  // 2. Generar nombre único para el nuevo archivo
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(file.originalname);
  const baseName = path.basename(file.originalname, ext);
  const uniqueFilename = `${baseName}_${uniqueId}${ext}`;
  const { uploadUrl: azureUrl, publicUrl } = await generateBlobUploadSAS(uniqueFilename);

  // 3. Subir nuevo archivo
  let fileBuffer;
  if (file.buffer) fileBuffer = file.buffer;
  else if (file.path) fileBuffer = await fs.readFile(file.path);

  await axios.put(azureUrl, fileBuffer, {
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': file.mimetype
    }
  });

  // 4. Actualizar el registro en MongoDB
  const updateData = {
    FILE: publicUrl,
    FILETYPE: body.FILETYPE || existingFile.FILETYPE,
    PRINCIPAL: body.PRINCIPAL ?? existingFile.PRINCIPAL,
    SECUENCE: body.SECUENCE ?? existingFile.SECUENCE, // eslint-disable-line
    INFOAD: body.INFOAD ?? existingFile.INFOAD,
  };

  const filter = { FILEID: fileid };
  const userForAudit = user || 'SYSTEM_UPDATE'; // Asumir un usuario si no se provee
  let updatedFile;

  if (dbServer === 'CosmosDB') {
    const container = await getCosmosFilesContainer();
    const updatedItem = {
      ...existingFile,
      ...updateData,
      MODUSER: userForAudit,
      MODDATE: new Date().toISOString(),
    };
    updatedItem.HISTORY = updatedItem.HISTORY || [];
    updatedItem.HISTORY.push({
      event: 'UPDATE',
      user: userForAudit,
      date: new Date().toISOString(),
      changes: updateData
    });

    const { resource: replacedItem } = await container.item(existingFile.id, existingFile.id).replace(updatedItem);
    updatedFile = replacedItem;
  } else {
    updatedFile = await saveWithAudit(ZTProduct_FILES, filter, updateData, userForAudit, 'UPDATE');
  }

  // 5. (Opcional) Eliminar archivo viejo de Azure pero por ahora no lo hare xd
  // El plan de no borrarlo por ahora es bueno para la recuperación ante desastres.
  // 
  // const oldBlobUrl = existingFile.FILE;
  // ...

  return {
    status: 200,
    data: {
      message: 'Archivo actualizado correctamente',
      url: publicUrl,
      file: updatedFile
    }
  };
}

async function handleDeleteZTProductFileCDS(fileid, user, dbServer = 'MongoDB') {
  try {
    // 1. Buscar el archivo en la base de datos
    let existingFile;
    const container = dbServer === 'CosmosDB' ? await getCosmosFilesContainer() : null;

    if (dbServer === 'CosmosDB') {
      const { resource: item } = await container.item(fileid, fileid).read().catch(() => ({}));
      existingFile = item;
    } else {
      existingFile = await ZTProduct_FILES.findOne({ FILEID: fileid }).lean();
    }

    if (!existingFile) {
      return { status: 404, data: { error: `No se encontró archivo con FILEID: ${fileid}` } };
    }

    // 2. Eliminar el archivo de Azure Blob Storage
    const blobUrl = existingFile.FILE;
    const blobName = blobUrl.substring(blobUrl.lastIndexOf('/') + 1);
    const { uploadUrl: azureDeleteUrl } = await generateBlobUploadSAS(decodeURIComponent(blobName));
    await axios.delete(azureDeleteUrl, { headers: { 'x-ms-blob-type': 'BlockBlob' } });

    // 3. Realizar eliminación lógica (soft delete) en la base de datos
    const updateData = {
      DELETED: true,
      ACTIVED: false,
    };
    const userForAudit = user || 'SYSTEM_DELETE';
    let deletedDoc;

    if (dbServer === 'CosmosDB') {
      const updatedItem = {
        ...existingFile,
        ...updateData,
        MODUSER: userForAudit,
        MODDATE: new Date().toISOString(),
      };
      updatedItem.HISTORY = updatedItem.HISTORY || [];
      updatedItem.HISTORY.push({
        event: 'DELETE',
        user: userForAudit,
        date: new Date().toISOString(),
        changes: { DELETED: true, ACTIVED: false }
      });

      const { resource: replacedItem } = await container.item(existingFile.id, existingFile.id).replace(updatedItem);
      deletedDoc = replacedItem;
    } else {
      const filter = { FILEID: fileid };
      deletedDoc = await saveWithAudit(ZTProduct_FILES, filter, updateData, userForAudit, 'UPDATE'); // UPDATE para soft-delete
    }

    return { status: 200, data: { message: 'Archivo eliminado correctamente', file: deletedDoc } };

  } catch (error) {
    console.error('Error al eliminar el archivo:', error);
    const status = error.response ? error.response.status : 500;
    const message = error.response ? 'Error al comunicarse con Azure para eliminar el blob.' : 'Error interno del servidor al eliminar el archivo.';
    return { status, data: { error: message, details: error.message } };
  }
}

module.exports = { handleUploadZTProductFileCDS, handleUpdateZTProductFileCDS, handleDeleteZTProductFileCDS };
