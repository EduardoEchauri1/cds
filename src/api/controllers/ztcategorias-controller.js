/**
 * Archivo: ztcategorias-controller.js
 * Autor: Bayron Arciniega
 */
const cds = require("@sap/cds");
const { ZTCategoriasCRUD } = require("../services/ztcategorias-service");

/** Clase: ZTCategoriasService
 * Autor: Bayron Arciniega
 */
class ZTCategoriasService extends cds.ApplicationService {
  /** Método: init
   * Autor: Bayron Arciniega
   */
  async init() {
    /** Handler: categoriasCRUD
     * Autor: Bayron Arciniega
     */
    this.on("categoriasCRUD", async (req) => {
      try {
        /** Obtener ProcessType (case-insensitive)
         * Autor: Bayron Arciniega
         */
        const ProcessType = (req.req?.query?.ProcessType || "").toString();
        const procNorm = ProcessType.toLowerCase();

        /** Ejecutar la lógica de negocio
         * Autor: Bayron Arciniega
         */
        const result = await ZTCategoriasCRUD(req);

        /** Si no hay objeto de respuesta HTTP (CAP internal), devolver el resultado
         * Autor: Bayron Arciniega
         */
        if (!req.http?.res) {
          return result;
        }

        /** Determinar código HTTP a usar
         * Autor: Bayron Arciniega
         */
        const statusCode = result?.status || (result?.success ? 200 : 500);

        /** Si fallo, devolver con status de error
         * Autor: Bayron Arciniega
         */
        if (!result?.success) {
          req.http.res.status(statusCode).send(result);
          return;
        }

        /** Si fue AddOne -> 201 + Location header (si se puede obtener CATID)
         * Autor: Bayron Arciniega
         */
        if (procNorm === "addone") {
          req.http.res.status(201);
          const catID =
            result?.dataRes?.data?.CATID ||
            result?.dataRes?.CATID ||
            result?.dataRes?.data?.catid ||
            result?.dataRes?.catid ||
            "";
          if (catID) {
            req.http.res.set("Location", `/api/ztcategorias/Categorias('${catID}')`);
          }
          req.http.res.send(result);
          return;
        }

        /** Para éxitos generales, devolver con status apropiado (200 por defecto)
         * Autor: Bayron Arciniega
         */
        req.http.res.status(statusCode).send(result);
        return;
      } catch (error) {
        /** Manejo de excepción consistente con CAP
         * Autor: Bayron Arciniega
         */
        req.error(error.code || 500, error.message);
      }
    });

    return super.init();
  }
}

module.exports = ZTCategoriasService;
