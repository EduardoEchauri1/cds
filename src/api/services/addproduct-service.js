/**
 * Autor: EchauriMu
 */

/** IMPORTS - EchauriMu */
const { getCosmosDatabase } = require('../../config/connectToMongoDB.config');
const ZTProduct = require('../models/mongodb/ztproducts');
const { ZTProducts_Presentaciones } = require('../models/mongodb/ztproducts_presentaciones');
const { saveWithAudit } = require('../../helpers/audit-timestap');
const { handleUploadZTProductFileCDS } = require('../../helpers/azureUpload.helper');
const { OK, FAIL, BITACORA, DATA, AddMSG } = require('../../middlewares/respPWA.handler');

/** UTIL: OBTENER PAYLOAD DESDE CDS/EXPRESS - EchauriMu */
function getPayload(req) {
  return req.data || req.req?.body || null;
}

/** UTIL: OBTENER CONTENEDOR DE COSMOS DB - EchauriMu */
async function getCosmosContainer(containerName, partitionKeyPath) {
  const database = getCosmosDatabase();
  if (!database) {
    throw new Error('La conexión con Cosmos DB no está disponible.');
  }
  const { container } = await database.containers.createIfNotExists({ id: containerName, partitionKey: { paths: [partitionKeyPath] } });
  return container;
}

