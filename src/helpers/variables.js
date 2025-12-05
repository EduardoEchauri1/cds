//FIC: What type of variable is it?
function whatTypeVarIs(variable) { 
    if (Array.isArray(variable)) {
        return "isArray";
    } else if (typeof variable === 'object' && variable !== null) {
        return "isObject";
    } else {
        return null;
    };
};


//FIC: Exportar como un objeto
module.exports = { whatTypeVarIs };
