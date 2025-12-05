const cds = require('@sap/cds');
const { ZTProductsPresentacionesCRUD } = require('../services/ztproducts_presentaciones-service');

class ZTProductsPresentacionesService extends cds.ApplicationService {
  async init() {

    this.on('productsPresentacionesCRUD', async (req) => {
      try {
        const ProcessType = req.req?.query?.ProcessType;

        const result = await ZTProductsPresentacionesCRUD(req);

        if (!result.success && req.http?.res) {
          req.http.res.status(result.status || 500);
        } else if (ProcessType === 'AddOne' && result.success && req.http?.res) {
          req.http.res.status(201);

          const idPresenta =
            result?.dataRes?.presentacion?.IdPresentaOK ||
            result?.dataRes?.IdPresentaOK ||
            result?.presentacion?.IdPresentaOK ||
            result?.IdPresentaOK ||
            '';

          if (idPresenta) {
            req.http.res.set('Location', `/api/ztproducts-presentaciones/ZTProductsPresentaciones('${idPresenta}')`);
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

module.exports = ZTProductsPresentacionesService;