/** SERVICIO PRINCIPAL - EchauriMu */
async function addProductWithPresentations(req) {
  let bitacora = BITACORA();
  let data = DATA();

  const { LoggedUser, DBServer } = req.req?.query || {};
  const dbServer = DBServer || 'MongoDB';

  try {
    if (!LoggedUser) {
      data.messageDEV = "El parámetro LoggedUser es obligatorio.";
      data.messageUSR = "Falta información de usuario.";
      bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
      return FAIL(bitacora);
    }

    const payload = getPayload(req);
    const { product, presentations } = payload;

    if (!product || !product.PRODUCTNAME) {
      data.messageDEV = "El objeto 'product' con su 'PRODUCTNAME' es obligatorio en el payload.";
      data.messageUSR = "El nombre del producto (PRODUCTNAME) es obligatorio.";
      bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
      return FAIL(bitacora);
    }

    if (presentations && presentations.some(p => !p || typeof p !== 'object')) {
      data.messageDEV = "El array 'presentations' contiene elementos nulos o inválidos. Revise si hay comas extra en el JSON.";
      data.messageUSR = "Los datos de las presentaciones son inválidos. Por favor, verifique el formato.";
      bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
      return FAIL(bitacora);
    }

    bitacora.process = 'Crear Producto con Presentaciones';
    bitacora.processType = 'AddProductWithPresentations';
    bitacora.loggedUser = LoggedUser;
    bitacora.dbServer = dbServer;
    bitacora.api = '/api/add-product/addProductWithPresentations';

    let createdProduct;
    try {
      const required = ['SKUID', 'PRODUCTNAME', 'DESSKU', 'IDUNIDADMEDIDA'];
      const missing = required.filter((k) => !product || !product[k]);
      if (missing.length) throw new Error(`Faltan campos obligatorios en el producto: ${missing.join(', ')}`);
      
      switch (dbServer) {
        case 'MongoDB': {
          const exists = await ZTProduct.findOne({ SKUID: product.SKUID }).lean();
          if (exists) throw new Error(`Ya existe un producto con el SKUID: ${product.SKUID}`);

          const productData = {
            SKUID: product.SKUID,
            PRODUCTNAME: product.PRODUCTNAME,
            DESSKU: product.DESSKU,
            MARCA: product.MARCA || '',
            CATEGORIAS: product.CATEGORIAS || [],
            IDUNIDADMEDIDA: product.IDUNIDADMEDIDA,
            BARCODE: product.BARCODE || '',
            INFOAD: product.INFOAD || '',
          };
          createdProduct = await saveWithAudit(ZTProduct, {}, productData, LoggedUser, 'CREATE');
          break;
        }
        case 'CosmosDB': {
          const container = await getCosmosContainer('ZTPRODUCTS', '/SKUID');
          const querySpec = {
            query: "SELECT c.id FROM c WHERE c.id = @skuid",
            parameters: [{ name: "@skuid", value: product.SKUID }]
          };
          const { resources: items } = await container.items.query(querySpec).fetchAll();
          if (items.length > 0) throw new Error(`Ya existe un producto con el SKUID: ${product.SKUID}`);

          const newItem = {
            id: product.SKUID,
            partitionKey: product.SKUID,
            SKUID: product.SKUID,
            ...product,
            ACTIVED: product.ACTIVED ?? true,
            DELETED: product.DELETED ?? false,
            REGUSER: LoggedUser,
            REGDATE: new Date().toISOString(),
            HISTORY: [{
              user: LoggedUser,
              action: "CREATE",
              date: new Date().toISOString(),
              changes: product
            }]
          };
          const { resource: createdItem } = await container.items.create(newItem);
          createdProduct = createdItem;
          break;
        }
        default:
          throw new Error(`DBServer no soportado: ${dbServer}`);
      }

    } catch (productError) {
      data.process = 'Error al crear el producto padre';
      data.messageDEV = productError.message;
      data.messageUSR = "No se pudo crear el producto. Verifique que el SKUID no exista y que los datos sean correctos.";
      bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
      return FAIL(bitacora);
    }

    const createdPresentations = [];
    const createdFilesInfo = [];
    if (presentations && presentations.length > 0) {
      for (const pres of presentations) {
        try {
          const requiredPres = ['IdPresentaOK', 'NOMBREPRESENTACION', 'Descripcion'];
          const missingPres = requiredPres.filter((k) => !pres[k]);
          if (missingPres.length) throw new Error(`Faltan campos obligatorios en la presentación '${pres.IdPresentaOK || ''}': ${missingPres.join(', ')}`);
          
          let newPresentation;
          switch(dbServer) {
            case 'MongoDB': {
              const existsPres = await ZTProducts_Presentaciones.findOne({ IdPresentaOK: pres.IdPresentaOK }).lean();
              if (existsPres) throw new Error(`Ya existe una presentación con el ID: ${pres.IdPresentaOK}`);

              let propiedades = {};
              if (typeof pres.PropiedadesExtras === 'string' && pres.PropiedadesExtras.trim() !== '') {
                try {
                  propiedades = JSON.parse(pres.PropiedadesExtras);
                } catch (jsonError) {
                  throw new Error(`El formato de PropiedadesExtras para la presentación '${pres.IdPresentaOK}' no es un JSON válido.`);
                }
              }

              const presentationData = {
                IdPresentaOK: pres.IdPresentaOK,
                SKUID: createdProduct.SKUID,
                NOMBREPRESENTACION: pres.NOMBREPRESENTACION,
                Descripcion: pres.Descripcion,
                PropiedadesExtras: propiedades,
              };
              newPresentation = await saveWithAudit(ZTProducts_Presentaciones, {}, presentationData, LoggedUser, 'CREATE');
              break;
            }
            case 'CosmosDB': {
              const container = await getCosmosContainer('ZTPRODUCTS_PRESENTACIONES', '/IDPRESENTAOK');
              const { resource: existing } = await container.item(pres.IdPresentaOK, pres.IdPresentaOK).read().catch(() => ({}));
              if (existing) throw new Error(`Ya existe una presentación con el ID: ${pres.IdPresentaOK}.`);

              let propiedades = {};
              if (typeof pres.PropiedadesExtras === 'string' && pres.PropiedadesExtras.trim() !== '') {
                try {
                  propiedades = JSON.parse(pres.PropiedadesExtras);
                } catch (e) {
                  propiedades = {};
                }
              } else if (typeof pres.PropiedadesExtras === 'object' && pres.PropiedadesExtras !== null) {
                propiedades = pres.PropiedadesExtras;
              }

              const { files: _files, ...presToSave } = pres;

              const newItem = {
                id: pres.IdPresentaOK,
                partitionKey: pres.IdPresentaOK,
                SKUID: createdProduct.id,
                IDPRESENTAOK: pres.IdPresentaOK,
                ...presToSave,
                PropiedadesExtras: propiedades,
                ACTIVED: pres.ACTIVED ?? true,
                DELETED: pres.DELETED ?? false,
                REGUSER: LoggedUser,
                REGDATE: new Date().toISOString(),
                HISTORY: [{
                  user: LoggedUser,
                  action: "CREATE",
                  date: new Date().toISOString(),
                  changes: presToSave
                }]
              };
              const { resource: createdItem } = await container.items.create(newItem);
              newPresentation = createdItem;
              break;
            }
            default:
              throw new Error(`DBServer no soportado: ${dbServer}`);
          }

          createdPresentations.push(newPresentation);

          if (pres.files && pres.files.length > 0) {
            for (const file of pres.files) {
              const { fileBase64, originalname, mimetype, ...restOfFile } = file;
              const cleanBase64 = fileBase64.replace(/^data:([A-Za-z-+\/]+);base64,/, '').replace(/\r?\n|\r/g, '');
              const fileBuffer = Buffer.from(cleanBase64, 'base64');
              const fileForHelper = {
                buffer: fileBuffer,
                originalname: originalname || 'upload.bin',
                mimetype: mimetype || 'application/octet-stream',
              };

              const bodyForHelper = {
                SKUID: createdProduct.SKUID || createdProduct.id,
                IdPresentaOK: newPresentation.IdPresentaOK || newPresentation.id,
                ...restOfFile
              };

              const uploadResult = await handleUploadZTProductFileCDS(fileForHelper, bodyForHelper, LoggedUser, dbServer);

              if (uploadResult.error || uploadResult.status >= 400) {
                throw new Error(uploadResult.message || uploadResult.data?.error || 'Error al subir archivo a Azure.');
              }
              createdFilesInfo.push(uploadResult.data);
            }
          }

        } catch (presentationError) {
          switch(dbServer) {
            case 'MongoDB':
              await ZTProduct.findOneAndDelete({ SKUID: createdProduct.SKUID });
              const presentaOKsToDeleteMongo = createdPresentations.map(p => p.IdPresentaOK);
              if (presentaOKsToDeleteMongo.length > 0) {
                await ZTProducts_Presentaciones.deleteMany({ IdPresentaOK: { $in: presentaOKsToDeleteMongo } });
              }
              break;
            case 'CosmosDB':
              const productContainer = await getCosmosContainer('ZTPRODUCTS', '/SKUID');
              await productContainer.item(createdProduct.id, createdProduct.SKUID).delete().catch(() => {});

              const presContainer = await getCosmosContainer('ZTPRODUCTS_PRESENTACIONES', '/IDPRESENTAOK');
              for (const presToDelete of createdPresentations) {
                await presContainer.item(presToDelete.id, presToDelete.IDPRESENTAOK).delete().catch(() => {});
              }
              break;
          }

          data.process = `Error al crear la presentación ${pres?.IdPresentaOK || ''}`;
          data.messageDEV = presentationError.message;
          data.messageUSR = `Se creó el producto, pero falló la creación de una de sus presentaciones. Se ha revertido la operación.`;
          bitacora = AddMSG(bitacora, data, 'FAIL', 400, true);
          return FAIL(bitacora);
        }
      }
    }

    const responseData = {
      product: createdProduct,
      presentations: createdPresentations,
      files: createdFilesInfo,
    };

    data.dataRes = responseData;
    data.messageUSR = 'Producto y sus presentaciones creados exitosamente.';
    data.messageDEV = 'Operación completada sin errores.';
    bitacora = AddMSG(bitacora, data, 'OK', 201, true);

    return OK(bitacora);

  } catch (error) {
    data.process = 'Catch principal del servicio';
    data.messageDEV = error.message;
    data.messageUSR = "Ocurrió un error inesperado al procesar su solicitud.";
    data.stack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
    bitacora = AddMSG(bitacora, data, 'FAIL', 500, true);
    return FAIL(bitacora);
  }
}

module.exports = {
  addProductWithPresentations,
};