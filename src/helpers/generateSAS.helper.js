const {
  StorageSharedKeyCredential,
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
} = require('@azure/storage-blob');

let containerClient; // Usamos una variable para cachear el cliente del contenedor

/**
 * Inicializa el cliente del contenedor y se asegura de que el contenedor exista.
 * Lo crea si es necesario.
 */
async function initializeContainerClient() {
  if (containerClient) {
    return;
  }
  const accountName = process.env.AZURE_ACCOUNT_NAME;
  const accountKey = process.env.AZURE_ACCOUNT_KEY;
  const containerName = process.env.AZURE_CONTAINER_NAME;

  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  const blobServiceClient = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, sharedKeyCredential);
  containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists();
}
/**
 * Genera una URL con firma de acceso compartido (SAS) para subir un blob a Azure Storage.
 * @param {string} blobName - El nombre que tendrá el archivo en Azure Blob Storage.
 * @returns {{uploadUrl: string, publicUrl: string}} Un objeto con la URL para subir el archivo y la URL pública del mismo.
 */
async function generateBlobUploadSAS(rawBlobName) {
  // Definir la sub-ruta dentro del contenedor
  const AZURE_BLOB_SUB_PATH = 'ecommerce/inventory/products/images/';
  // Crear el nombre COMPLETO del blob (incluyendo la sub-ruta)
  const blobNameWithFolder = AZURE_BLOB_SUB_PATH + rawBlobName;

  // 1. Obtener variables de entorno
  const accountName = process.env.AZURE_ACCOUNT_NAME;
  const accountKey = process.env.AZURE_ACCOUNT_KEY;
  const containerName = process.env.AZURE_CONTAINER_NAME;
  
  if (!accountName || !accountKey || !containerName) {
    throw new Error('Faltan variables de entorno de Azure Storage: AZURE_ACCOUNT_NAME, AZURE_ACCOUNT_KEY, AZURE_CONTAINER_NAME');
  }

  // Asegurarse de que el contenedor esté inicializado y exista
  await initializeContainerClient();

  // 2. Crear credenciales
  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

  // 3. Definir los parámetros de la SAS
  const sasOptions = {
    containerName,
    blobName: blobNameWithFolder, // Usar el nombre con la ruta completa
    permissions: BlobSASPermissions.parse("racwd"), // read, add, create, write, delete
    startsOn: new Date(new Date().valueOf() - 5 * 60 * 1000), // 5 minutos en el pasado para evitar problemas de sincronización de reloj (clock skew)
    expiresOn: new Date(new Date().valueOf() + 2 * 60 * 60 * 1000), // 2 horas de validez
  };

  // 4. Generar el token SAS
  const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();

  // 5. Construir las URLs
  const publicUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobNameWithFolder}`;
  const uploadUrl = `${publicUrl}?${sasToken}`;

  // 6. Regresar las URLs
  return {
    uploadUrl,
    publicUrl,
  };
}

module.exports = { generateBlobUploadSAS, initializeContainerClient };