const cds = require('@sap/cds');
const { ZTPreciosItemsCRUD } = require('../services/ztprecios_items-service');

class ZTPreciosItemsService extends cds.ApplicationService {
  async init() {

    this.on('preciosItemsCRUD', async (req) => {
      try {
        const ProcessType = req.req?.query?.ProcessType;
        const result = await ZTPreciosItemsCRUD(req);

        if (!result.success && req.http?.res) {
          req.http.res.status(result.status || 500);
        }
        else if (ProcessType === 'AddOne' && result.success && req.http?.res) {
          req.http.res.status(201);
          const idPrecio =
            result?.dataRes?.item?.IdPrecioOK ||
            result?.dataRes?.IdPrecioOK ||
            result?.IdPrecioOK || '';

          if (idPrecio) {
            req.http.res.set('Location', `/api/ztprecios-items/PreciosItems('${idPrecio}')`);
          }
          return req.http.res.send(result);
        }

        return result;

      } catch (error) {
        req.error(error.code || 500, error.message);
      }
    });

    return super.init();
  }
}

module.exports = ZTPreciosItemsService;