import jetPaths from 'jet-paths';

const Paths = {
  _: '/endpointlab/api',
  Endpoints: {
    _: '/endpoints',
    GetAll: '/',
    Create: '/',
    BulkCreate: '/bulk',
    Reorder: '/reorder',
    Update: '/:id',
    Delete: '/:id',
    Send: '/:id/send',
  },
} as const;

export const JetPaths = jetPaths(Paths);
export default Paths;
