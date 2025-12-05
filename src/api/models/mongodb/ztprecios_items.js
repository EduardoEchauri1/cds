import mongoose from "mongoose";

const ModificationSchema = new mongoose.Schema(
  {
    user:   { type: String, required: true },
    date:   { type: Date, default: Date.now },
    action: { type: String, enum: ["CREATE", "UPDATE", "DELETE"], required: true },
    changes:{ type: Object, default: {} },
  },
  { _id: false }
);

const ZTPRECIOS_ITEMS = new mongoose.Schema(
  {
    IdPrecioOK:    { type: String, required: true, unique: true, trim: true },
    IdListaOK:     { type: String, ref: "ZTPRECIOS_LISTAS", required: true, trim: true },
    SKUID:         { type: String, ref: "ZTPRODUCTS", required: true, trim: true },
    IdPresentaOK:  { type: String, ref: "ZTPRODUCTS_PRESENTACIONES", required: true, trim: true },
    IdTipoFormulaOK:{ type: String, default: null, trim: true },
    Formula:       { type: String, default: "" },
    CostoIni:      { type: Number, required: true, default: 0 },
    CostoFin:      { type: Number, required: true, default: 0 },
    Precio:        { type: Number, required: true, default: 0 },

    ACTIVED:       { type: Boolean, default: true },
    DELETED:       { type: Boolean, default: false },

    REGUSER:       { type: String, required: true },
    REGDATE:       { type: Date, default: Date.now },
    MODUSER:       { type: String, default: null },
    MODDATE:       { type: Date, default: null },

    HISTORY:       [ModificationSchema],
  },
);

ZTPRECIOS_ITEMS.pre("save", function(next) {
  const doc = this;
  const EXCLUDE = new Set(["HISTORY", "MODUSER", "MODDATE", "updatedAt", "createdAt", "__v"]);

  if (doc.isNew) {
    doc.HISTORY.push({
      user: doc.REGUSER,
      action: "CREATE",
      changes: doc.toObject(),
    });
  } else {
    const modified = doc.modifiedPaths().reduce((acc, p) => {
      if (!EXCLUDE.has(p)) acc[p] = doc.get(p);
      return acc;
    }, {});
    if (Object.keys(modified).length > 0) {
      doc.MODDATE = new Date();
      doc.HISTORY.push({
        user: doc.MODUSER || "system",
        action: "UPDATE",
        changes: modified,
      });
    }
  }
  next();
});

export const ZTPrecios_ITEMS = mongoose.model(
  "ZTPRECIOS_ITEMS",
  ZTPRECIOS_ITEMS,
  "ZTPRECIOS_ITEMS"
);