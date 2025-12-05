const cds = require('@sap/cds');
const { crudZTProducts } = require('../services/ztproducts-service');

class ZTProductsService extends cds.ApplicationService {
  async init() {
    this.on('crudProducts', async (req) => {
      try {
        // Ejecutar la lógica de negocio. El servicio se encargará de leer los parámetros desde req.data
        const result = await crudZTProducts(req);

        // Si el servicio ya manejó un error (FAIL), CAP lo propagará.
        if (result?.finalRes && !result?.success) {
          return;
        }

        // Para respuestas exitosas, usamos req.reply() para que CAP las maneje correctamente.
        return req.reply(result);

      } catch (error) {
        req.error(error.code || 500, error.message);
      }
    });

    return super.init();
  }
}

module.exports = ZTProductsService;
