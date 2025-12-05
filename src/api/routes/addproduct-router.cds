using { addproduct_def as myapi } from '../models/addproduct';

@impl: 'src/api/controllers/addproduct-controller.js'
@path: '/api/add-product'
service AddProductService {

    @Core.Description: 'Crea un producto y sus presentaciones en una sola transacción'
    @path: 'createCompleteProduct'
    action createCompleteProduct(
        product       : myapi.ProductData,
        presentations : many myapi.PresentationData
    ) returns String;

}