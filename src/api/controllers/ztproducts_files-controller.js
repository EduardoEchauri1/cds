const cds = require('@sap/cds');
const { ZTProductFilesCRUD } = require('../services/ztproducts_files-service');

class ZTProductFilesService extends cds.ApplicationService {
    async init() {
        
        this.on('productsFilesCRUD', async (req) => {
            try {
                // 1. Obtener ProcessType del query string
                const ProcessType = req.req?.query?.ProcessType;
                // 2. Ejecutar la lógica de negocio
                const result = await ZTProductFilesCRUD(req);

                // 3. Si el resultado no es exitoso, establecer el status HTTP de error
                if (!result.success && req.http?.res) {
                    req.http.res.status(result.status || 500);
                } 
                // 4. Si es exitoso y es un AddOne, establecer status 201 y header Location
                else if (ProcessType === 'AddOne' && result.success && req.http?.res) {
                    req.http.res.status(201);
                    // Construir el header Location usando el FILEID del resultado
                    const fileID = result.dataRes?.file?.FILEID || '';
                    if (fileID) {
                        req.http.res.set('Location', `/api/ztproducts-files/ZTProductFiles('${fileID}')`);
                    }
                    // Envía la respuesta manualmente y termina para que CAP no la procese de nuevo.
                    return req.http.res.send(result);
                }
                // 5. Retornar el resultado para que CAP lo envíe como respuesta.
                return result;
            } catch (error) {
                req.error(error.code || 500, error.message);
            }
        });
        return super.init();
    }
}

module.exports = ZTProductFilesService;