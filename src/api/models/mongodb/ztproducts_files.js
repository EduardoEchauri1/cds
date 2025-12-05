import mongoose from "mongoose";

const ModificationSchema = new mongoose.Schema(
  {
    user: { type: String, required: true },
    date: { type: Date, default: Date.now },
    action: { type: String, enum: ["CREATE", "UPDATE", "DELETE"], required: true },
    changes: { type: Object, default: {} }, // campos que cambiaron
  },
  { _id: false }
);

const ZTPRODUCTS_FILES = new mongoose.Schema(
  {
    FILEID: { type: String, required: true, unique: true, trim: true },
    SKUID: { type: String, required: true, trim: true },
    IdPresentaOK: { type: String, ref: "ZTPRODUCTS_PRESENTACIONES", default: null },
    FILETYPE: { type: String, enum: ["IMG", "PDF", "DOC", "VIDEO", "OTHER"], required: true },
    FILE: { type: String, required: true },
    PRINCIPAL: { type: Boolean, default: false },
    INFOAD: { type: String, default: "" },
    REGUSER: { type: String, required: true },
    REGDATE: { type: Date, default: Date.now },
    MODUSER: { type: String },
    MODDATE: { type: Date },
    ACTIVED: { type: Boolean, default: true },
    DELETED: { type: Boolean, default: false },
    HISTORY: [ModificationSchema],
  }
);

// Middleware para registrar cambios automáticamente
ZTPRODUCTS_FILES.pre("save", function (next) {
  const doc = this;

  if (doc.isNew) {
    // Registro inicial
    doc.HISTORY.push({
      user: doc.REGUSER,
      action: "CREATE",
      changes: doc.toObject(),
    });
  } else {
    // Actualización
    const modifiedFields = doc.modifiedPaths().reduce((acc, path) => {
      if (!["HISTORY", "MODUSER", "MODDATE"].includes(path)) {
        acc[path] = doc.get(path);
      }
      return acc;
    }, {});

    if (Object.keys(modifiedFields).length > 0) {
      doc.MODDATE = new Date(); // actualizar MODDATE
      doc.HISTORY.push({
        user: doc.MODUSER || "system",
        action: "UPDATE",
        changes: modifiedFields,
      });
    }
  }

  next();
});

export const ZTProduct_FILES = mongoose.model(
  "ZTPRODUCTS_FILES",
  ZTPRODUCTS_FILES,
  "ZTPRODUCTS_FILES"
);
