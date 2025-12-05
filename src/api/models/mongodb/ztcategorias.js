/**
 * Archivo: ztcategorias.js
 * Autor: Bayron Arciniega
 */
const mongoose = require('mongoose');

/** Schema: ModificationSchema
 * Autor: Bayron Arciniega
 */
const ModificationSchema = new mongoose.Schema(
  {
    user: { type: String, required: true },
    date: { type: Date, default: Date.now },
    action: { type: String, enum: ["CREATE", "UPDATE", "DELETE"], required: true },
    changes: { type: Object, default: {} },
  },
  { _id: false }
);


/** Schema: ZTCATEGORIAS
 * Autor: Bayron Arciniega
 */
const ZTCATEGORIAS = new mongoose.Schema({
  CATID: {
    type: String,
    required: true,
    unique: true,
    maxlength: 64
  },
  Nombre: {
    type: String,
    required: true,
    maxlength: 128
  },
  PadreCATID: {
    type: String,
    maxlength: 64,
    default: null
  },

  ACTIVED: {
    type: Boolean,
    default: true
  },
  DELETED: {
    type: Boolean,
    default: false
  },
  REGUSER: {
    type: String,
    maxlength: 64,
    required: true
  },
  REGDATE: {
    type: Date,
    default: Date.now
  },
  MODUSER: {
    type: String,
    maxlength: 64,
    default: null
  },
  MODDATE: {
    type: Date,
    default: null
  },
  HISTORY: [ModificationSchema]
});

/** Hook: pre save - Auditar cambios en HISTORY
 * Autor: Bayron Arciniega
 */
ZTCATEGORIAS.pre("save", function (next) {
  const doc = this;

  /** Registro inicial
   * Autor: Bayron Arciniega
   */
  if (doc.isNew) {
    doc.HISTORY.push({
      user: doc.REGUSER,
      action: "CREATE",
      changes: doc.toObject(),
    });
  } else {
    /** Actualización
     * Autor: Bayron Arciniega
     */
    const modifiedFields = doc.modifiedPaths().reduce((acc, path) => {
      if (!["HISTORY", "MODUSER", "MODDATE"].includes(path)) {
        acc[path] = doc.get(path);
      }
      return acc;
    }, {});

    if (Object.keys(modifiedFields).length > 0) {
      doc.MODDATE = new Date();
      doc.HISTORY.push({
        user: doc.MODUSER || "system",
        action: "UPDATE",
        changes: modifiedFields,
      });
    }
  }

  next();
});
module.exports = mongoose.model('ZTCATEGORIAS', ZTCATEGORIAS, 'ZTCATEGORIAS');
