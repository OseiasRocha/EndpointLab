import { Router } from 'express';

import Paths from '../common/constants/Paths';

import EndpointRoutes from './EndpointRoutes';
import TransmitRoutes from './TransmitRoutes';

/******************************************************************************
                                Setup
******************************************************************************/

const apiRouter = Router();

const endpointRouter = Router();

endpointRouter.get(Paths.Endpoints.GetAll, EndpointRoutes.getAll);
endpointRouter.post(Paths.Endpoints.BulkCreate, EndpointRoutes.bulkCreate);
endpointRouter.post(Paths.Endpoints.Create, EndpointRoutes.create);
endpointRouter.put(Paths.Endpoints.Update, EndpointRoutes.update);
endpointRouter.delete(Paths.Endpoints.Delete, EndpointRoutes.delete);
endpointRouter.post(Paths.Endpoints.Send, TransmitRoutes.send);

apiRouter.use(Paths.Endpoints._, endpointRouter);

/******************************************************************************
                                Export
******************************************************************************/

export default apiRouter;
