const cds = require('@sap/cds');
const { crudZTPromociones } = require('../services/ztpromociones-service')

class ZTPromocionesService extends cds.ApplicationService {
  async init() {
      this.on('crudPromociones', async (req) => {
        try {                                                          
          // 1. Obtener ProcessType del query string
          const ProcessType = req.req?.query?.ProcessType;
          // 2. Ejecutar la lógica de negocio
          const result = await crudZTPromociones(req);

          // 3. Si el resultado no es exitoso, establecer el status HTTP de error
          if (!result.success && req.http?.res) {
            req.http.res.status(result.status || 500);
          } 
          // 4. Si es exitoso y es un AddMany, establecer status 201 y header Location
          else if (ProcessType === 'AddMany' && result.success && req.http?.res) {
            req.http.res.status(201);
            // Construir el header Location usando el IdPromoOK del resultado
            const idPromoOK = result.dataRes?.data?.IdPromoOK || '';
            if (idPromoOK) {
              req.http.res.set('Location', `/api/ztpromociones/ZTPromociones('${idPromoOK}')`);
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

module.exports = ZTPromocionesService;
